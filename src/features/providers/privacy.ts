import { privacyText } from '@/utils/privacy';
import { isMultiProtocolSponsorBrand } from './sponsorDefinitions';
import type { ProviderResource } from './types';

/**
 * Provider/channel names are configuration labels, not personal data: show them as-is and
 * mask only email-shaped content. Credential previews and brand names are preserved.
 */
export const getProviderDisplayName = (
  resource: ProviderResource,
  privacyEnabled: boolean
): string => {
  if (resource.name && !isMultiProtocolSponsorBrand(resource.brand)) {
    return privacyText(privacyEnabled, resource.name);
  }
  return resource.name ?? resource.apiKeyPreview ?? resource.identifier;
};
