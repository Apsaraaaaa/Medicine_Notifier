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
│   │   ├── settings.tsx       language, reminders, alarm sound, password
│   │   ├── report.tsx         medicine report + PDF / CSV export
│   │   ├── scan.tsx           box & prescription scanner
│   │   ├── caregivers.tsx     give access · redeem an invite · alerts
│   │   ├── (tabs)/            home · medicines · history · profile
│   │   ├── medicine/          new.tsx · [id].tsx (add / edit)
│   │   └── monitor/[id].tsx   a patient, as their caregiver sees them
│   ├── components/            UI kit and feature components
│   ├── constants/theme.ts     colour tokens, routines, light + dark
│   ├── context/               app state, auth, language, reminder scheduler
│   ├── i18n/                  en.ts · ne.ts · the translator
│   ├── notifications/         expo-notifications + alarm sound
│   ├── services/api.ts        REST client for the Django API
│   ├── utils/                 dates, schedule, routines, adherence maths,
│   │                          CSV + PDF export, camera access
│   ├── assets/                icons, splash, alarm tone
│   ├── package.json
│   ├── app.json
│   └── tsconfig.json
│
├── backend/                   Django + DRF + PostgreSQL
│   ├── manage.py
│   ├── config/                settings, urls, wsgi/asgi
│   ├── accounts/              user model (incl. language) + auth endpoints
│   ├── catalog/               shared medicine catalog, search, scan parser
│   ├── medicines/             medicines endpoints (incl. routine fields)
│   ├── reminders/             dose records ("history") + the report engine
│   ├── caregivers/            access links, patient view, missed-dose alerts
│   ├── scripts/               create_db.py · smoke_test.py ·
│   │                          smoke_test_features.py
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

With the server running, two scripts check it end to end (stdlib only, no test
framework to install):

```powershell
venv\Scripts\python scripts\smoke_test.py             # the base API
venv\Scripts\python scripts\smoke_test_features.py    # language, routines,
                                                        # report, scanner,
                                                        # caregivers
```

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

