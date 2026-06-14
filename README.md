# FounderOS - AI Business Command Center

FounderOS is a hackathon mini app for the "Frontend to Founder" theme. It turns the provided e-commerce JSON data into a living business command center for an online store founder. The app connects products, orders, users, reviews, chats, notifications, and locations into a practical workflow for deciding what to restock, which order needs attention, and which customer issue should be answered first.

## Hackathon Entry

FounderOS was built for the Informatics MSU Hackathon 2026 by team สามหนุ่มมหาปลัย from King Mongkut's University of Technology Thonburi (KMUTT).

Team members:

- Narawit Sandorn
- Nattakit Promvisit
- Siwat Guttra

## What It Does

- Shows an overview of revenue, order health, stock risk, review pain, and customer support pressure.
- Lets the founder search products, orders, customers, and chats globally.
- Simulates live business events with Auto Sim, including new orders, stock changes, activity updates, notification toasts, and unread notification count.
- Uses Gemini for structured recommendations, with deterministic local fallback when the API is offline, rate-limited, slow, or unavailable.
- Keeps key chat and AI analysis state while navigating between pages until the browser is refreshed.
- Works as a PWA after the service worker is ready, including offline access to the app shell and local fallback analysis.
- Provides responsive desktop and mobile layouts, including mobile-first AI panels, bottom navigation, and a floating mobile Auto Sim control.

## Data Used

FounderOS uses the e-commerce slice from `Hackathon_Data_Pack`:

- `products.json`
- `ecommerce_orders.json`
- `users.json`
- `reviews.json`
- `chats.json`
- `notifications.json`
- `locations.json`

The app joins orders to users and products, filters product reviews by `target_type = PRODUCT`, connects chats and notifications to users, and calculates operational metrics from the real data pack.

## Pages

- Overview: KPIs, revenue and status charts, stock risk, Founder Action Brief, Gemini Suggest popup, Gemini Assistant, activity feed, and system status.
- Products: searchable and filterable product list with stock risk, revenue, units sold, rating, and product detail links.
- Product Detail: product-specific metrics, related orders, related reviews, stock impact, and Gemini Product Insight.
- Customer Voice: AI Pain Analysis, product reviews, deduplicated customer chat inbox, needs-reply prioritization, and Gemini Reply for chats that still need a shop response.
- Orders: searchable and filterable order list, mobile jump-to-detail behavior, order risk, items purchased, related chats, related notifications, and Gemini Order Summary.

## AI Features

Gemini calls go through `/api/gemini`, backed by `netlify/functions/gemini.ts`. The frontend never reads the real `GEMINI_API_KEY`.

Implemented AI and fallback features:

- Gemini Suggest / Founder Action Brief
- Gemini Assistant for store questions
- Gemini Product Insight
- AI Pain Analysis for reviews and chats
- Gemini Reply for customer chats that need an answer
- Gemini Order Summary

Each AI action checks the live API path again when clicked. If Gemini cannot return a usable result, the app falls back to deterministic local analysis generated from the current business data.

## Fallback and Reliability

AI requests use `AbortController` with a 45 second timeout. Fallback is used when:

- the browser is offline
- the API returns a rate limit response
- the API errors
- the API response is empty or cannot be used
- the request times out

Fallback results are based on local business signals such as stock risk, pending orders, cancelled orders, VIP customers, negative product reviews, open customer chats, product revenue, and unit sales.

Fallback notices use this message:

```text
ผลลัพธ์นี้มาจาก fallback  เนื่องจาก API rate limit
```

Successful cacheable AI results are saved in `localStorage` so offline mode can reuse the latest known result where available.

## Simulation and Notifications

Auto Sim creates local live-order events from existing users and products. It prefers realistic business changes:

- adds a new order
- updates revenue and order count
- reduces product stock
- updates the app timestamp
- adds an activity item
- increments unread notifications
- shows notification toasts on desktop and mobile

Desktop notifications open from the bell button and use a scrollable panel for long notification lists. Mobile uses compact toast notifications and a floating Auto Sim button above the Orders tab.

## PWA and Offline

FounderOS uses `vite-plugin-pwa` with an installable manifest and service worker. After the service worker is ready, the main app shell remains available offline. Local fallback AI, dashboard views, products, product detail, customer voice, orders, and simulation are designed to remain usable without a live API connection.

## Local Setup

```bash
npm install
npm run dev
```

Open the printed local URL, usually:

```text
http://127.0.0.1:5173
```

## Environment Variables

For local Netlify function testing or deployment, create a local `.env` file and set:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Do not commit `.env`, `.env.example`, real API keys, private keys, or local product notes. These files are intentionally ignored.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

- `npm run dev` starts Vite on `127.0.0.1`.
- `npm run build` runs TypeScript build checks and creates the Vite production build.
- `npm run preview` serves the built app locally.
- `npm run lint` runs TypeScript checks without emitting app output.

## Netlify Deploy

`netlify.toml` is configured with:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- API rewrite: `/api/*` to `/.netlify/functions/:splat`
- SPA fallback: `/*` to `/index.html`

Required Netlify environment variable:

```text
GEMINI_API_KEY
```

Optional Netlify environment variable:

```text
GEMINI_MODEL
```

## Demo Flow

1. Open Overview and frame the app as a living command center built from JSON.
2. Turn on Auto Sim and show that revenue, orders, stock, activity, and notifications update without a refresh.
3. Click Gemini Suggest and show the "Things to do today" popup before closing it back into the normal brief block.
4. Ask the Gemini Assistant a store question and show product-aware suggestions.
5. Open Products, filter or search, then open Product Detail and run Gemini Product Insight.
6. Open Customer Voice, start on AI Pain Analysis, then show prioritized chats and Gemini Reply only where a reply is still needed.
7. Open Orders, select an order, show related chats and notifications, then run Gemini Order Summary.
8. Show desktop and mobile responsiveness, including the mobile bottom navigation and floating Auto Sim control.
9. Explain that API limit, offline state, or malformed AI output does not break the demo because local fallback remains available.

## Notes

- Gemini output depends on Netlify environment configuration and API quota.
- Simulation state is local to the current browser session and resets on browser refresh.
- Chat and AI panel state is kept while navigating between pages, but resets on full refresh.
- The project data pack is committed because it is the required source data for the hackathon app.
