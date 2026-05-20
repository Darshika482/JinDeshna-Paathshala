# jain-shivirOS

An open-source **camp management web app** built for Jain Shivir camps. Manages student points & rewards, attendance, leaderboard, coin distribution, exam marks, and volunteers — with offline-first support and a bilingual (English / Hindi) interface.

Anyone can fork this repo, deploy it in minutes, and run it for their own camp — no coding required after setup.

---

## Features

- **Setup wizard** — connects your Supabase, runs the schema, and configures your camp in one guided flow
- **6 role-based portals** — Admin, Zone Mentor, Class Teacher, Coordinator, Coinkeeper, Collection
- **Point award system** — 25+ reasons across Coin, Behaviour, and Digital categories
- **Attendance** — 3 sessions/day, per-class isolation, 30-min grace period, automatic +5 pts on submit
- **Leaderboard** — real-time ranking with tiers (High / Mid-High / Mid / Low)
- **Exam marks** — multi-student entry, grouped by class in admin
- **Coin pool tracking** — distribution, return, and slot locking
- **Offline-first** — pending queue syncs automatically when back online
- **QR scan** — student lookup by QR code
- **CSV import** — bulk import students and volunteers
- **Bilingual** — English and Hindi throughout

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, React Router v6, Tailwind CSS |
| State | Zustand (with persist middleware) |
| Backend | Supabase (PostgreSQL + Realtime) |
| Build | Vite 5, PWA plugin |
| i18n | i18next |

---

## Getting Started (5 minutes)

### Step 1 — Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up / log in
2. Click **New project** → give it a name → wait for it to provision (~1 min)
3. Go to **Settings → API** and note down:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public key** (long string starting with `eyJ`)

### Step 2 — Deploy the app

**Option A — Vercel (recommended, free)**
1. Fork this repo on GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your fork
3. Click Deploy — no env vars needed (the setup wizard handles it)

**Option B — Run locally**
```bash
git clone https://github.com/Darshika482/jain_shivirOS.git
cd jain_shivirOS
npm install
npm run dev
```

### Step 3 — Open the app and follow the setup wizard

The first time anyone opens the app (with no `.env` file configured), the setup wizard appears automatically:

| Step | What happens |
|------|-------------|
| **1 — Connect Supabase** | Paste your Project URL and anon key → click Test Connection |
| **2 — Set up database** | Copy the SQL schema → paste into Supabase SQL Editor → click Run → come back and click Verify |
| **3 — Configure camp** | Enter camp name, city, dates, admin password, and coinkeeper PIN |
| **4 — Launch** | Review everything → click Launch App |

That's it. The app is live and ready to use.

---

## Accessing the Admin Panel

| What | How |
|------|-----|
| URL | `your-app.vercel.app/admin` |
| Login | Enter the admin password you set in the setup wizard |
| Default password | `darshika` (change it via Admin → Settings after first login) |

The admin panel has 12 sections accessible from the left sidebar:

| Section | Purpose |
|---------|---------|
| Dashboard | Overview stats |
| Check-In Records | View all check-in activity |
| Students | Add, edit, import students; view points breakdown |
| Classes | Class rosters and exam marks by class |
| Leaderboard | Real-time student rankings |
| Schedule | 7-day camp schedule |
| Coin Allocation | Configure coin pool distribution |
| Transactions | Full audit log of all point awards; flag suspicious entries |
| Mentors | Add/edit volunteers, set roles, assign classes and PINs |
| Coin Register | Log coin distributions and returns |
| Operations | CSV import/export, data reset |
| **Settings** | Change admin password, coinkeeper PIN, camp dates, Supabase config |

---

## Changing Passwords and PINs

### Admin password
1. Log in to the admin panel (`/admin`)
2. Go to **Settings** (bottom of left sidebar → 🔧)
3. Under **Change Admin Password** — enter current password, new password, confirm → click **Update Password**

### Coinkeeper PIN
1. Log in to the admin panel
2. Go to **Settings → Change Coinkeeper PIN**
3. Enter current PIN, new 4-digit PIN → click **Update PIN**

> **First time?** Default admin password is `darshika` and default coinkeeper PIN is `0000`. Change both immediately via Admin → Settings.

---

## Volunteer / Staff Portals

Each role gets a PIN-based login from the main screen (`/login`):

| Role | PIN login | Route | What they can do |
|------|-----------|-------|-----------------|
| Zone Mentor | Volunteer PIN | `/mentor/actions` | Award/deduct points, enter exam marks, view their log |
| Class Teacher | Teacher PIN | `/teacher` | Mark attendance for assigned classes (3 sessions/day) |
| Activity Coordinator | Coordinator PIN | `/coordinator` | Coordination tasks |
| Coinkeeper | 4-digit PIN | `/coinkeeper` | Coin pool distribution and returns |
| Collection | Collection PIN | `/collection` | Coin collection station |
| Check-in | No PIN | `/checkin` | Mark student check-in (public, no auth) |

Add volunteers via **Admin → Mentors → Add Volunteer**. Set their PIN, roles, and assigned classes there.

---

## Importing Students

Go to **Admin → Operations → Import CSV**. The CSV file should have these columns (order doesn't matter):

```
Roll Number, Child Name, Name (Hindi), Class, Allotted Book, Group,
Father Name, Mother Name, Mobile, Gender, Age, DOB, City, Reg ID,
Health Issue, Health Detail, Pathshala, Prev Shivir, Kit Given
```

Only **Roll Number** and **Child Name** are required. All other columns are optional.

---

## Adapting for Your Camp

After setup, these are the main things to customise:

| What to change | Where |
|----------------|-------|
| Camp name, city, dates | Admin → Settings → Camp Information |
| Admin password | Admin → Settings → Change Admin Password |
| Coinkeeper PIN | Admin → Settings → Change Coinkeeper PIN |
| Class teacher names | `src/lib/classTeachers.js` — update the names for your class codes |
| Point award reasons | `src/pages/volunteer/VolunteerApp.jsx` → `COIN_REASONS`, `BEHAVIOUR_REASONS`, `DIGITAL_REASONS` |
| Coin pool size | `src/store/useCoinStore.js` → `TOTAL_COINS` |
| Exam max marks | `src/pages/volunteer/VolunteerApp.jsx` → `EXAM_MAX` (currently `80`) |
| Behaviour cap per day | `src/pages/volunteer/VolunteerApp.jsx` → `BEHAVIOUR_CAP` (currently `4`) |

---

## Environment Variables (optional)

If you prefer `.env` over the setup wizard (e.g. for CI/automated deployments):

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Camp dates
VITE_CAMP_START_DATE=2026-05-03
VITE_CAMP_END_DATE=2026-05-09
VITE_CAMP_TOTAL_DAYS=7

# Credentials
VITE_ADMIN_PASSWORD=your-strong-password
VITE_COINKEEPER_PIN=1234
```

When env vars are present, the setup wizard is skipped automatically.

---

## Supabase Schema

All tables are in `supabase/schema.sql`. Run it once in your Supabase SQL Editor to create everything.

The `add_student_points` RPC (included in `supabase/add_points_rpc.sql`) atomically updates `total_points` and `day_points` from the sum of all transactions. Never update these columns directly.

---

## License

MIT — free to use, fork, and adapt for any camp.
