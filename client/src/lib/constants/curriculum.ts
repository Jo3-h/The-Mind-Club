import type { Constraint, LengthConstraint } from './shared';

/** Admin-edited names and slugs (subjects, courses, topics). */
export const CURRICULUM_NAME_LENGTH: LengthConstraint = Object.freeze({ MIN: 5, MAX: 30 });
export const CURRICULUM_KEY_LENGTH: LengthConstraint = Object.freeze({ MIN: 5, MAX: 30 });

export const TEXTBOOK_LENGTH: LengthConstraint = Object.freeze({ MIN: 0, MAX: 200 });

/** A topic's chapter within a course (course_topics.chapter_number > 0). */
export const CHAPTER_NUMBER: Constraint = Object.freeze({ MIN: 1, MAX: 999, STEP: 1 });
export const CHAPTER_TITLE_LENGTH: LengthConstraint = Object.freeze({ MIN: 0, MAX: 120 });
/** Page numbers are smallint in the DB. */
export const PAGE_NUMBER: Constraint = Object.freeze({ MIN: 1, MAX: 32_767, STEP: 1 });
export const COURSE_TOPIC_NOTES_LENGTH: LengthConstraint = Object.freeze({ MIN: 0, MAX: 500 });
