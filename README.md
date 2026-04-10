# Pilot Frontend

Initial frontend scaffold for the pilot product.

## Stack
- React
- TypeScript
- Vite
- Nginx runtime image on container port `8080`

## Local Run
1. Install packages:
   `npm install`
2. Start the dev server:
   `npm run dev`

## Local Defaults
- Frontend: `http://127.0.0.1:3000`
- API base URL: `http://127.0.0.1:5080`

## Runtime Configuration
- `PILOT_FRONTEND_PUBLIC_URL`
- `VITE_API_BASE_URL`

The production image serves static files with Nginx on container port `8080`.
Runtime configuration is exposed through `/env-config.json`, so the container can be reused across environments without rebuilding for every URL change.
In production, `PILOT_FRONTEND_PUBLIC_URL=https://pilot.codebefore.com` and `VITE_API_BASE_URL=/api` are the expected runtime values.
Real production values stay in the server-side `.env.runtime` file; they are not committed to this repo.
The production frontend is intentionally not indexable: `index.html` includes a `robots` meta tag, `/robots.txt` disallows all crawlers, and the Nginx runtime adds `X-Robots-Tag: noindex, nofollow`.

## Health Endpoint
- `GET /health`

## SPA Routing
- Unknown paths fall back to `index.html`
- Static assets are still served directly
