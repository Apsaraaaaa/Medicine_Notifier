# Medicine Notifier

An Android medicine reminder app: you enter each medicine, its dose and the
times of day to take it, the phone rings at each of those times, and every
answer you give is recorded so you can see how closely you are keeping to plan.

```
Android phone / emulator
        ↓
React Native + Expo (mobile/)
        ↓
Django REST API (backend/)
        ↓
PostgreSQL
```

## Project structure

```
Medicine_Notifier/
│
├── mobile/                    React Native + Expo + TypeScript
│   ├── app/                   expo-router routes
│   │   ├── _layout.tsx        providers, auth gate, reminder sheet
│   │   ├── login.tsx          sign in / sign up
│   │   ├── settings.tsx       reminders, alarm sound, password
│   │   ├── (tabs)/            home · medicines · history · profile
│   │   └── medicine/          new.tsx · [id].tsx (add / edit)
│   ├── components/            UI kit and feature components
│   ├── constants/theme.ts     colour tokens, light + dark
│   ├── context/               app state, auth, reminder scheduler
│   ├── notifications/         expo-notifications + alarm sound
│   ├── services/api.ts        REST client for the Django API
│   ├── utils/                 dates, schedule, adherence maths, CSV export
│   ├── assets/                icons, splash, alarm tone
│   ├── package.json
│   ├── app.json
│   └── tsconfig.json
│
├── backend/                   Django + DRF + PostgreSQL
│   ├── manage.py
│   ├── config/                settings, urls, wsgi/asgi
│   ├── accounts/              user model + auth endpoints
│   ├── catalog/               shared medicine catalog + search
│   ├── medicines/             medicines endpoints
│   ├── reminders/             dose records ("history") endpoints
│   ├── scripts/               create_db.py · smoke_test.py
│   └── requirements.txt
│
└── web/                       marketing site — React + Vite + react-router
    ├── src/pages/             Home · About · Features · How It Works ·
    │                          Contact · Login · Signup · Legal
    ├── src/components/        header, footer, shared UI
    └── package.json
```

## The three things you run

| Part | Command | Where it appears |
| --- | --- | --- |
| **Backend** | `cd backend` → `venv\Scripts\python manage.py runserver 0.0.0.0:8000` | `http://127.0.0.1:8000/` · admin at `/admin/` |
| **Website** | `cd web` → `npm run dev` | `http://localhost:5173` (or 5174 if that port is taken) |
| **Mobile app** | `cd mobile` → `npx expo start`, then press `a` | Android emulator or Expo Go |

Start the backend first — the app and the website's login/contact forms both
call it. The website and the app are independent of each other.

## First-time setup

### 1. Backend

See [backend/README.md](backend/README.md) for the full walkthrough. Short
version, from the project root:

```powershell
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
copy .env.example .env                                   # then set SECRET_KEY
venv\Scripts\python scripts\create_db.py --superuser-password "YOUR_POSTGRES_PASSWORD"
venv\Scripts\python manage.py migrate
venv\Scripts\python manage.py createsuperuser            # optional, for /admin/
venv\Scripts\python manage.py runserver 0.0.0.0:8000
```

Open `http://127.0.0.1:8000/` to check it: that root URL reports the service
status, whether PostgreSQL is reachable, and the list of endpoints. The app
itself only uses `/api/…`, and `/admin/` is Django's admin site.

A 401 from `/api/medicines/` in a browser is the healthy response — those
endpoints need a token, which only the app sends.

### 2. Mobile app

From `mobile/`:

```powershell
npm install
npx expo start
```

Then press `a` to open it on an Android emulator (start one from Android
Studio's Device Manager first), or scan the QR code with Expo Go on a phone
sharing the same Wi-Fi.

Reminders arrive while the app is closed only in a real build, because Expo Go
cannot own the notification channel. For that, build the app once:

```powershell
npx expo run:android          # debug build on the connected device/emulator
```

`npx expo start --web` also renders the app in a browser on port 8081. That is
the *app*, not the website — useful for checking layout, but reminders and the
alarm are Android-only.

### 3. Website

From `web/`:

```powershell
npm install
npm run dev                   # http://localhost:5173
npm run build                 # production bundle in web/dist/
```

Its login, signup and contact forms post to the Django API, so the backend must
be running. Because a browser sends an `Origin` header, those requests need the
site's address listed in `CORS_ALLOWED_ORIGINS` in
[backend/config/settings.py](backend/config/settings.py) — ports 5173, 5174 and
8081 are already there.

### How the app finds the API

`mobile/services/api.ts` resolves the base URL in this order:

1. `EXPO_PUBLIC_API_URL` if you set it (create `mobile/.env` with e.g.
   `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api`)
2. the LAN address Metro is already serving from, on port 8000 — which is what
   makes a physical phone work with no configuration at all
3. `http://10.0.2.2:8000/api` on an Android emulator (`10.0.2.2` is how the
   emulator reaches the host machine's `localhost`)

## What the app does

- **Home** — the next dose, today's adherence ring, and a timeline of the day
  that answers doses in place.
- **Medicines** — search and filter the list, add, edit and delete. Typing a
  name queries the shared catalog in PostgreSQL, so "para" offers Paracetamol
  500 mg, 650 mg and the syrup, and picking one fills in the dosage.
- **History & insights** — the week as seven tick-boxes with a progress bar, an
  adherence ring with the trend against the previous period, an adherence chart
  over longer ranges, and every recorded dose.
- **Profile & settings** — display name, dark mode, alarm sound and volume,
  password change, and CSV export of the full dose history via the share sheet.
- **Reminders** — each medicine time is scheduled with the OS, so a dose rings
  even when the app is closed. Tapping the notification opens the same sheet
  the in-app reminder uses: taken, skipped, missed, snooze, or add a note. Every
  answer is written to PostgreSQL and feeds the adherence figures immediately.

## Notes

- The app talks to the API for everything; only the session token and the local
  settings (theme, sound, volume) live on the device.
- A dose left unanswered for an hour counts as **missed**. Those are inferred
  from the schedule, so the charts stay honest without inventing records — but
  the reminder sheet also has an explicit "I missed this dose" button, and that
  one *is* stored, with the time it was answered.
- The medicine catalog is shared reference data with its own Django app; a
  user's medicine only *points* at it. See
  [backend/README.md](backend/README.md#the-catalog-vs-a-users-medicines).
- `mobile/package.json` carries `react-dom` and `react-native-web` for
  `expo start --web`, and pins `react-dom` through `overrides` so npm cannot
  resolve a copy that conflicts with the React version Expo requires.
