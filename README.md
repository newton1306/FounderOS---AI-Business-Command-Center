# FounderOS - AI Business Command Center

FounderOS is a hackathon mini app for the "Frontend to Founder" theme. It turns the provided e-commerce JSON data into a founder-grade command center that answers: what is happening in the business, and what should the founder do next?

## Data Used

- `products.json`
- `ecommerce_orders.json`
- `users.json`
- `reviews.json`
- `chats.json`
- `notifications.json`
- `locations.json`

The app joins orders to users and products, filters product reviews by `target_type = PRODUCT`, connects chats and notifications to users, and calculates metrics from the real data pack.

## Pages

- Dashboard / Overview: KPIs, charts, Founder Action Brief, activity feed, system status, simulation controls.
- Products: searchable/filterable product list with stock risk, revenue, units sold, rating, and product detail route.
- Product Detail: product metrics, related orders, related reviews, stock impact, and AI Product Insight.
- Customer Voice: product reviews, negative review signals, chat inbox, topic detection, Thai reply assistant.
- Orders / Operations: searchable/filterable orders, operational risk, customer profile, related chats/notifications, AI order summary.

## AI Features

AI calls go through `/api/gemini`, backed by `netlify/functions/gemini.ts`. The frontend never exposes `GEMINI_API_KEY`.

Implemented AI/fallback features:

- Founder Action Brief
- Product Insight
- Review Pain Point Summary
- Reply Assistant in Thai
- Order Summary

## Fast Fallback System

AI requests use `AbortController` with a 1200ms timeout. If the app is offline, slow, quota-limited, or the API errors, FounderOS immediately returns deterministic local fallback generated from real business data:

- low stock products
- open chats
- negative reviews
- pending/cancelled order status
- VIP customers
- product revenue and unit sales

429 responses set `ai_fallback_until` in `localStorage`. During cooldown, future AI calls skip the API entirely. Latest successful AI briefs are cached in `localStorage`.

## PWA / Offline

FounderOS uses `vite-plugin-pwa` with an installable manifest and app shell caching. The dashboard, products, product detail, customer voice, orders, local fallback AI, and simulation remain usable offline after the service worker is installed.

## Real-Time Simulation

Use **Simulate Live Order** to create a local order from existing users/products. It prefers a VIP customer, updates revenue and order count, reduces product stock, adds an activity feed item, and shows a low-stock alert when needed. This works offline because it is local state.

Use **Force Fallback** to set AI fallback cooldown for reliable demos.

## Local Setup

```bash
npm install
npm run dev
```

Open the printed local URL, usually `http://127.0.0.1:5173`.

## Environment Variables

Create a local `.env` only if needed for Netlify function testing:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Do not commit real API keys.

## Build

```bash
npm run build
```

## Netlify Deploy

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Environment variable: `GEMINI_API_KEY`

`netlify.toml` includes SPA fallback routing and `/api/*` function rewrites.

## Demo Checklist

- Show Dashboard action brief: decisions before charts.
- Click Simulate Live Order and point out instant revenue/order/stock/feed update.
- Click Force Fallback, then show AI Fallback Active and deterministic local recommendations.
- Open Products, filter low stock, open Product Detail, run Analyze Product.
- Open Customer Voice, summarize pain points, generate Thai reply.
- Open Orders, filter pending/cancelled/VIP, run AI Order Summary.
- Install PWA, go offline, refresh a route, show app still works.
- Run Lighthouse and target Performance/Accessibility >= 90.

## Known Limitations

- Gemini output depends on Netlify environment configuration and API quota.
- Product images use the provided placeholder URLs from the data pack.
- Simulation state is local to the current browser session and is not persisted to a backend.
