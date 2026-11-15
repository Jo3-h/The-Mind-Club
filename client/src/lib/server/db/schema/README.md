# The Mind Club: data model

One table per file. `index.ts` re-exports everything; point `drizzle.config.ts` at it.
Better Auth's tables (`user`, `session`, `account`, `verification`) live in `auth.ts`.

## The rule behind every decision

Some schema changes are cheap later and some are painful.

- **Cheap (additive):** a new table, a new nullable column, a new enum value, a new index.
- **Painful (structural):** changing what a key points at, splitting one column into two, changing
  how time or money is stored, or moving data that lived on one table onto another.

So this schema spends its effort on the painful category: keys, time, money, the session/booking
split and price snapshots. It leaves the cheap things (reviews, messaging, lesson plans, textbooks,
parents) for later.

## Map

```
subjects ─< courses ─< course_topics >─ topics
                                         │
           tutor_topics >────────────────┤
           student_topics >──────────────┘
user ─┬─ tutor_profiles ─< session_series
      │        │                 │
      │        └────────< tutoring_sessions >── topics, pricing_schemes ─< pricing_tiers
      │                          │
      ├─ student_profiles ─< bookings ─< payments
      ├─< weekly_availability
      └─< availability_exceptions
postcodes (reference)   stripe_events (webhook log)
```

## Decisions

### Curriculum

- **Topic** = one chapter's content, the unit of matching. It has no year, state or chapter number.
- **Course** = a pickable block at one year level, either national (`state` NULL) or state-specific.
  Junior years get national courses too, so every query goes through one path.
- **course_topics** holds the chapter number, because the number differs per course. The same
  topic can appear in SA Year 11 and VIC Year 12, which pools demand across states.
- Every row has a permanent `key`. The seed script upserts on it. Never reuse or rename a key.

### Profiles

- 1:1 with `user`, with `user_id` as the primary key.
- Students store `graduation_year`, not year level, because year level goes stale every January.
- Both profile tables store an IANA `timezone`.
- Stripe Connect and WWCC status fields are on `tutor_profiles` and are written only by the server.

### Availability

- One table for both roles, keyed by user.
- Weekly windows are stored as **local minutes + timezone**, not UTC, so "Tue 4–6pm" survives
  daylight saving.
- One-off blocks and extra time are stored as real timestamps in `availability_exceptions`.
- Booked time is never written into availability. Free time is calculated:
  windows − blocked + extra − scheduled sessions.

### Sessions vs bookings

- `tutoring_sessions` is the container: tutor, topic, time, place, capacity, price snapshot.
  It's not called `session` because Better Auth already uses that name.
- `bookings` is one student's seat. Seat counts and group size are always counted from bookings,
  never stored on the session.
- A series is a template. Every week is a real session row with its own topic and bookings.
- Postgres itself enforces:
  - no overlapping sessions for the same tutor (exclusion constraint, in a custom migration)
  - one live booking per student per session (partial unique index)
  - a session at a student's home is always private (check constraint)

### Money

- All amounts are integer cents in AUD. All rates are integer basis points. No floats.
- Pricing schemes are versioned and immutable. A session snapshots `base_rate_cents` and
  `pricing_scheme_id`, so later changes never reprice it.
- **Price never goes up:** a booking stores `price_cap_cents`, the price at the group size when the
  student joined. Their final price is the lower of that cap and the price at the final group size.
- Stripe Connect destination charges carry the platform fee, so there's no payouts table.
  `payments` is 1:many per booking to allow retries, a saved card followed by a charge, and refunds.
- `payer_user_id` is kept separate from the booking's `student_id`, so parents can pay later
  without a migration.
- `stripe_events` makes webhook handling idempotent: process each event id exactly once.

## Flows that must run in a transaction

- **Create a session (first booking):**
  1. Check the time is inside the tutor's weekly windows and outside any exception.
  2. Insert the session. The exclusion constraint rejects a double-booking.
  3. Insert a `pending` booking with an `expires_at`.
  4. Create the Stripe intent.
  5. The webhook confirms the booking.
- **Join a session:**
  1. `SELECT … FROM tutoring_sessions WHERE id = $1 FOR UPDATE`.
  2. Count live bookings and compare against capacity.
  3. Insert the booking.

  Without the lock, two students can both take the last seat.

- **Complete a session:**
  1. Count confirmed and attended bookings.
  2. Set each booking's `final_price_cents`.
  3. Capture each payment for that amount.

## Card holds expire

A card authorisation lasts about 7 days for most cards. For a session booked further ahead:

1. Save the card at booking (SetupIntent, payment status `card_saved`).
2. Charge it off-session after the session, or authorise it a few days before.

The `payments` table supports either approach.
