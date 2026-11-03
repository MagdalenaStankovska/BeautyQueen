
# BeautyQueen

Appointment booking app for the Beauty Queen Studio salon: clients request appointments, the admin accepts or rejects them, and everyone is notified in real time. It installs on phones as a PWA (Progressive Web App).

---

## Features

### Clients
- Book in three steps: **service → date → time**. The whole day is shown; times that can't be booked stay visible but greyed out, and tapping one explains why (e.g. "the pedicure chair is busy 14:45–16:00"). Availability updates live when someone else books.
- Optional note with the request (colour, design, special requests).
- "My appointments" with status, assigned staff member, history, and cancel-with-reason.
- Real-time notifications when an appointment is **accepted / rejected / cancelled by the salon**.
- **Reminders 1 day and 1 hour before** each confirmed appointment, as an in-app notification and as a push notification even when the app is closed.
- Profile: name, phone, password change, notifications toggle, "install app" button.

### Admin
- Dashboard: new requests, appointments today, next 7 days.
- Accept (optionally assigning a staff member) or reject with a reason the client sees. A conflict warning appears if the slot is already full.
- Real-time notification and sound for every new request or cancellation, plus quick accept/reject straight from the notification.
- Day schedule with staff assignment (dropdown, or drag & drop on desktop), cancel and delete.
- **Manual booking** for phone or walk-in clients.
- Gallery management: upload or delete photos for each service category from the Services page.

### Platform
- Socket.IO websockets for live updates; reconnects and catches up automatically.
- Web Push (VAPID) via a service worker for notifications when the app is closed.
- All business rules live in **`backend/salon-config.js`**: opening hours, services and durations, staff, stations, minimum notice. The app loads them from `GET /config`, so that one file is the only place to edit them.
- Server-side validation: a service must fit inside opening hours, at least 30 min notice, at most 90 days ahead. Per-station capacity (2 manicure tables, 1 pedicure chair, 1 bed, 1 lash station, 1 brow station) and staff capacity (no more parallel clients than staff) make double bookings impossible.
- Mobile-first layout with a bottom tab bar, and back-button friendly navigation.

---

## Running locally

```bash
# backend (http://localhost:4000)
cd backend
npm install
npm start

# frontend (http://localhost:3000)
cd my-react-app
npm install --legacy-peer-deps
npm start
```

Admin accounts are the emails listed in `ADMIN_EMAILS` (default `marija.stankovska@yahoo.com`).

### Configuration
- `backend/.env`: see `backend/.env.example` (NODE_ENV, JWT secret, admin emails, CORS origin, data directory, proxy, time zone). VAPID keys for push are generated into `$DATA_DIR/vapid.json` on first start. Keep that file, because regenerating it invalidates existing push subscriptions.
- `my-react-app/.env`: see `my-react-app/.env.example` (`REACT_APP_API_URL`).

### Project layout
| Path | What |
|---|---|
| `backend/app.js` | API, sockets, reminders, built by `createApp()` (used by both the server and the tests) |
| `backend/server.js` | Entry point: env, start, graceful shutdown |
| `backend/salon-config.js` | Business rules (hours, services, staff, stations) |
| `backend/tests/` | Jest unit + integration + socket tests |
| `my-react-app/src/salon.js` | Same scheduling rules for the UI (loaded live from `/config`) |
| `e2e/` | Playwright end-to-end tests |

## Testing

```bash
cd backend && npm test             # 95 unit/integration/socket tests
cd backend && npm run test:coverage
cd backend && npm run lint

cd my-react-app && npx react-scripts test --watchAll=false   # unit + component tests

cd e2e && npm install && npm run test:all   # builds the UI, starts a throw-away API, runs Playwright in local Chrome
```

All tests run against temporary data folders and never touch the real JSON files.

## Production

- `GET /health` returns status, uptime and counts, for uptime monitors and load balancers.
- SIGTERM/SIGINT trigger a graceful shutdown (timers stop, sockets close).
- The server refuses to start in production without `JWT_SECRET` (32+ characters) and `CLIENT_ORIGIN`. It also refuses to start if a data file is corrupt, so data can never be silently overwritten with empty data.
- Security: helmet headers, CORS limited to `CLIENT_ORIGIN`, rate limiting on login, register and password change, bcrypt password hashing, input length limits, image-only uploads (no SVG), path-traversal-safe deletes.
- Build the frontend with `REACT_APP_API_URL=https://your-api npm run build` and serve `my-react-app/build` over HTTPS.

### Testing from a phone
Push notifications and installing the app need **HTTPS** (or `localhost`). For a real device, deploy behind HTTPS or use a tunnel (e.g. `ngrok http 3000` plus one for port 4000, then set `REACT_APP_API_URL`). On iPhone, push works only after **Share → Add to Home Screen** (iOS 16.4+).
