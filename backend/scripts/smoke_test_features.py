"""
End-to-end check of the five features added on top of the base API (stdlib only).

    venv\\Scripts\\python scripts\\smoke_test_features.py [http://127.0.0.1:8000/api]

Covers, in order:

  1. Language        the account's language preference round-trips
  2. Routine         routine / meal relation / critical on a medicine
  3. Report          /api/reports/ figures, and that they agree with the doses
  4. Scanner         /api/catalog/scan/ parses a prescription into form fields
  5. Caregiver       invite, accept, read-only patient view, missed-dose alerts

Run scripts/smoke_test.py first — this one assumes the base API is sound and
tests only what is new.
"""

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/api").rstrip("/")

passed = 0
failed = 0


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
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


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}   {detail}")


def listing(body):
    return body["results"] if isinstance(body, dict) and "results" in body else body


stamp = int(time.time())
TODAY = date.today()
PATIENT = {"name": "Sita Sharma", "email": f"sita{stamp}@example.com", "password": "Str0ngPass!23"}
CARER = {"name": "Ram Sharma", "email": f"ram{stamp}@example.com", "password": "Str0ngPass!23"}

print(f"\nMedicine Notifier — new features smoke test -> {BASE}\n")

code, body = call("POST", "/auth/register/", PATIENT)
assert code == 201, f"could not register the patient: {code} {body}"
p_token = body["access"]

# ---------------------------------------------------------------------------
print("1. Language preference")
check("new account defaults to English", body["user"].get("language") == "en", f"got {body['user'].get('language')}")

code, body = call("PATCH", "/auth/profile/", {"language": "ne"}, token=p_token)
check("language switches to Nepali", code == 200 and body.get("language") == "ne", f"got {code} {body}")
code, body = call("GET", "/auth/me/", token=p_token)
check("language persists across requests", body.get("language") == "ne", f"got {body.get('language')}")
code, body = call("PATCH", "/auth/profile/", {"language": "klingon"}, token=p_token)
check("an unknown language is rejected (400)", code == 400, f"got {code} {body}")
call("PATCH", "/auth/profile/", {"language": "en"}, token=p_token)

# ---------------------------------------------------------------------------
print("\n2. Medicine routine")
routine_med = {
    "name": "Amlodipine",
    "dosage": "1 tablet (5 mg)",
    "frequency": "Once a day",
    "times": ["08:00"],
    "startDate": (TODAY - timedelta(days=20)).isoformat(),
    "endDate": (TODAY + timedelta(days=20)).isoformat(),
    "color": "#7B61D9",
    "routine": "breakfast",
    "mealRelation": "after",
    "critical": True,
}
code, med = call("POST", "/medicines/", routine_med, token=p_token)
check("create accepts routine fields", code == 201, f"got {code} {med}")
check("routine round-trips", med.get("routine") == "breakfast", f"got {med.get('routine')}")
check("mealRelation round-trips", med.get("mealRelation") == "after", f"got {med.get('mealRelation')}")
check("critical round-trips", med.get("critical") is True, f"got {med.get('critical')}")
critical_id = med["id"]

code, body = call("POST", "/medicines/", {**routine_med, "routine": "elevenses"}, token=p_token)
check("an unknown routine is rejected (400)", code == 400, f"got {code}")

# An older client that sends none of the new fields must still work unchanged.
code, plain = call("POST", "/medicines/", {
    "name": "Vitamin D", "dosage": "1 capsule", "times": ["20:00"],
    "startDate": (TODAY - timedelta(days=20)).isoformat(),
    "endDate": (TODAY + timedelta(days=20)).isoformat(),
}, token=p_token)
check("a medicine with no routine still saves", code == 201, f"got {code} {plain}")
check("routine defaults to 'anytime'", plain.get("routine") == "anytime", f"got {plain.get('routine')}")
check("mealRelation defaults to 'none'", plain.get("mealRelation") == "none", f"got {plain.get('mealRelation')}")
check("critical defaults to false", plain.get("critical") is False, f"got {plain.get('critical')}")

