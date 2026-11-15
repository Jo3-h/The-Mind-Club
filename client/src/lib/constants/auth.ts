import type { LengthConstraint } from './shared';

export const PASSWORD_LENGTH: LengthConstraint = Object.freeze({ MIN: 12, MAX: 128 });
export const DISPLAY_NAME_LENGTH: LengthConstraint = Object.freeze({ MIN: 3, MAX: 100 });
