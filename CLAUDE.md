# CLAUDE.md — The Mind Club

Standing instructions for any AI agent working in this repo. Read this before every task.

## What this is

The Mind Club is a group tutoring marketplace for Australian high school students (years 7–12).
Core mechanic: the first student to book a session sets the group size and location type; later
students join at a lower price. **The more students join, the cheaper it gets for everyone.**
The price-drop signal is the product's main differentiator. Treat it as a first-class feature,
not a pricing detail.

The full MVP spec lives in `docs/MVP_BRIEF.md`. Work only on the phase you were asked to work on.

## Stack (do not change without asking)

- SvelteKit (adapter-node), **Svelte 5 runes syntax** (`$state`, `$derived`, `$props`), TypeScript strict
- Postgres + Drizzle ORM (migrations via `drizzle-kit`)
- Better Auth (already working end to end)
- Stripe + Stripe Connect (Express accounts) for payments and tutor payouts
- Docker / docker-compose for local dev
- Infra is Terraform on AWS ECS Fargate. **Never edit anything under the Terraform directories.**

## Architecture rules

- Routes are split into `(public)` and `(protected)` route groups.
- One root layout with a dynamic header. Root `+layout.server.ts` reads the session but never redirects.
- `(protected)/+layout.server.ts` is a pure auth guard. A tutor-only guard stacks on top for tutor routes.
- Data access goes through repositories in `src/lib/server/repositories/`:
  - Plain namespace objects with functions, e.g. `Tutor.createDefault({ userId })`. **No classes.**
  - Every repository function takes an optional `tx` param defaulting to `db`, so callers can compose transactions.
  - `+page.server.ts` files import repositories. **They never import `db` directly.**
- Any operation with more than one write runs in a transaction.
- Business logic (pricing, session state transitions, fee calculation) lives in pure functions under
  `src/lib/server/domain/` with unit tests. Routes and repositories call into it.
- Use SvelteKit form actions for mutations. Validate every input server-side (use Zod or Valibot; pick one and stay consistent).
- Money is stored and computed as **integer cents (AUD)**. Never use floats for money.
- All times stored as UTC `timestamptz`; display in the user's timezone (default `Australia/Adelaide` for dev).

## Existing schema — extend, don't replace

Before touching the schema, read the existing Drizzle schema files. It already covers tutor profiles,
subjects, availability, sessions, participants, payments, payouts, and a platform-level `pricingTiers`
table. A `role` enum (`student` / `tutor` / `admin`) sits on the Better Auth `user` table via
`additionalFields`. `tutorProfiles` and `studentProfiles` sit alongside it.

- Add columns/tables via new migrations. Never rewrite or delete existing migrations.
- Postgres gotcha: `user` is a reserved word. Always quote it: `"user"`.
- `drizzle.config.ts` must import `dotenv/config`.

## Security boundaries

- **Do not modify Better Auth core config, session handling, password hashing, or cookie settings.**
  If a task needs an auth change, stop and describe the change instead of making it. The owner reviews auth personally.
- Authorise on the server for every protected load and action. Check ownership (a student can only
  see/modify their own bookings; a tutor only their own sessions). Never trust IDs from the client alone.
- Stripe webhooks must verify the signature and be idempotent (store processed event IDs).
- Secrets come from env vars only. Add any new var to `.env.example` with a placeholder. Never commit real keys.
- Use Stripe **test mode** only.

## Design system

Reference file: `mind-club-style-guide.html`. Match it. Do not install a component library
(no shadcn-svelte, Skeleton, Flowbite, etc.). Build components by hand in `src/lib/components/`.

- Primary/action colour: forest green `#1F4D45`
- Amber `#B8842E` is reserved **exclusively** for the price-drop signal. Never use it for anything else.
- Cool neutral surfaces, flat layouts with hairline borders. Elevation (shadow) only on the live price block.
- Source Serif 4 for headlines and human moments; IBM Plex Sans for UI and data.
- Tone: clean and minimal, like Linear / Stripe Dashboard. Not playful, not "school-themed".
- Booking flows and availability UIs take cues from Cal.com.
- If a component already exists (session/group card, status badges, tutor rows, pricing tier table,
  form controls), reuse it.

## How to work

- Before coding a phase, write a short plan: files to add/change, schema changes, open questions. Wait for approval.
- If something in the brief is ambiguous, **ask**, don't guess. If you must assume, label it `ASSUMPTION:` in your summary.
- Small, reviewable commits on a feature branch named `phase-N-short-name`. Never commit to `main`.
- Write unit tests (Vitest) for all domain logic: pricing, fee splits, session state transitions.
- Run `npm run check`, `npm run lint`, and `npm test` before saying a phase is done. Report results honestly.
- End each phase with: what was built, what wasn't, assumptions made, and how to test it manually.
- Don't add dependencies without saying why.
