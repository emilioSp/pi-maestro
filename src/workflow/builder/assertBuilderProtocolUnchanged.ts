/**
 * Objective: Reject changes to spec.md after a builder session starts.
 * Used: Before a builder tool writes a terminal workflow artifact.
 */

import type { MaestroPaths } from '#MaestroPaths.ts';
import maestroSessionState from '#maestro/session/MaestroSessionState.ts';
import { getFileSha256 } from '#utils/getFileSha256.ts';

type AssertBuilderProtocolUnchangedInput = {
  paths: MaestroPaths;
  specId: string;
};

export const assertBuilderProtocolUnchanged = async ({
  paths,
  specId,
}: AssertBuilderProtocolUnchangedInput): Promise<void> => {
  const expectedSpecSha256 = maestroSessionState.getSpecSha256();

  if (expectedSpecSha256 === null) {
    throw new Error('Builder spec SHA-256 baseline is not initialized.');
  }

  const specPath = paths.getSpecFilePath(specId);
  const actualSpecSha256 = await getFileSha256({ path: specPath });

  if (actualSpecSha256 !== expectedSpecSha256) {
    throw new Error(`Builder changed spec.md after launch: "${specPath}".`);
  }
};
