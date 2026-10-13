export function resolveAgentVersion(input: {
  isPersonalAccount: boolean;
  userAgentVersion?: string | null;
  organizationAgentVersion?: string | null;
}): 'v1' | 'v2' {
  const raw = input.isPersonalAccount ? input.userAgentVersion : input.organizationAgentVersion;
  return raw === 'v2' ? 'v2' : 'v1';
}
