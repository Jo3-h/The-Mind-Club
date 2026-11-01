CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_tier_unique" ON "pricing_tiers" USING btree ("group_size","participant_count");--> statement-breakpoint
CREATE UNIQUE INDEX "session_participant_unique" ON "session_participants" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "session_participants_session_idx" ON "session_participants" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_tutor_starts_at_idx" ON "sessions" USING btree ("tutor_profile_id","starts_at");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_subject_unique" ON "tutor_subjects" USING btree ("tutor_profile_id","subject_id");