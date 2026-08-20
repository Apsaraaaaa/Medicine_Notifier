# Medicine Notifier — Django REST backend

JWT-authenticated REST API for the React Native app in [`../mobile`](../mobile).
Python 3.12 · Django 5.2 · Django REST Framework · SimpleJWT · PostgreSQL 18.

## Layout

```
backend/
├── venv/                  virtual environment (not committed)
├── manage.py
├── requirements.txt
├── .env                   real secrets (git-ignored)
├── .env.example           template
├── config/                settings, root urls, wsgi/asgi, shared viewset
├── accounts/              User model (name, email, language) + auth endpoints
├── catalog/               shared medicine catalog, search, and scan.py —
│                          the prescription parser behind /api/catalog/scan/
├── medicines/             Medicine model (incl. routine, meal, critical)
├── reminders/             dose records + reports.py, the adherence engine
├── caregivers/            access links, the caregiver's patient view,
│                          and missed-dose alerts
└── scripts/
    ├── create_db.py       provisions the PostgreSQL database + app role
    ├── smoke_test.py      end-to-end API test against a running server
    └── smoke_test_features.py
                           the same, for language, routines, reports,
                           the scanner and caregiver monitoring
```

## 1. Environment

```powershell
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
copy .env.example .env
venv\Scripts\python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

Paste that key into `SECRET_KEY` in `.env`.

## 2. PostgreSQL

One command — it creates the database and a dedicated role, then writes the
generated password into `.env`:

```powershell
venv\Scripts\python scripts\create_db.py --superuser-password "YOUR_POSTGRES_PASSWORD"
```

Prefer doing it by hand? `scripts\create_db.py --show-sql` prints the
equivalent SQL to run in `psql -U postgres`, after which you fill in `DB_USER`
and `DB_PASSWORD` in `.env` yourself.

## 3. Migrate and run

```powershell
venv\Scripts\python manage.py migrate
venv\Scripts\python manage.py createsuperuser     # optional, for /admin/
venv\Scripts\python manage.py runserver 0.0.0.0:8000
```

`0.0.0.0` matters: it is what lets the Android emulator (via `10.0.2.2`) and a
physical phone on the same Wi-Fi reach the API. `localhost` would only accept
connections from the development machine itself.

Verify the whole surface against the running server:

```powershell
venv\Scripts\python scripts\smoke_test.py
venv\Scripts\python scripts\smoke_test_features.py
```

## API

Everything is mounted under `/api/`. All routes except register, login and
token refresh require `Authorization: Bearer <access token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | service index: status, database reachability, endpoint list |
| POST | `/api/auth/register/` | create an account → `{access, refresh, user}` |
| POST | `/api/auth/login/` | sign in → `{access, refresh, user}` |
| POST | `/api/auth/logout/` | blacklist a refresh token |
| GET | `/api/auth/me/` | the signed-in user |
| PATCH | `/api/auth/profile/` | update the display name or `language` (`en` / `ne`) |
| POST | `/api/auth/change-password/` | `{old_password, new_password}` |
| POST | `/api/auth/refresh/` | exchange a refresh token for a new access token |
| GET | `/api/catalog/?q=para&limit=8` | autocomplete over the shared medicine catalog |
| GET | `/api/catalog/<id>/` | one catalog entry |
| GET | `/api/catalog/scan/` | whether this server can read a photograph |
| POST | `/api/catalog/scan/` | a box or prescription → fields to prefill the form |
| GET/POST | `/api/medicines/` | list / create; `?active=true` filters |
| GET/PUT/PATCH/DELETE | `/api/medicines/<id>/` | one medicine |
| GET/POST | `/api/history/` | dose records; `?medicineId= &status= &from= &to=` |
| GET/PUT/PATCH/DELETE | `/api/history/<id>/` | one dose record |
| GET | `/api/reports/?range=week\|month\|all` | the medicine report: taken / missed / late / adherence, trends, per medicine |
| GET/POST | `/api/caregivers/` | who may watch this user; POST invites by email |
| PATCH/DELETE | `/api/caregivers/<id>/` | edit a link; DELETE revokes access |
| POST | `/api/caregivers/accept/` | `{code}` — redeem an invitation |
| GET | `/api/caregivers/patients/` | who this user watches over |
| GET | `/api/caregivers/patients/<id>/` | one patient's report, schedule and alerts |
| GET | `/api/caregivers/alerts/` | alerts raised for this caregiver; `?unread=true` |
| POST | `/api/caregivers/alerts/<id>/read/` | mark one as seen |
| POST | `/api/caregivers/alerts/read-all/` | mark every alert as seen |

### Shape of the JSON

The serializers speak the app's camelCase and render ids as strings, so
`mobile/types.ts` needs no translation layer:

```json
{
  "id": "3",
  "name": "Metformin",
  "dosage": "500 mg",
  "notes": "Take with food",
  "frequency": "Twice a day",
  "times": ["08:00", "20:00"],
  "startDate": "2026-08-01",
  "endDate": "2026-12-31",
  "color": "#7B61D9",
  "routine": "breakfast",
  "mealRelation": "after",
  "critical": true,
  "active": true
}
```

