# CivicPulse 🗺️

### Tamil Nadu Civic Accountability Platform

A community-verified civic issue reporting and resolution platform built for Tamil Nadu's municipal corporations. Citizens report issues, neighbours verify them, officials resolve them, and citizens confirm the fix — every step tracked publicly.

---

## Live Demo

- **Frontend:** [https://civicpulse.vercel.app](https://civicpulse.vercel.app)
- **Backend API:** [https://civicpulse-api.onrender.com](https://civicpulse-api.onrender.com)

---

## Demo Credentials

### Admin

Email: admin@civicpulse.in
Password: Admin@123

### Officials

Ramesh Kumar (Senior — sees all wards)
Email: ramesh.kumar@gcc.tn.gov.in
Password: Official@123

Priya Sundaram (Ward Officer — South Chennai)
Email: priya.sundaram@gcc.tn.gov.in
Password: Official@123

Senthil Murugan (Ward Officer — North Chennai)
Email: senthil.murugan@gcc.tn.gov.in
Password: Official@123

### Citizens

Arun Krishnamurthy
Email: geeks4meeks@gmail.com
Password: Citizen@123

Meena Selvam
Email: meena.selvam@gmail.com
Password: Citizen@123

Suresh Babu
Email: suresh.babu@gmail.com
Password: Citizen@123

---

## The Problem

In Tamil Nadu, civic complaints are filed via phone calls or WhatsApp messages to ward councillors. Reports get lost, officials claim resolution without verification, and citizens have no visibility into what happened to their complaint. There is no public accountability mechanism.

---

## How CivicPulse Works

### Four-Step Accountability Loop

1. **File** — Citizens report issues in any language using AI-assisted parsing
2. **Validate** — Neighbours within 500m independently confirm the issue is real
3. **Resolve** — Officials are assigned based on ward, held to SLA deadlines publicly
4. **Verify** — Citizens confirm whether the fix is genuine before the complaint closes

---

## Key Features

### Community Validation

- Requires 2 independent neighbours within 500m (Haversine formula)
- Prevents spam and false complaints at the source
- Compound unique index prevents duplicate validations

### Priority Scoring

Five-term auditable formula — no AI, fully explainable:

- Category urgency weight
- Community validation count
- Affected citizen count (from merging)
- Age in days
- Area historical breach rate

### SLA Escalation Engine

- Node-cron runs hourly
- Warning email sent 6 hours before breach
- Auto-marked overdue after deadline
- Auto-reassigned after 24 hours of inaction
- Official credibility score decremented per violation

### Proof of Fix with Perceptual Hashing

- Official uploads after-photo
- dHash comparison with center-crop on before/after photos
- Hash distance < 10 flagged as suspicious (same photo resubmitted)
- Advisory only — never blocks resolution
- Citizens have final authority through voting

### Citizen Verification Voting

- 40% not-fixed threshold with minimum 2 votes triggers auto-reopen
- Merge-aware eligibility (filers + validators of merged complaints)
- Official credibility score drops 10 on rejection, gains 5 on genuine fix

### Real-Time Notifications

- SSE (Server-Sent Events) for instant in-app notifications
- Email notifications via Brevo for offline users
- Six notification events: validated, assigned, proof submitted, reopened (×2), SLA warning

### Pincode-Based Ward Routing

- Officials see only complaints from their assigned pincodes
- Senior officials have unrestricted visibility
- Prevents cross-ward complaint interference

### Validator Anomaly Detection

- MongoDB aggregation pipeline
- Flags validators who exclusively validate one filer's complaints
- Advisory surfaced in admin panel for human review

### Recurring Issue Detection

- Aggregation groups complaints by category + 500m grid cell
- 3+ complaints in 6 months = structural problem flag
- Surfaces in admin panel for escalation to zonal engineer

### PDF Generation

- Complaint detail PDF with timeline and photo evidence
- Area analytics report with category/status charts, overdue list, official credibility

---

## Tech Stack

### Backend

- Node.js + Express
- MongoDB Atlas (Mongoose)
- JWT Authentication
- Cloudinary (image storage)
- Groq API — Llama 3.3 70B (AI complaint parsing)
- Nodemailer + Brevo (email notifications)
- Node-cron (SLA automation)
- Sharp + custom dHash (perceptual hashing)

### Frontend

- React + Vite
- Tailwind CSS
- Leaflet.js + react-leaflet (interactive map)
- jsPDF (PDF generation)
- Axios with JWT interceptors

### Deployment

- Backend: Render
- Frontend: Vercel
- Database: MongoDB Atlas M0

---

## Architecture

Client (React/Vite)
↓ Axios + JWT
Express API (Node.js)
↓
MongoDB Atlas ← Mongoose Models
↑
Cloudinary ← Image uploads
Groq API ← AI parsing
Brevo SMTP ← Email notifications
Node-cron ← SLA automation
SSE ← Real-time notifications

---

## Local Development

### Prerequisites

- Node.js v18+
- MongoDB Atlas account
- Cloudinary account
- Groq API key
- Brevo account

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/civicpulse.git
cd civicpulse

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Environment Variables

Create `server/.env`:

PORT=5000
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GROQ_API_KEY=your_groq_key
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=your_brevo_smtp_login
EMAIL_PASS=your_brevo_smtp_key
EMAIL_FROM=your_verified_sender_email

### Run

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:5000`

---

## Project Structure

civicpulse/

├── server/

│ ├── config/ # Cloudinary, DB connection

│ ├── controllers/ # Route handlers

│ ├── jobs/ # SLA cron job

│ ├── middleware/ # Auth middleware

│ ├── models/ # Mongoose schemas

│ ├── routes/ # Express routes

│ ├── utils/ # Haversine, perceptual hash, email, SSE

│ └── index.js

└── client/

├── src/

│ ├── components/ # Navbar, ProtectedRoute

│ ├── context/ # AuthContext, NotificationContext

│ ├── pages/ # All page components

│ └── utils/ # API client, PDF generators

└── index.html

---

## Key Interview Talking Points

- **Community validation** prevents spam without ID verification — physical proximity is the proof of legitimacy
- **Priority formula** is deliberately non-AI — auditable and explainable, appropriate for government accountability
- **dHash advisory layer** catches lazy fraud; citizen voting catches sophisticated fraud — neither alone is sufficient
- **SSE over WebSockets** — all notifications are server-to-client, bidirectional complexity is unnecessary
- **Pincode routing** uses existing address data as ward proxy — GCC ward polygon data isn't publicly available in queryable format
- **Anomaly detection** surfaces coordinated validation patterns — makes fraud costly without blocking legitimate neighbors
- **SLA warning emails** proactive rather than reactive — officials get a chance to act before the public breach

---

## Built By

Nikhitaa — B.E. CSE Final Year, Chennai
