/**
 * Objective: Check lexical path containment excluding the parent itself.
 * Used: When Maestro requires a path below a configured directory.
 */

import { relative } from 'node:path';
import { isPathWithinOrEqual } from '#utils/path-within-or-equal.ts';

type IsPathStrictlyWithinInput = {
  parent: string;
  path: string;
};

export const isPathStrictlyWithin = ({
  parent,
  path,
}: IsPathStrictlyWithinInput): boolean =>
  relative(parent, path) !== '' &&
  isPathWithinOrEqual({ parent, candidate: path });
