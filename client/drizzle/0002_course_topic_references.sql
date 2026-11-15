ALTER TABLE "courses" ADD COLUMN "textbook" text;--> statement-breakpoint
ALTER TABLE "course_topics" ADD COLUMN "chapter_title" text;--> statement-breakpoint
ALTER TABLE "course_topics" ADD COLUMN "page_start" smallint;--> statement-breakpoint
ALTER TABLE "course_topics" ADD COLUMN "page_end" smallint;--> statement-breakpoint
ALTER TABLE "course_topics" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "course_topics" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "course_topics" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_chapter_number_chk" CHECK ("course_topics"."chapter_number" > 0);--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_pages_chk" CHECK ("course_topics"."page_start" is null or "course_topics"."page_end" is null or "course_topics"."page_end" >= "course_topics"."page_start");