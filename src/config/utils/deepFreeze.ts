/**
 * Objective: Freeze a configuration and its nested values.
 * Used: When Maestro exposes immutable configuration.
 * Entrypoint: deepFreeze().
 */

export const deepFreeze = <T extends object>(target: T): Readonly<T> => {
  Object.freeze(target);
  for (const value of Object.values(target)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  }
  return target;
};
