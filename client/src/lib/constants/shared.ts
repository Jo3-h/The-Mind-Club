/** Numeric range. Inclusive. */
export type Constraint = {
	STEP: number;
	MAX: number;
	MIN: number;
};

/** Text length range, in characters. Inclusive. */
export type LengthConstraint = {
	MIN: number;
	MAX: number;
};