# A second critical medicine with no dose records at all. Yesterday's dose is
# unanswered whatever time of day the test runs at, which is what makes the
# caregiver alert checks below deterministic.
code, warfarin = call("POST", "/medicines/", {
    "name": "Warfarin",
    "dosage": "1 tablet (5 mg)",
    "frequency": "Once a day",
    "times": ["09:00"],
    "startDate": (TODAY - timedelta(days=20)).isoformat(),
    "endDate": (TODAY + timedelta(days=20)).isoformat(),
    "routine": "dinner",
    "mealRelation": "with",
    "critical": True,
}, token=p_token)
check("a second critical medicine saves", code == 201, f"got {code} {warfarin}")

# ---------------------------------------------------------------------------
print("\n3. Medicine report")
# Two days of answers: yesterday taken (late), the day before skipped.
yesterday = (TODAY - timedelta(days=1)).isoformat()
two_days = (TODAY - timedelta(days=2)).isoformat()
call("POST", "/history/", {
    "medicineId": critical_id, "time": "08:00", "date": yesterday, "status": "taken",
    "recordedAt": f"{yesterday}T09:30:00Z",
}, token=p_token)
call("POST", "/history/", {
    "medicineId": critical_id, "time": "08:00", "date": two_days, "status": "skipped",
}, token=p_token)

code, report = call("GET", "/reports/?range=week", token=p_token)
check("report returns 200", code == 200, f"got {code} {report}")
check("report carries a summary", isinstance(report.get("summary"), dict), f"got {report.get('summary')}")
summary = report.get("summary", {})
check("summary counts every metric", {"expected", "taken", "late", "skipped", "missed", "adherence"} <= set(summary), f"keys={list(summary)}")
check("the taken dose is counted", summary.get("taken", 0) >= 1, f"taken={summary.get('taken')}")
check("the skipped dose is counted", summary.get("skipped", 0) >= 1, f"skipped={summary.get('skipped')}")
check("a dose answered 90 min late counts as late", summary.get("late", 0) >= 1, f"late={summary.get('late')}")
check("late doses are a subset of taken, never added", summary["late"] <= summary["taken"], f"late={summary['late']} taken={summary['taken']}")
check("unanswered past doses count as missed", summary.get("missed", 0) >= 1, f"missed={summary.get('missed')}")
check("adherence is a percentage", summary.get("adherence") is None or 0 <= summary["adherence"] <= 100, f"got {summary.get('adherence')}")
check("counts never exceed what was scheduled", summary["taken"] + summary["skipped"] + summary["missed"] + summary["pending"] == summary["expected"], f"got {summary}")

check("the week's daily series has 7 days", len(report.get("daily", [])) == 7, f"got {len(report.get('daily', []))}")
check("a weekly trend series is included", isinstance(report.get("weekly"), list) and report["weekly"], "missing")
check("a monthly trend series is included", isinstance(report.get("monthly"), list) and report["monthly"], "missing")
check("a per-medicine breakdown is included", any(m["name"] == "Amlodipine" for m in report.get("medicines", [])), f"got {[m.get('name') for m in report.get('medicines', [])]}")
check("today's schedule is included", isinstance(report.get("today"), list), f"got {type(report.get('today'))}")
check("the report names the patient", report.get("patient", {}).get("email") == PATIENT["email"].lower(), f"got {report.get('patient')}")

code, month = call("GET", "/reports/?range=month", token=p_token)
check("month range covers 30 days", len(month.get("daily", [])) == 30, f"got {len(month.get('daily', []))}")
code, allr = call("GET", "/reports/?range=all", token=p_token)
check("all range returns 200", code == 200, f"got {code}")
code, bogus = call("GET", "/reports/?range=fortnight", token=p_token)
check("an unknown range falls back to the week", bogus.get("range") == "week", f"got {bogus.get('range')}")
code, body = call("GET", "/reports/")
check("report needs a token (401)", code == 401, f"got {code}")

