# The Mind Club — MVP Build Brief

Put this file at `docs/MVP_BRIEF.md`. Conventions and rules are in `CLAUDE.md` at the repo root.

## Goal of the MVP

A working product the founder can use with his own 5–8 tutoring students, end to end:
a tutor publishes availability, a student books a session, other students join and the price drops
for everyone, the session happens, everyone is charged the final (lowest reached) price, and the
tutor gets paid minus a 10% platform fee.

Anything not needed for that loop is out of scope (see bottom).

## Decisions the agent must NOT make alone

Resolve these with the founder at the start of the relevant phase. Defaults are given so work isn't blocked,
but each must be confirmed.

| #   | Question                                                                     | Proposed default                                           |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| D1  | When does a session lock (no more joins, price final)?                       | 24h before start                                           |
| D2  | What if only one student is booked at lock time?                             | Session runs at solo price (top tier)                      |
| D3  | Is the 10% fee taken out of the tutor's price, or added on top for students? | Taken out of the tutor's share                             |
| D4  | Cancellation by a student                                                    | Free before lock; after lock, still charged                |
| D5  | Cancellation by a tutor                                                      | Session cancelled, nobody charged, everyone notified       |
| D6  | Can a student join a session at another student's home?                      | No. "Student's home" sessions are private and not listed   |
| D7  | Max group size cap                                                           | Set by first booker, between 2 and a platform max (e.g. 6) |

## Payments model (important)

The original idea was "authorise the card at booking, capture the final amount after the session".
**Stripe card authorisations generally expire after ~7 days**, so this breaks for sessions booked
further ahead. Use this instead:

1. At booking, collect and save the card with a **SetupIntent** (Stripe Checkout in `setup` mode or Payment Element). Show the student the current price and the lowest possible price.
2. Sessions are priced live from `pricingTiers` based on participant count.
3. After the tutor marks the session complete, compute the final per-student price and create an
   **off-session PaymentIntent** for each participant.
4. Use **Stripe Connect Express** for tutors. Charges are destination charges with
   `application_fee_amount` = 10% so the tutor's share is transferred automatically.
5. Handle failed off-session charges: mark the participant's payment `failed`, show it on the tutor and admin views, and let the student retry with a new card.
6. All payment state changes are driven by verified, idempotent webhooks, not by redirect pages.

ASSUMPTION for the founder to verify against current Stripe docs: authorisation window and
off-session charging rules for Australian cards.

## Session lifecycle (implement as a pure state machine with tests)

`open` → `locked` → `completed` → `charged`
plus `cancelled` from `open` or `locked`.

- `open`: joinable, price drops as people join.
- `locked`: at D1 cutoff, via a scheduled job (a simple cron-style endpoint or worker is fine). Price frozen.
- `completed`: tutor marks it done after the start time.
- `charged`: all participant payments attempted (individual payments may still be `failed`).

## Phases

Do one phase per request. Each phase ends with a summary and manual test steps.

### Phase 0 — Audit

Read the codebase and schema. Report: what exists, what's missing for this brief, any conflicts
between the brief and the existing schema. **No code changes.**

### Phase 1 — Schema & domain logic

- Add whatever columns/tables the lifecycle and payments model need (session status, lock time,
  location type, max group size, Stripe IDs on payments/participants/tutor profiles, processed webhook events).
- Pure functions + Vitest tests: price per student for N participants, fee split, state transitions, "is this session joinable by this student?".
- Seed script: platform pricing tiers, a few subjects/topics (years 7–10, national list), one tutor, three students.

### Phase 2 — Tutor onboarding

- Tutor sign-up path (sets role, creates `tutorProfiles` row in one transaction).
- Profile editor: name, bio, photo URL, subjects/topics taught, suburb (for in-person).
- Weekly availability editor: broad time windows per weekday (Cal.com-style UI).
- Stripe Connect Express onboarding button + return/refresh routes. Tutor can't publish until onboarding is complete.

### Phase 3 — Public browse

- Tutor directory and tutor profile page.
- Open sessions list, filterable by subject, year level, online/in-person.
- Session detail page with the **live price block**: current price per student, next price if one more joins,
  lowest possible price, spots left. This is where amber and elevation are used.

### Phase 4 — Booking & joining

- "Start a session" from a tutor's profile: pick topic, start time inside an availability window,
  max group size, location type. Prevent double-booking the tutor.
- "Join this session" for open sessions the student is eligible for.
- Both flows save a card via SetupIntent before the booking is confirmed.
- Implement `?redirectTo=` so logged-out users return to the session after login.
- Leave session (before lock).

### Phase 5 — Lifecycle, charging & webhooks

- Lock job (D1).
- Tutor "mark complete" action → off-session charges for each participant at final price.
- Webhook endpoint: signature check, idempotency, updates payments and payouts.
- Tutor cancel (D5) and student cancel (D4).

### Phase 6 — Dashboards

- Student: upcoming sessions, past sessions, what they paid, any failed payments to fix.
- Tutor: upcoming sessions with participants, past sessions, earnings (gross, fee, net), link to Stripe Express dashboard.
- Minimal admin page: all sessions and payments, filterable by status.

### Phase 7 — Notifications (simple)

Transactional email (Resend or Postmark; ask first) for: booking confirmed, someone joined and the price dropped,
session locked, session cancelled, payment receipt, payment failed. Plain, well-formatted, on brand.

### Phase 8 — Hardening

- Review every protected route and action for authorisation/ownership checks; list findings.
- Rate limiting on auth and booking actions.
- Error and empty states on every page.
- Playwright happy-path test: tutor onboards → student books → second student joins → price drops → lock → complete → both charged.

## Out of scope for MVP

Matching engine and lesson plans (keep any existing scaffolding tables, don't build on them),
senior-year courses (11–12), reviews/ratings, messaging, refunds UI beyond cancellation rules,
tutor social-media ad generator, mobile app, multi-child parent accounts, Terraform/infra changes.
