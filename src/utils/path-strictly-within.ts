/**
 * Objective: Check lexical path containment excluding the parent itself.
 * Used: When Maestro requires a path below a configured directory.
 * Entrypoint: isPathStrictlyWithin().
 */

import { relative } from 'node:path';
import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';

export const isPathStrictlyWithin = ({
  parent,
  candidate,
}: {
  parent: string;
  candidate: string;
}): boolean =>
  relative(parent, candidate) !== '' &&
  isPathWithinOrEqual({ parent, candidate });