`routine` is one of `anytime` · `breakfast` · `lunch` · `dinner` · `bedtime`,
and `mealRelation` one of `none` · `before` · `with` · `after`. Both default on
the model, so a client that sends neither keeps working unchanged. `critical`
marks a medicine whose unanswered doses alert a caregiver.

## The catalog vs. a user's medicines

Two different things, deliberately kept in separate apps:

| | `catalog.CatalogMedicine` | `medicines.Medicine` |
| --- | --- | --- |
| What it is | the shared dictionary: "Paracetamol 500 mg, tablet" | one person's prescription: dose, times, dates |
| Who owns it | nobody — reference data | exactly one user |
| Written by | the admin, or `manage.py seed_catalog` | the app |
| API | read-only | full CRUD, scoped to the owner |

A `Medicine` may point at a catalog entry through `catalog_item`, but it copies
the name it was created with. The link is `SET_NULL`, so retiring or editing a
catalog entry can never rewrite or delete somebody's prescription.

Seed or refresh the catalog (idempotent — safe to re-run):

```powershell
venv\Scripts\python manage.py seed_catalog
venv\Scripts\python manage.py seed_catalog --clear   # also drop entries no longer listed
```

## How adherence is counted

`reminders/reports.py` is the single definition, and the report screen, the PDF
export and a caregiver's view of the same person all read it — one calculation,
three readers, so they cannot disagree.

| | Means |
| --- | --- |
| **expected** | a scheduled dose: one entry in `times` on a day the course runs |
| **taken** | answered "taken" |
| **late** | taken more than 15 minutes after its time — a *subset* of taken, never added to it |
| **skipped** | answered "skipped": a deliberate decision, not a failure |
| **missed** | answered "missed", or unanswered more than 60 minutes past its time |
| **pending** | still inside its grace period, or later today |

`adherence = taken / expected`. Skipped doses are reported but never counted as
taken: the figure answers "did the plan happen?", not "was there a reason?".

The mobile app derives the same figures locally for the home screen
(`mobile/utils/insights.ts`), against the same two constants — 60 minutes to
missed, 15 to late. If one moves, the other must.

## The scanner

Two separable halves, which is what lets the feature always work:

- **Extraction** (`catalog/scan.py`) turns text into form fields. Pure Python,
  no dependencies. It reads strengths, dosing patterns (`1-0-1`, `BD`, `TDS`,
  `HS`), meal timing, course length (`x 5 days`), and resolves names against
  the shared catalog — with a fuzzy second pass, so a misread "Paracetarnol"
  still finds Paracetamol. Letterhead and patient lines are filtered out.
- **Recognition** turns a photograph into that text, and needs Tesseract:

  ```powershell
  venv\Scripts\pip install pytesseract Pillow
  # plus the binary, which is not a pip package:
  #   Windows        https://github.com/UB-Mannheim/tesseract/wiki
  #   Debian/Ubuntu  sudo apt install tesseract-ocr tesseract-ocr-nep
  ```

Without it, `POST /api/catalog/scan/` still parses `{"text": "..."}` typed off
the box, and `GET /api/catalog/scan/` tells the app which routes to offer.
Nothing is ever saved here — the response is a suggestion the user confirms in
the normal Add Medicine form.

## Caregiver access

`caregivers.CaregiverLink` is the entire permission model: one row, created by
the patient, revocable by the patient, read-only for the caregiver.

- `link.patient` takes the medicine and owns the data. `link.caregiver` watches
  over them and may only read.
- Inviting an email that already has an account activates the link at once —
  the patient granting access is the consent that matters. An email with no
  account yet waits as `pending` with a short code to redeem after signing up.
- Alerts are raised only for medicines marked `is_critical`, and only once a
  dose is past its grace period unanswered. There is no scheduler: the check
  runs on every read of the caregiver endpoints, and a unique constraint on
  (link, medicine, date, time) means re-running it can never duplicate one.
- Deleting a link marks it `revoked` rather than removing the row, so the
  patient can still see that they once shared, and re-inviting reuses it.

## Rules worth knowing

- **Ownership.** Every queryset filters on `request.user`; another user's id
  returns 404 rather than 403, so the API never confirms which ids exist.
- **Catalog ranking.** Search scores by where the match lands — exact name,
  then name prefix, then generic-name prefix, then anywhere — so "para" puts
  *Paracetamol* above *Paracetamol + Caffeine*.
- **Times** are stored as a `jsonb` array of `"HH:MM"` strings, normalised and
  sorted on write, because the phone compares them as strings.
- **Dose records keep a snapshot** of the medicine's name and dosage, so
  deleting a medicine leaves its adherence history readable.
- **A caregiver can never write.** Their access is one GET endpoint. Recording
  that a dose was taken stays with the person who took it.
- **Alert generation is idempotent** by database constraint, not by care —
  which is what makes it safe to run on every request instead of on a schedule.
- **No CORS middleware.** The client is a native app and sends no `Origin`
  header. Add `django-cors-headers` back only if a browser client appears.
