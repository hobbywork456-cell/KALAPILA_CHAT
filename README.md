# Kalapila – team chat, spaces & calls

Real-time messaging for web and Android.

- **Direct messages** with typing indicators, online / last-seen status and read receipts (✓ sent, ✓✓ blue = read)
- **Spaces**: group rooms joined with a room code or invite link. Each has a group chat, a member list and admin controls
- **Attachments**: photos, videos, documents (up to 25 MB), paste or drag-and-drop, plus **voice messages**
- **Reply, edit, delete for everyone, copy**, and **scheduled messages** (in your own time zone)
- **Voice & video calls** (WebRTC): ringing on all your devices, busy / offline / declined handling, mute, camera on/off mid-call, switch camera, screen share, speaker toggle
- Light / dark / auto theme, works on phones, installable as an app (PWA), and an **Android app** (Capacitor)

```
backend/   Node + Express + Socket.IO + MongoDB (Mongoose). Deploy on Render.
frontend/  React 19 + Vite + MUI. Deploy on Vercel. Android app in frontend/android (Capacitor 8).
```

---

## 1. Run locally

**Backend**

```bash
cd backend
npm install
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm run dev               # http://localhost:5000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev               # http://localhost:5172 (uses .env.development -> http://localhost:5000)
```

> Camera/microphone only work on `https://` or `localhost`. To test calls between a phone and your PC on the same Wi-Fi, use the deployed HTTPS site.

---

## 2. Deploy

### Backend (Render)

Set these **Environment variables** on the Render service:

| Key | Value |
| --- | --- |
| `MONGO_URI` | your MongoDB Atlas connection string |
| `JWT_SECRET` | **required** – any long random string (e.g. 64 random characters). Keeps logins secure. |
| `MAX_UPLOAD_MB` | optional, default `25` |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | optional, see *Calls on mobile data* below |

Build command `npm install`, start command `npm start`, root directory `backend`.

Uploaded files are stored **inside MongoDB (GridFS)**, so they survive Render restarts/redeploys.

### Frontend (Vercel)

Root directory `frontend`, framework *Vite*. `frontend/.env.production` points the app at `https://kalapila.onrender.com` – change it if your backend URL changes.

### Calls on mobile data (TURN server)

Calls connect directly between devices. On most Wi-Fi networks that works with no setup. On mobile data or strict office networks the devices may not reach each other and the call shows *“Couldn't connect the call”*. Fix it by adding a TURN relay (for example a free account at metered.ca → “TURN server”), then set on Render:

```
TURN_URLS=turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:443?transport=tcp
TURN_USERNAME=<from your TURN provider>
TURN_CREDENTIAL=<from your TURN provider>
```

---

## 3. Mobile app

### Option A – Install from the website (no build needed)

Open the Vercel site on your phone:

- **Android (Chrome)**: menu ⋮ → **Install app** / **Add to Home screen**
- **iPhone (Safari)**: Share → **Add to Home Screen**

It opens full-screen like a native app.

### Option B – Android APK built by GitHub (easiest real app)

1. Push this repo to GitHub.
2. On GitHub open **Actions → Build Android APK → Run workflow**.
3. When it finishes (about 5 minutes), download **kalapila-android-apk** from the run, unzip it, copy `app-debug.apk` to your phone and open it. Allow installing from unknown sources if asked.

### Option C – Build with Android Studio

Requirements: Android Studio (latest), JDK 21.

```bash
cd frontend
npm install
npm run android:sync     # builds the web app and copies it into the Android project
npm run android:open     # opens Android Studio -> Run ▶ on a phone or emulator
```

Every time you change the frontend code, run `npm run android:sync` again.

For the Play Store, use **Build → Generate Signed App Bundle** in Android Studio.

App ID: `com.kalapila.chat` (change in `frontend/capacitor.config.json` *before* the first release).

---

## 4. API overview

All routes except register/login need `Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | returns `{ token, user }` |
| GET | `/api/auth/me` | current user |
| PUT | `/api/auth/profile`, `/api/auth/password` | update profile / password |
| GET | `/api/auth/search-users?query=` | find people by name or email |
| GET | `/api/messages/conversations` | DM inbox with unread counts |
| GET | `/api/messages/dm/:userId?before=` | DM history (paged) |
| GET | `/api/messages/space/:code?before=` | space chat history (paged) |
| POST | `/api/messages/read` | mark a chat as read |
| GET/DELETE | `/api/messages/scheduled` | list / cancel scheduled messages |
| POST | `/api/spaces/create`, `/api/spaces/join` | create / join a space |
| GET | `/api/spaces/mine`, `/api/spaces/:code/members` | my spaces, members |
| POST/DELETE | `/api/spaces/:code/leave`, `/api/spaces/:code`, `/api/spaces/:code/members/:id` | leave, delete, remove member |
| POST/GET | `/api/files`, `/api/files/:id/:key` | upload / stream files |
| GET | `/api/config/ice` | WebRTC ICE servers |

Socket.IO (authenticated with the same token): `sendMessage`, `editMessage`, `deleteMessage`, `typing`, and the call events `call-user`, `answer-call`, `reject-call`, `ice-candidate`, `toggle-media`, `end-call`.
