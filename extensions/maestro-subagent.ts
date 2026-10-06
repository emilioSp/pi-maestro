/**
 * Objective: Compose the Maestro extension for builder and verifier subagent sessions.
 * Used: When Pi starts a Maestro subagent session.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerOpenEscalationTool } from '#tools/child/open-escalation.ts';
import { registerRecordBuilderHandoffTool } from '#tools/child/record-builder-handoff.ts';
import { registerRecordVerifierHandoffTool } from '#tools/child/record-verifier-handoff.ts';

export default (pi: ExtensionAPI): void => {
  registerOpenEscalationTool(pi);
  registerRecordBuilderHandoffTool(pi);
  registerRecordVerifierHandoffTool(pi);
};
