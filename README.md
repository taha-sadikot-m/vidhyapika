<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/162dd008-e9fe-4077-99fe-59baa774cec4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` (or `.env`) and set:
   - `DATABASE_URL` (Postgres connection string)
   - `JWT_SECRET` (>= 32 chars)
   - Optional: `RESEND_API_KEY`, `TWILIO_*`, `GEMINI_API_KEY` (server-side only)
3. Start Postgres (optional via Docker):
   `docker compose up -d`
3. Run the app:
   `npm run dev`