# ---------------------------------------------------------------------------
print("\n4. Prescription scanner")
code, body = call("GET", "/catalog/scan/", token=p_token)
check("scan reports whether image OCR is available", code == 200 and "imageSupported" in body, f"got {code} {body}")
print(f"        (image OCR on this server: {body.get('imageSupported')})")

slip = "\n".join([
    "Grande Hospital, Kathmandu",
    "Patient: Sita Sharma      Age: 62",
    "Tab. Paracetamol 500mg  1-0-1  after meal  x 5 days",
    "Cap. Amoxicillin 250 mg  TDS  for 7 days",
    "Atorvastatin 10mg  HS",
])
code, scan = call("POST", "/catalog/scan/", {"text": slip}, token=p_token)
check("scan returns 200", code == 200, f"got {code} {scan}")
found = {m["name"].lower(): m for m in scan.get("medicines", [])}
check("the letterhead is not read as a medicine", not any("hospital" in n for n in found), f"got {list(found)}")
check("the patient line is not read as a medicine", not any("sita" in n for n in found), f"got {list(found)}")

para = next((m for m in scan["medicines"] if "paracetamol" in m["name"].lower()), None)
check("paracetamol is recognised", para is not None, f"got {list(found)}")
if para:
    check("its strength is read", para["strength"].startswith("500"), f"got {para['strength']}")
    check("'1-0-1' becomes a morning and evening schedule", para["times"] == ["08:00", "19:00"], f"got {para['times']}")
    check("'after meal' becomes the meal relation", para["mealRelation"] == "after", f"got {para['mealRelation']}")
    check("'x 5 days' becomes a duration", para["durationDays"] == 5, f"got {para['durationDays']}")
    check("a dosage string is prefilled", "500" in para["dosage"], f"got {para['dosage']}")
    check("it is matched to the shared catalog", bool(para["catalogId"]), f"got {para['catalogId']}")

amox = next((m for m in scan["medicines"] if "amoxicillin" in m["name"].lower()), None)
check("amoxicillin is recognised", amox is not None, f"got {list(found)}")
if amox:
    check("'TDS' becomes three doses a day", len(amox["times"]) == 3, f"got {amox['times']}")
    check("'for 7 days' becomes a duration", amox["durationDays"] == 7, f"got {amox['durationDays']}")

statin = next((m for m in scan["medicines"] if "atorvastatin" in m["name"].lower()), None)
check("atorvastatin is recognised", statin is not None, f"got {list(found)}")
if statin:
    check("'HS' becomes the bedtime routine", statin["routine"] == "bedtime", f"got {statin['routine']}")

# OCR mangles brand names constantly; a near miss must still resolve.
code, fuzzy = call("POST", "/catalog/scan/", {"text": "Tab. Paracetarnol 500mg BD"}, token=p_token)
misread = fuzzy.get("medicines", [{}])[0] if fuzzy.get("medicines") else {}
check("a misread name still resolves to the catalog entry", misread.get("name", "").lower().startswith("paracetamol"), f"got {misread.get('name')}")

code, empty = call("POST", "/catalog/scan/", {"text": "just some words with no medicine here"}, token=p_token)
check("text with no medicine returns an empty list, not an error", code == 200 and empty["medicines"] == [], f"got {code} {empty}")
code, body = call("POST", "/catalog/scan/", {}, token=p_token)
check("a request with neither image nor text is rejected (400)", code == 400, f"got {code}")
code, body = call("POST", "/catalog/scan/", {"text": slip})
check("scan needs a token (401)", code == 401, f"got {code}")

# ---------------------------------------------------------------------------
print("\n5. Caregiver monitoring")
code, body = call("POST", "/auth/register/", CARER)
assert code == 201, f"could not register the caregiver: {code} {body}"
c_token = body["access"]

code, body = call("GET", "/caregivers/patients/", token=c_token)
check("a new caregiver watches nobody", code == 200 and listing(body) == [], f"got {code} {body}")

