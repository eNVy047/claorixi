# Agent Instructions: Project Anti-Gravity (Advanced Health & Fitness)

## Role
You are an expert Full-Stack Engineer specializing in React Native (Expo) and High-Performance Node.js backends.

## Phase 1: Infrastructure & Data Modeling
1. **Directory Setup**: Initialize `backend/` (Fastify + JS) and `mobile/` (Expo Go).
2. **Database (MongoDB)**: Implement a "Bucket Pattern" for `daily_logs`.
   - Store steps, calories burned, exercise duration, and meal logs in daily documents.
   - Index by `userId` and `timestamp` (descending) for million-user scalability.
3. **Redis**: Cache daily totals for the active week to avoid heavy DB queries on the "Progress" screen.

## Phase 2: Fitness & Activity Tracking
1. **Activity Recording**: Create `/api/v1/fitness/log` to record:
   - **Steps**: Sync with Google Fit/Apple Health via Expo modules.
   - **Exercises**: Type, duration, and calories burned.
   - **Water**: Daily intake tracking with an increment logic.
2. **Burn vs. Intake Logic**: 
   - Calculate Net Calories: $$Net = Intake - (BMR + Active Burned)$$
3. **Historical Analytics**: Build `/api/v1/fitness/stats` with a `period` query param (week, month, year).
   - Use MongoDB Aggregation pipelines for high-performance statistical reporting.

## Phase 3: Authentication & Messaging
1. **Auth**: JWT-based login + Resend API for password resets and "Weekly Progress Report" emails.
2. **Security**: Rate-limiting on fitness log endpoints to prevent API abuse.

## Phase 4: AI Meal Analysis (Core)
1. **Pipeline**: User captures/selects image -> Gemini 1.5 Flash Vision -> JSON Extraction.
2. **Handling**: Process images directly from the gallery or camera. Send image buffer to Gemini. 
3. **Data**: Extract Calories, Protein, Carbs, Fat, and a list of detected ingredients.
4. **Fallback**: If AI confidence is low, query Nutritionix API as a secondary source.

## Phase 5: Subscriptions (Razorpay)
1. **Tier Logic**: 
   - **Free**: View daily calorie totals.
   - **Pro**: Detailed ingredient breakdown, weekly PDF reports, and exercise suggestions.
2. **Webhooks**: Implement a dedicated `/api/v1/payments/webhook` to handle Razorpay events.

## Phase 6: Scalability & UI Performance
1. **Client-Side**: Use `React Query` for data fetching and caching on the phone.
2. **UI Theme**: Strictly follow the provided screenshots:
   - Primary: Orange (#FF8C00 to #FFA500 gradients).
   - Background: Soft Cream (#F5F5DC).
   - Typography: Use Serif for headings (matching the "Identify your gender" screen).
3. **Pagination**: Use cursor-based pagination for all history and route lists.

## Strict Guidelines
- **Zero-Error Policy**: Every controller must have try/catch blocks.
- **Validation**: Use **Zod** for all request body schemas.
- **Automated Check**: After every module, check for errors. If an error is found, resolve it before continuing.