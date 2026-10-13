/**
 * All injection goes through this module so there is one container.
 *
 * `fudgel/dist/di.js` is a second copy of the injector, separate from the
 * one inside `fudgel`. A service overridden in one isn't overridden in the
 * other, so tests import `diOverride` from here too.
 */
export { di, diOverride } from 'fudgel';