code, link = call("POST", "/caregivers/", {
    "caregiverEmail": CARER["email"], "caregiverName": "Ram", "relationship": "Son",
}, token=p_token)
check("the patient can invite a caregiver", code == 201, f"got {code} {link}")
check("an existing account goes live at once", link.get("status") == "active", f"got {link.get('status')}")
check("the link says the caregiver has an account", link.get("hasAccount") is True, f"got {link.get('hasAccount')}")
link_id = link["id"]

code, body = call("POST", "/caregivers/", {"caregiverEmail": PATIENT["email"]}, token=p_token)
check("you cannot be your own caregiver (400)", code == 400, f"got {code} {body}")

code, body = call("POST", "/caregivers/", {
    "caregiverEmail": f"notyet{stamp}@example.com", "caregiverName": "Future",
}, token=p_token)
check("inviting an unregistered email stays pending", body.get("status") == "pending", f"got {body.get('status')}")
check("a pending invite carries a code to read out", bool(body.get("inviteCode")), f"got {body.get('inviteCode')}")
check("an active link exposes no code", link.get("inviteCode") is None, f"got {link.get('inviteCode')}")
pending_code = body["inviteCode"]

code, body = call("GET", "/caregivers/patients/", token=c_token)
patients = listing(body)
check("the caregiver now sees the patient", any(p["id"] == link_id for p in patients), f"got {patients}")
check("the patient is named", patients and patients[0]["patientName"] == PATIENT["name"], f"got {patients}")

code, view = call("GET", f"/caregivers/patients/{link_id}/?range=week", token=c_token)
check("the caregiver can read the patient's report", code == 200, f"got {code} {view}")
check("it names the patient, not the caregiver", view.get("patient", {}).get("email") == PATIENT["email"].lower(), f"got {view.get('patient')}")
check("it shows the patient's medicines", any(m["name"] == "Amlodipine" for m in view.get("medicines", [])), f"got {[m.get('name') for m in view.get('medicines', [])]}")
check("it shows the patient's schedule", isinstance(view.get("today"), list), f"got {type(view.get('today'))}")
check("it shows the same adherence the patient sees", view["summary"]["taken"] == summary["taken"], f"{view['summary']['taken']} vs {summary['taken']}")

check("an unanswered critical dose raised an alert", len(view.get("alerts", [])) >= 1, f"got {view.get('alerts')}")
if view.get("alerts"):
    alert = next((a for a in view["alerts"] if a["medicineName"] == "Warfarin"), None)
    check("the alert names the medicine", alert is not None, f"got {[a.get('medicineName') for a in view['alerts']]}")
    check("the alert carries a readable message", alert and "Warfarin" in (alert.get("message") or ""), f"got {alert and alert.get('message')}")
    check("the alert starts unread", alert and alert.get("readAt") is None, f"got {alert and alert.get('readAt')}")
    check("an answered dose raises nothing", not any(
        a["medicineName"] == "Amlodipine" and a["date"] in (yesterday, two_days) for a in view["alerts"]
    ), f"got {[(a['medicineName'], a['date']) for a in view['alerts']]}")

code, alerts = call("GET", "/caregivers/alerts/", token=c_token)
alert_list = listing(alerts)
check("the caregiver's alert feed returns 200", code == 200, f"got {code}")
check("alerts appear in the feed", len(alert_list) >= 1, f"got {alert_list}")
before = len(alert_list)
call("GET", "/caregivers/alerts/", token=c_token)
code, again = call("GET", "/caregivers/alerts/", token=c_token)
check("re-checking never duplicates an alert", len(listing(again)) == before, f"{len(listing(again))} vs {before}")

# Only critical medicines alert, or the feed becomes noise.
check("only critical medicines raise alerts", all(
    a["medicineName"] in {"Amlodipine", "Warfarin"} for a in alert_list
), f"got {[a['medicineName'] for a in alert_list]}")
check("the non-critical medicine never alerts", not any(
    a["medicineName"] == "Vitamin D" for a in alert_list
), f"got {[a['medicineName'] for a in alert_list]}")

