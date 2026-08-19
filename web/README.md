# Medicine Notifier — website

Public site and account pages. React + Vite + TypeScript + Tailwind v4 + React Router.

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `pages/Home.tsx` | Hero, reminder visual, feature summary, CTA |
| `/about` | `pages/About.tsx` | What it is, why it exists, who it's for |
| `/features` | `pages/Features.tsx` | All seven features |
| `/how-it-works` | `pages/HowItWorks.tsx` | The four-step setup |
| `/contact` | `pages/Contact.tsx` | Message form + contact details |
| `/login`, `/signup` | `pages/Login.tsx`, `pages/Signup.tsx` | Account pages, wired to the API client |
| `/privacy`, `/terms` | `pages/Legal.tsx` | Footer legal pages |

## Connecting the Django API

`src/lib/api.ts` is the only file that talks to the network. It reads the base URL from an
environment variable:

```bash
cp .env.example .env.local     # then edit if your API is elsewhere
# VITE_API_URL=http://127.0.0.1:8000/api
```

It expects `{ access, refresh?, user }` from `/auth/login/` and `/auth/register/`, stores the token
in `localStorage`, and sends `Authorization: Bearer <token>` on later requests. Django REST field
errors (`{"email": ["..."]}`) are mapped onto the matching form fields automatically.

## Design notes

- Tokens live at the top of `src/index.css`; change a colour there, not in components.
- 17px base type, 44px+ tap targets, one visible focus style, `prefers-reduced-motion` respected.
- Icons are inline SVG (`components/icons.tsx`) — no icon font, no CDN request.
