import { isAbsolute, relative, sep } from 'node:path';

/*
  isInside({ parent: '/repo', candidate: '/repo' }) // true
  isStrictlyInside({ parent: '/repo', candidate: '/repo' }) // false
 */

// The parent itself is inside the parent.
export const isInside = ({
  parent,
  candidate,
}: {
  parent: string;
  candidate: string;
}): boolean => {
  const pathToCandidate = relative(parent, candidate);
  return (
    pathToCandidate === '' ||
    (!pathToCandidate.startsWith(`..${sep}`) &&
      pathToCandidate !== '..' &&
      !isAbsolute(pathToCandidate))
  );
};

export const isStrictlyInside = ({
  parent,
  candidate,
}: {
  parent: string;
  candidate: string;
}): boolean => parent !== candidate && isInside({ parent, candidate });
