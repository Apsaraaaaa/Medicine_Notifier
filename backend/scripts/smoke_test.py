"""
End-to-end API check against a running dev server (stdlib only).

    venv\\Scripts\\python scripts\\smoke_test.py [http://127.0.0.1:8000/api]

Covers everything the React Native app calls - register, login, refresh,
medicine CRUD, history create/read, change password - plus the two things that
are easy to get wrong: per-user ownership isolation and rejection of
unauthenticated requests.
"""

import json
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/api").rstrip("/")

passed = 0
failed = 0


def call(method, path, body=None, token=None):
    """Returns (status_code, parsed_body, headers)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    # Header names are case-insensitive per RFC 9110 - normalise so any
    # lookup below is reliable.
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode()
            return res.status, (json.loads(raw) if raw else None), lower_keys(res.headers)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = raw
        return exc.code, parsed, lower_keys(exc.headers)


def lower_keys(headers):
    return {k.lower(): v for k, v in headers.items()}


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}   {detail}")


stamp = int(time.time())
USER_A = {"name": "Asha Patel", "email": f"asha{stamp}@example.com", "password": "Str0ngPass!23"}
USER_B = {"name": "Ben Torres", "email": f"ben{stamp}@example.com", "password": "Str0ngPass!23"}

print(f"\nMedicine Notifier API smoke test -> {BASE}\n")

# --- 1. Register -----------------------------------------------------------
print("1. Register")
code, body, _ = call("POST", "/auth/register/", USER_A)
check("register returns 201", code == 201, f"got {code} {body}")
check("response has access + refresh + user", isinstance(body, dict) and {"access", "refresh", "user"} <= set(body), f"keys={list(body) if isinstance(body, dict) else body}")
check("user has id/name/email", isinstance(body, dict) and {"id", "name", "email"} <= set(body.get("user", {})), f"user={body.get('user') if isinstance(body, dict) else None}")
check("email echoed back lowercased", body["user"]["email"] == USER_A["email"].lower())
check("password is never returned", "password" not in json.dumps(body))
a_access, a_refresh = body["access"], body["refresh"]

code, body, _ = call("POST", "/auth/register/", USER_A)
check("duplicate email rejected (400)", code == 400, f"got {code}")
code, body, _ = call("POST", "/auth/register/", {"name": "X", "email": "x@example.com", "password": "123"})
check("weak password rejected (400)", code == 400, f"got {code}")

# --- 2. Login --------------------------------------------------------------
print("\n2. Login")
code, body, _ = call("POST", "/auth/login/", {"email": USER_A["email"], "password": USER_A["password"]})
check("login returns 200", code == 200, f"got {code} {body}")
check("login returns access + refresh + user", {"access", "refresh", "user"} <= set(body), f"keys={list(body)}")
a_access, a_refresh = body["access"], body["refresh"]

code, body, _ = call("POST", "/auth/login/", {"email": USER_A["email"], "password": "wrong-password"})
check("wrong password rejected (400)", code == 400, f"got {code}")

code, body, _ = call("GET", "/auth/me/", token=a_access)
check("GET /auth/me/ returns the user", code == 200 and body["email"] == USER_A["email"].lower(), f"got {code} {body}")

code, body, _ = call("GET", "/auth/me/")
check("GET /auth/me/ without token -> 401", code == 401, f"got {code}")

# --- 3. Refresh ------------------------------------------------------------
print("\n3. JWT refresh")
code, body, _ = call("POST", "/auth/refresh/", {"refresh": a_refresh})
check("refresh returns 200 + new access", code == 200 and "access" in body, f"got {code} {body}")
rotated_access = body["access"]
rotated_refresh = body.get("refresh", a_refresh)
code, body, _ = call("GET", "/auth/me/", token=rotated_access)
check("refreshed access token works", code == 200, f"got {code} {body}")
code, body, _ = call("POST", "/auth/refresh/", {"refresh": "not-a-token"})
check("bogus refresh rejected (401)", code == 401, f"got {code}")
a_access, a_refresh = rotated_access, rotated_refresh

# --- 4. Create a medicine --------------------------------------------------
print("\n4. Create medicine")
med_payload = {
    "name": "Metformin",
    "dosage": "500 mg",
    "notes": "Take with food",
    "frequency": "Twice daily",
    "times": ["20:00", "08:00"],
    "startDate": "2026-08-01",
    "endDate": "2026-12-31",
    "color": "#6c4fd0",
}
code, med, _ = call("POST", "/medicines/", med_payload, token=a_access)
check("create returns 201", code == 201, f"got {code} {med}")
check("id is a string (matches mobile/types.ts)", isinstance(med.get("id"), str), f"id={med.get('id')!r}")
check("camelCase keys preserved", {"startDate", "endDate", "notes", "times", "color"} <= set(med), f"keys={list(med)}")
check("times normalised + sorted to HH:MM", med["times"] == ["08:00", "20:00"], f"times={med.get('times')}")
check("notes round-trips", med["notes"] == "Take with food", f"notes={med.get('notes')}")
check("active defaults to True", med.get("active") is True, f"active={med.get('active')}")
med_id = med["id"]

code, body, _ = call("POST", "/medicines/", {**med_payload, "times": ["25:00"]}, token=a_access)
check("invalid time rejected (400)", code == 400, f"got {code}")
code, body, _ = call("POST", "/medicines/", {**med_payload, "endDate": "2026-01-01"}, token=a_access)
check("endDate before startDate rejected (400)", code == 400, f"got {code}")
code, body, _ = call("POST", "/medicines/", med_payload)
check("create without token -> 401", code == 401, f"got {code}")

# --- 5. List medicines -----------------------------------------------------
print("\n5. Get medicines")
code, body, _ = call("GET", "/medicines/", token=a_access)
check("list returns 200", code == 200, f"got {code}")
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("list contains the new medicine", any(m["id"] == med_id for m in items), f"got {items}")
code, body, _ = call("GET", f"/medicines/{med_id}/", token=a_access)
check("detail returns 200", code == 200 and body["name"] == "Metformin", f"got {code} {body}")

# --- 6. Update a medicine --------------------------------------------------
print("\n6. Update medicine")
code, body, _ = call("PUT", f"/medicines/{med_id}/", {**med_payload, "name": "Metformin XR", "dosage": "750 mg"}, token=a_access)
check("PUT returns 200 and applies changes", code == 200 and body["name"] == "Metformin XR" and body["dosage"] == "750 mg", f"got {code} {body}")
code, body, _ = call("PATCH", f"/medicines/{med_id}/", {"active": False}, token=a_access)
check("PATCH partial update works", code == 200 and body["active"] is False, f"got {code} {body}")
check("PATCH left other fields intact", body["name"] == "Metformin XR", f"name={body.get('name')}")
code, body, _ = call("PATCH", f"/medicines/{med_id}/", {"active": True}, token=a_access)
check("re-activate works", code == 200 and body["active"] is True, f"got {code}")

# --- 7 + 8. History --------------------------------------------------------
print("\n7. Create history")
hist_payload = {
    "medicineId": med_id,
    "time": "08:00",
    "date": "2026-08-18",
    "status": "taken",
    "note": "After breakfast",
}
code, hist, _ = call("POST", "/history/", hist_payload, token=a_access)
check("create returns 201", code == 201, f"got {code} {hist}")
check("medicineName auto-filled from the medicine", hist.get("medicineName") == "Metformin XR", f"got {hist.get('medicineName')}")
check("dosage auto-filled from the medicine", hist.get("dosage") == "750 mg", f"got {hist.get('dosage')}")
check("recordedAt set automatically for a resolved dose", bool(hist.get("recordedAt")), f"got {hist.get('recordedAt')}")
check("time rendered as HH:MM", hist.get("time") == "08:00", f"got {hist.get('time')}")
check("medicineId is a string", isinstance(hist.get("medicineId"), str), f"got {hist.get('medicineId')!r}")
hist_id = hist["id"]

for st in ("pending", "missed", "skipped"):
    code, body, _ = call("POST", "/history/", {**hist_payload, "status": st}, token=a_access)
    check(f"status '{st}' accepted", code == 201, f"got {code} {body}")
code, body, _ = call("POST", "/history/", {**hist_payload, "status": "invented"}, token=a_access)
check("invalid status rejected (400)", code == 400, f"got {code}")

code, body, _ = call("PATCH", f"/history/{hist_id}/", {"status": "missed", "note": "Skipped, felt unwell"}, token=a_access)
check("PATCH history works", code == 200 and body["status"] == "missed", f"got {code} {body}")

print("\n8. Get history")
code, body, _ = call("GET", "/history/", token=a_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("list returns 200", code == 200, f"got {code}")
check("history contains our entries", any(h["id"] == hist_id for h in items), f"got {items}")
code, body, _ = call("GET", "/history/?status=missed", token=a_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("status filter works", all(h["status"] == "missed" for h in items) and items, f"got {items}")

# --- 9. Ownership isolation ------------------------------------------------
print("\n9. Ownership isolation (user B must not see user A's data)")
code, body, _ = call("POST", "/auth/register/", USER_B)
check("second user registers", code == 201, f"got {code} {body}")
b_access = body["access"]

code, body, _ = call("GET", "/medicines/", token=b_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("B's medicine list is empty", items == [], f"got {items}")
code, body, _ = call("GET", f"/medicines/{med_id}/", token=b_access)
check("B cannot read A's medicine (404)", code == 404, f"got {code} {body}")
code, body, _ = call("PATCH", f"/medicines/{med_id}/", {"name": "hijacked"}, token=b_access)
check("B cannot update A's medicine (404)", code == 404, f"got {code}")
code, body, _ = call("DELETE", f"/medicines/{med_id}/", token=b_access)
check("B cannot delete A's medicine (404)", code == 404, f"got {code}")

code, body, _ = call("GET", "/history/", token=b_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("B's history is empty", items == [], f"got {items}")
code, body, _ = call("GET", f"/history/{hist_id}/", token=b_access)
check("B cannot read A's history (404)", code == 404, f"got {code}")
code, body, _ = call("POST", "/history/", hist_payload, token=b_access)
check("B cannot file history against A's medicine (400)", code == 400, f"got {code} {body}")

code, body, _ = call("GET", f"/medicines/{med_id}/", token=a_access)
check("A's medicine survived B's attempts", code == 200 and body["name"] == "Metformin XR", f"got {code} {body}")

# --- 9b. Public endpoints must ignore a stale Authorization header ----------
# Regression guard: DRF authenticates before checking permissions, so a leftover
# token in a client's storage used to 401 register/login and lock the user out
# of signing in at all.
print("\n9b. Stale token must not block public endpoints")
STALE = "Bearer tok_stale_from_an_old_build"
stale_email = f"stale{stamp}@example.com"


def call_stale(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", STALE)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, (json.loads(raw) if raw else None)
        except json.JSONDecodeError:
            return exc.code, raw


code, body = call_stale(
    "POST",
    "/auth/register/",
    {"name": "Stale", "email": stale_email, "password": "Str0ngPass!23"},
)
check("register ignores a stale token", code == 201, f"got {code} {body}")
code, body = call_stale(
    "POST", "/auth/login/", {"email": stale_email, "password": "Str0ngPass!23"}
)
check("login ignores a stale token", code == 200, f"got {code} {body}")
code, body = call_stale("GET", "/medicines/")
check("protected route still rejects a stale token", code == 401, f"got {code}")

# --- 9c. Medicine catalog (shared reference data) ---------------------------
print("\n9c. Catalog search and autocomplete")
code, body, _ = call("GET", "/catalog/?q=para", token=a_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("search returns 200", code == 200, f"got {code}")
check("'para' finds paracetamol", any("Paracetamol" in i["name"] for i in items), f"got {[i.get('name') for i in items]}")
check("top hit is the exact name, not a compound", items and items[0]["name"] == "Paracetamol", f"got {items[0].get('name') if items else None}")
check("suggestions carry a label", all(i.get("label") for i in items), f"got {[i.get('label') for i in items]}")
check("suggestions carry a prefillable dosage", all(i.get("defaultDosage") for i in items), f"got {[i.get('defaultDosage') for i in items]}")
catalog_id = items[0]["id"]

code, body, _ = call("GET", "/catalog/?q=acetamin", token=a_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("generic names are searchable", any("Paracetamol" in i["name"] for i in items), f"got {[i.get('name') for i in items]}")

code, body, _ = call("GET", "/catalog/?q=para&limit=2", token=a_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("limit is honoured", len(items) <= 2, f"got {len(items)}")

code, body, _ = call("GET", "/catalog/?q=zzzznotamedicine", token=a_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("no match returns an empty list, not an error", code == 200 and items == [], f"got {code} {items}")

code, body, _ = call("GET", "/catalog/?q=para")
check("catalog needs a token", code == 401, f"got {code}")

# The catalog is reference data: the app reads it and never writes to it.
code, body, _ = call("POST", "/catalog/", {"name": "Invented"}, token=a_access)
check("catalog is read-only (405)", code == 405, f"got {code}")

# A user's medicine may link to a catalog entry without being owned by it.
code, linked, _ = call("POST", "/medicines/", {**med_payload, "name": "Paracetamol 500 mg", "catalogId": catalog_id}, token=a_access)
check("medicine accepts a catalogId", code == 201, f"got {code} {linked}")
check("catalogId round-trips as a string", linked.get("catalogId") == str(catalog_id), f"got {linked.get('catalogId')!r}")
code, freehand, _ = call("POST", "/medicines/", {**med_payload, "name": "Grandma's tonic"}, token=a_access)
check("a medicine with no catalog entry still saves", code == 201 and freehand.get("catalogId") is None, f"got {code} {freehand.get('catalogId')}")
call("DELETE", f"/medicines/{linked['id']}/", token=a_access)
call("DELETE", f"/medicines/{freehand['id']}/", token=a_access)

# --- 10. Change password ---------------------------------------------------
print("\n10. Change password")
code, body, _ = call("POST", "/auth/change-password/", {"old_password": "nope", "new_password": "An0therPass!45"}, token=a_access)
check("wrong current password rejected (400)", code == 400, f"got {code} {body}")
code, body, _ = call("POST", "/auth/change-password/", {"old_password": USER_A["password"], "new_password": "123"}, token=a_access)
check("weak new password rejected (400)", code == 400, f"got {code}")
code, body, _ = call("POST", "/auth/change-password/", {"old_password": USER_A["password"], "new_password": "An0therPass!45"}, token=a_access)
check("password updated (200)", code == 200, f"got {code} {body}")
code, body, _ = call("POST", "/auth/login/", {"email": USER_A["email"], "password": "An0therPass!45"})
check("login works with the new password", code == 200, f"got {code}")
USER_A["password"] = "An0therPass!45"
a_access, a_refresh = body["access"], body["refresh"]

# --- 11. Logout ------------------------------------------------------------
print("\n11. Logout / token blacklist")
code, body, _ = call("POST", "/auth/logout/", {"refresh": a_refresh}, token=a_access)
check("logout returns 205", code == 205, f"got {code} {body}")
code, body, _ = call("POST", "/auth/refresh/", {"refresh": a_refresh})
check("blacklisted refresh token is rejected (401)", code == 401, f"got {code} {body}")

# --- 12. Delete a medicine -------------------------------------------------
print("\n12. Delete medicine")
code, body, _ = call("POST", "/auth/login/", {"email": USER_A["email"], "password": USER_A["password"]})
a_access = body["access"]
code, body, _ = call("DELETE", f"/medicines/{med_id}/", token=a_access)
check("delete returns 204", code == 204, f"got {code} {body}")
code, body, _ = call("GET", f"/medicines/{med_id}/", token=a_access)
check("medicine is gone (404)", code == 404, f"got {code}")
code, body, _ = call("GET", "/history/", token=a_access)
items = body["results"] if isinstance(body, dict) and "results" in body else body
check("history survives medicine deletion", any(h["id"] == hist_id for h in items), f"got {items}")
kept = next((h for h in items if h["id"] == hist_id), {})
check("deleted medicine's name still readable in history", kept.get("medicineName") == "Metformin XR", f"got {kept.get('medicineName')}")

print(f"\n{'=' * 52}\n  {passed} passed, {failed} failed\n{'=' * 52}\n")
sys.exit(1 if failed else 0)

