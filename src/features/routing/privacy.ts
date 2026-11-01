import type { RoutingMember } from '@/types/routing';
import { privacyFileName, privacyIdentity, privacyText } from '@/utils/privacy';

/** Display values only. Keep member keys, locations and draft values intact for writes. */
export function routingMemberDisplay(member: RoutingMember, enabled: boolean) {
  const identities = member.kind === 'credential' ? [member.name] : [];
  return {
    name:
      member.kind === 'credential'
        ? privacyIdentity(enabled, member.name)
        : privacyText(enabled, member.name),
    detail: privacyFileName(enabled, member.detail, identities),
  };
}

export function routingWeightLabel(member: RoutingMember, label: string, enabled: boolean): string {
  return member.kind === 'credential'
    ? privacyIdentity(enabled, label)
    : privacyText(enabled, label);
}
