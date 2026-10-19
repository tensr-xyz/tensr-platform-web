export type AgentVersion = 'v1' | 'v2';

/** Missing or unknown values use v2. An explicit v1 still selects v1. */
export function storedAgentVersion(value: unknown): AgentVersion {
  return value === 'v1' ? 'v1' : 'v2';
}

export function resolveAgentVersion(input: {
  isPersonalAccount: boolean;
  userAgentVersion?: string | null;
  organizationAgentVersion?: string | null;
}): AgentVersion {
  const raw = input.isPersonalAccount ? input.userAgentVersion : input.organizationAgentVersion;
  return storedAgentVersion(raw);
}
