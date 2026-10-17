/**
 * Objective: Compose the Maestro extension for builder, verifier, and simplifier subagent sessions.
 * Used: When Pi starts a Maestro subagent session.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { registerRecordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { registerRecordSimplifierHandoffTool } from '#tools/child/record-simplifier-handoff.ts';
import { registerRecordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';

export default (pi: ExtensionAPI): void => {
  registerRecordBuilderHandoffTool(pi);
  registerRecordVerifierHandoffTool(pi);
  registerRecordSimplifierHandoffTool(pi);
};