alert_id = alert_list[0]["id"]
code, body = call("POST", f"/caregivers/alerts/{alert_id}/read/", token=c_token)
check("an alert can be marked read", code == 200 and body.get("readAt"), f"got {code} {body}")
code, body = call("GET", "/caregivers/alerts/?unread=true", token=c_token)
check("the read alert leaves the unread feed", all(a["id"] != alert_id for a in listing(body)), f"got {listing(body)}")
code, body = call("POST", "/caregivers/alerts/read-all/", token=c_token)
check("every alert can be cleared at once", code == 200, f"got {code} {body}")
code, body = call("GET", "/caregivers/alerts/?unread=true", token=c_token)
check("nothing is left unread", listing(body) == [], f"got {listing(body)}")

# --- the read-only boundary ---
print("\n5b. The caregiver's access is read-only, and only to their patient")
code, body = call("PATCH", f"/medicines/{critical_id}/", {"name": "hijacked"}, token=c_token)
check("a caregiver cannot edit the patient's medicine (404)", code == 404, f"got {code}")
code, body = call("GET", "/medicines/", token=c_token)
check("the patient's medicines stay out of the caregiver's own list", listing(body) == [], f"got {listing(body)}")
code, body = call("POST", "/history/", {"medicineId": critical_id, "time": "08:00", "date": TODAY.isoformat(), "status": "taken"}, token=c_token)
check("a caregiver cannot answer a dose for the patient (400)", code == 400, f"got {code}")

code, stranger = call("POST", "/auth/register/", {
    "name": "Stranger", "email": f"stranger{stamp}@example.com", "password": "Str0ngPass!23",
})
s_token = stranger["access"]
code, body = call("GET", f"/caregivers/patients/{link_id}/", token=s_token)
check("a stranger cannot read the patient view (404)", code == 404, f"got {code}")
code, body = call("GET", "/caregivers/alerts/", token=s_token)
check("a stranger sees no alerts", listing(body) == [], f"got {listing(body)}")
code, body = call("POST", "/caregivers/accept/", {"code": "ZZZZZZZZ"}, token=s_token)
check("an unrecognised invite code is rejected (400)", code == 400, f"got {code}")

# --- redeeming an invitation sent before signup ---
print("\n5c. An invitation sent before the caregiver had an account")
code, latecomer = call("POST", "/auth/register/", {
    "name": "Future Carer", "email": f"notyet{stamp}@example.com", "password": "Str0ngPass!23",
})
l_token = latecomer["access"]
code, body = call("POST", "/caregivers/accept/", {"code": pending_code}, token=l_token)
check("the invite code is redeemed (201)", code == 201, f"got {code} {body}")
code, body = call("GET", "/caregivers/patients/", token=l_token)
check("they now watch the patient", len(listing(body)) == 1, f"got {listing(body)}")
code, body = call("POST", "/caregivers/accept/", {"code": pending_code}, token=s_token)
check("someone else cannot redeem the same code (400)", code == 400, f"got {code}")

# --- revoking ---
print("\n5d. Revoking access")
code, body = call("DELETE", f"/caregivers/{link_id}/", token=p_token)
check("the patient can revoke access (204)", code == 204, f"got {code} {body}")
code, body = call("GET", "/caregivers/patients/", token=c_token)
check("the revoked caregiver watches nobody", listing(body) == [], f"got {listing(body)}")
code, body = call("GET", f"/caregivers/patients/{link_id}/", token=c_token)
check("the patient view is gone (404)", code == 404, f"got {code}")
code, body = call("GET", "/caregivers/alerts/", token=c_token)
check("their alerts are gone with it", listing(body) == [], f"got {listing(body)}")

code, body = call("POST", "/caregivers/", {"caregiverEmail": CARER["email"], "relationship": "Son"}, token=p_token)
check("re-inviting reuses the link rather than failing", code == 201 and body["id"] == link_id, f"got {code} {body}")
check("the re-invited caregiver is active again", body.get("status") == "active", f"got {body.get('status')}")

print(f"\n{'=' * 52}\n  {passed} passed, {failed} failed\n{'=' * 52}\n")
sys.exit(1 if failed else 0)
