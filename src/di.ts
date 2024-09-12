/**
 * Using `di` that is exported from `fudgel` directly will not work in tests.
 *
 * Using `fudgel/dist/di` for just the affected code that should be tested causes two versions of the injector to be added to the project.
 *
 * All injection needs to be done through the same container.
 */
export { di, diOverride } from 'fudgel/dist/di';