- **Patient Mode** — a much larger, much simpler face on the same app, for the
  person actually taking the medicines. Home shows only the next medicine, its
  time and dose, and today's list; the reminder offers exactly two answers,
  **TAKEN** and **SNOOZE 5 MIN**; every dose carries a status you can read
  across a room — Taken, Snoozed or Missed. Turn it on in Settings; turning it
  off restores the full interface untouched. See
  [Patient Mode](#patient-mode).
- **English or Nepali** — one switch, on the login screen, in Profile and in
  Settings, written in both scripts so it is findable either way. It changes
  the whole app, including the reminders the phone has already scheduled and
  the alerts the server composes for a caregiver.
- **Home** — the next dose, today's adherence ring, and a timeline of the day
  that answers doses in place, viewable **by time** or **by routine**.
- **Medicines** — search and filter the list, add, edit and delete. Typing a
  name queries the shared catalog in PostgreSQL, so "para" offers Paracetamol
  500 mg, 650 mg and the syrup, and picking one fills in the dosage.
- **History & insights** — the week as seven tick-boxes with a progress bar, an
  adherence ring with the trend against the previous period, an adherence chart
  over longer ranges, and every recorded dose.
- **Medicine report** — taken, missed, late and skipped doses, the adherence
  percentage, weekly and monthly trends, and a per-medicine breakdown, over a
  week, a month or the whole record. Exports as **PDF or CSV** to the share
  sheet. Every figure comes from one server-side calculation, so the screen,
  the export and a caregiver's view of the same person always agree.
- **Routines** — a medicine can be organised around **Breakfast, Lunch, Dinner
  or Bedtime**, with **before / with / after meal**, alongside its exact times.
  Choosing a routine offers its usual hour; a medicine that names none is still
  grouped by the hour its dose actually falls in, so the routine view is
  complete without re-entering anything.
- **Scan a box or prescription** — photograph a medicine box or a prescription
  and the medicine name, strength, dosage, schedule and course length are read
  off it and used to fill in the Add Medicine form, which you then check and
  correct before saving. Nothing is stored until you press Save. See
  [Scanning](#scanning-a-box-or-prescription) for what the server needs.
- **Caregiver & family monitoring** — invite someone you trust by email. They
  see your schedule, your taken and missed doses and your adherence — read-only,
  always — and are alerted when a medicine you marked **important** goes
  unconfirmed past its grace period. Access is one row you can revoke at any
  time.
- **Profile & settings** — language, display name, dark mode, alarm sound and
  volume, password change, and CSV export of the full dose history via the
  share sheet.
- **Reminders** — each medicine time is scheduled with the OS, so a dose rings
  even when the app is closed. Tapping the notification opens the same sheet
  the in-app reminder uses: taken, skipped, missed, snooze, or add a note. Every
  answer is written to PostgreSQL and feeds the adherence figures immediately.

## Patient Mode

A presentation choice, not a permission. The data, the schedule, the reminders,
the API and the database are exactly the same underneath — Patient Mode only
changes what is on the screen, and the switch is reversible at any moment.

| | Normal | Patient Mode |
| --- | --- | --- |
| Home | next dose, adherence ring, filters, time/routine views | date, next medicine, its time and dose, today's list |
| Reminder | bottom sheet: taken · skipped · missed · snooze · note | **full screen**: **TAKEN** · **SNOOZE 5 MIN** |
| Snooze | 15 minutes | 5 minutes |
| My Medicines | search, filters, ⋮ menu | large cards with **Add**, **Edit**, **Delete** as buttons |
| History | adherence ring, trend, chart, week/month/all | this week, then each day with a tick or a cross |
| Voice | — | optionally speaks the medicine, dose and time |
| Tabs | Home · Medicines · ⊕ · History · Profile | Home · My Medicines · History · Settings |
| Body text | 17pt | 23pt (60pt for the dose time) |
| Touch targets | 52dp | 72dp and up |

What it deliberately does **not** do:

- **It hides nothing from the record.** A dose answered here writes the same
  history row through the same endpoint. Skipped and missed are still recorded
  from the full interface, and a dose left unanswered is still counted as
  missed an hour later by the same rule.
- **It adds no second copy of the data or the logic.** The patient screens are
  new layouts over the existing state, endpoints and maths: History reads the
  same `buildDailyStats` the full screen and the PDF report use, and Add / Edit
  / Delete open the same form and call the same API. Settings keeps the
  existing design; only the tab name is plainer.
- **Caregiver alerts are untouched.** A missed dose still raises the same alert
  to the same people, because Patient Mode never changed how a dose is
  recorded.
- **It does not remove the add-medicine button.** The raised ⊕ leaves the tab
  bar so the four tabs can grow, but adding a medicine is still one tap away in
  the My Medicines header.

### The voice reminder

Optional, off by default, switched on at Settings → Voice reminder. When a dose
comes due the phone says, in whichever language the app is set to:

> **औषधि खाने समय भयो। कृपया Paracetamol एक वटा खानुहोस्।**
> *It is time for your medicine. Please take Paracetamol, 1 tablet.*

and **keeps saying it until TAKEN or SNOOZE is pressed** — the same contract as
the alarm tone it plays beside, which also loops until the dose is answered.

Details that matter:

- **It starts and stops with the reminder, not with a screen.** The loop lives
  in `AppContext` next to `startAlarm`/`stopAlarm`, so the two can never get out
  of step and neither can outlive the dose.
- **It repeats on the engine's `onDone`, not on a timer**, so a long medicine
  name or a slow engine can never have two readings overlap.
- **The alarm ducks to a quarter while it talks**, then comes back up. The tone
  is what carries across a room; cutting it for every sentence would make the
  reminder come and go.
- **The medicine name is never translated** — it is what is printed on the box.
  The dose is: "1 tablet" is spoken as "एक वटा". Anything the rewriter does not
  recognise is spoken as written, because saying the dose awkwardly is fine and
  saying the wrong dose is not.
- **It degrades honestly.** Without `expo-speech` the row reads "this build has
  no speech engine". With an engine but no Nepali voice — the common case on
  Android — it says so and points at Android's Text-to-speech settings, rather
  than leaving somebody wondering why the phone is silent.

`Snoozed` is a real dose status added alongside taken/skipped/missed
(`DoseState` in `mobile/constants/theme.ts`). It is *derived*, not stored: a
snooze lives on the phone until it comes round again, so it never reaches the
database and never affects the adherence figures the report calculates.

## Scanning a box or prescription

The scanner is two separate jobs, and only one of them needs anything extra:

| | What it does | What it needs |
| --- | --- | --- |
| **Recognition** | photo → text | Tesseract on the server (optional) |
| **Extraction** | text → form fields | nothing — pure Python, always available |

`POST /api/catalog/scan/` accepts either an image or the label text, and both
land in the same parser. It reads strengths (`500mg`), dosing patterns
(`1-0-1`, `BD`, `TDS`, `HS`), meal timing (`after meal`), course length
(`x 5 days`), and resolves the name against the shared medicine catalog —
including near misses, so a misread "Paracetarnol" still finds Paracetamol.

Without an OCR engine the app simply asks you to type what the label says and
fills in the form from that. To turn on reading photographs as well:

```powershell
cd backend
venv\Scripts\pip install pytesseract Pillow
# plus the Tesseract binary itself, which is not a pip package:
#   Windows        https://github.com/UB-Mannheim/tesseract/wiki  (add to PATH)
#   Debian/Ubuntu  sudo apt install tesseract-ocr tesseract-ocr-nep
```

`GET /api/catalog/scan/` reports whether the server has an engine, and the app
offers the camera or asks for typing accordingly — so the feature is never a
dead end either way.

## Caregivers, and who can see what

A caregiver link is the whole permission model: one row, created by the
patient, revocable by the patient, and read-only for the caregiver.

- Invite by email. If that email already has an account the link is live at
  once — the patient granting access *is* the consent that matters. If it does
  not, the invitation waits with a short code the caregiver redeems after
  signing up.
- A caregiver can read `/api/caregivers/patients/<link>/` and nothing else.
  They cannot edit a medicine or answer a dose on the patient's behalf: a
  caregiver must not be able to record that a tablet was taken when they did
  not see it happen.
- Alerts are raised only for medicines the patient marked **important**, and
  only once a dose has gone unanswered past its grace period. There is no
  scheduler: the check runs whenever the caregiver endpoints are read, and a
  unique constraint means the same dose can never alert twice however often it
  runs.

## Notes

- The app talks to the API for everything; only the session token and the local
  settings (language, theme, sound, volume) live on the device. The language is
  also stored on the account, because the server composes caregiver alerts
  itself and has to know which one to write them in.
- A dose left unanswered for an hour counts as **missed**. Those are inferred
  from the schedule, so the charts stay honest without inventing records — but
  the reminder sheet also has an explicit "I missed this dose" button, and that
  one *is* stored, with the time it was answered.
- The medicine catalog is shared reference data with its own Django app; a
  user's medicine only *points* at it. See
  [backend/README.md](backend/README.md#the-catalog-vs-a-users-medicines).
- Adherence counts a dose as taken only when it was confirmed. A **skipped**
  dose is a deliberate decision and is reported separately; **late** means
  taken more than 15 minutes after the reminder and is a subset of taken, never
  added to it. `backend/reminders/reports.py` is the one place those
  definitions live.
- The report PDF is written directly rather than through a rendering library
  (`mobile/utils/pdf.ts`), which is why it is always in English: embedding a
  Devanagari font is the one thing that writer deliberately does not do. The
  on-screen report is fully translated.
- `mobile/package.json` carries `react-dom` and `react-native-web` for
  `expo start --web`, and pins `react-dom` through `overrides` so npm cannot
  resolve a copy that conflicts with the React version Expo requires.
