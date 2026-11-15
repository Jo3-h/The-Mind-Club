-- A tutor can't be in two scheduled sessions at once. Enforced by the database so two students
-- booking the same slot at the same moment can't both win (the loser gets SQLSTATE 23P01).
-- 0001_tutoring_sessions_no_overlap.sql was meant to add this but was committed empty; it is left
-- untouched (migrations are never rewritten) and the constraint is added here instead.
-- Cancelled and completed sessions don't block the slot. Ranges are half-open, so back-to-back
-- sessions (one ends at 5pm, the next starts at 5pm) are fine.
-- btree_gist lets the `=` on tutor_id sit in a GiST exclusion constraint (available on RDS).
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "tutoring_sessions"
	ADD CONSTRAINT "ts_tutor_no_overlap"
	EXCLUDE USING gist ("tutor_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
	WHERE ("status" = 'scheduled');
