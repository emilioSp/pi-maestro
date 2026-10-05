/**
 * Objective: Check lexical path containment, including the parent itself.
 * Used: When Maestro validates configured and generated paths.
 */

import { isAbsolute, relative, sep } from 'node:path';

type IsPathWithinOrEqualInput = {
  parent: string;
  candidate: string;
};

export const isPathWithinOrEqual = ({
  parent,
  candidate,
}: IsPathWithinOrEqualInput): boolean => {
  const pathToCandidate = relative(parent, candidate);

  return (
    pathToCandidate === '' ||
    (!pathToCandidate.startsWith(`..${sep}`) &&
      pathToCandidate !== '..' &&
      !isAbsolute(pathToCandidate))
  );
};
