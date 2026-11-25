# RDC Starlink Demo

This is a demo/test implementation of the requested RDC Starlink flow.

## Exact order

1. Customer chooses a package.
2. Customer enters phone number and a 4-digit DEMO PIN.
3. Customer submits.
4. Customer sees the waiting-for-approval page.
5. Telegram receives STEP 1 with package, phone and DEMO PIN.
6. Admin presses APPROVE or REJECT.
7. If approved, the customer's OTP page opens.
8. Customer enters a 4-digit DEMO OTP and submits.
9. A NEW STEP 2 Telegram request is sent.
10. Admin approves/rejects the OTP request.
11. If approved, customer sees the success page.

## Important

This project is for demonstration/testing. The PIN and OTP fields are explicitly labeled DEMO/TEST ONLY.

Never enter a real mobile-money PIN, banking PIN, or real payment OTP.

## Backend deployment on Render

Use the `backend` directory as the Render service root if deploying the repository as a monorepo.

Build command:

npm install

Start command:

npm start

Add these Render environment variables:

TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID

Do not commit a real `.env` file.

## Frontend

After the Render backend is live, open:

frontend/script.js

Change:

const BACKEND_URL = "YOUR_RENDER_BACKEND_URL";

to your actual Render URL.

Example:

const BACKEND_URL = "https://your-service.onrender.com";

## GitHub Pages

The `frontend` directory contains the static website files:

index.html
style.css
script.js

Use those files in your GitHub Pages/static website.

## Data

The demo backend keeps requests in memory while the server is running. A server restart clears them. For a permanent production database, a database should be added separately.
