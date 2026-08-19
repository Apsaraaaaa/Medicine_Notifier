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
├── accounts/              User model + register / login / profile / password
├── catalog/               shared medicine catalog + /api/catalog/ search
├── medicines/             Medicine model + /api/medicines/
├── reminders/             dose records + /api/history/
└── scripts/
    ├── create_db.py       provisions the PostgreSQL database + app role
    └── smoke_test.py      end-to-end API test against a running server
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
| PATCH | `/api/auth/profile/` | update the display name |
| POST | `/api/auth/change-password/` | `{old_password, new_password}` |
| POST | `/api/auth/refresh/` | exchange a refresh token for a new access token |
| GET | `/api/catalog/?q=para&limit=8` | autocomplete over the shared medicine catalog |
| GET | `/api/catalog/<id>/` | one catalog entry |
| GET/POST | `/api/medicines/` | list / create; `?active=true` filters |
| GET/PUT/PATCH/DELETE | `/api/medicines/<id>/` | one medicine |
| GET/POST | `/api/history/` | dose records; `?medicineId= &status= &from= &to=` |
| GET/PUT/PATCH/DELETE | `/api/history/<id>/` | one dose record |

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
  "active": true
}
```

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
- **No CORS middleware.** The client is a native app and sends no `Origin`
  header. Add `django-cors-headers` back only if a browser client appears.
