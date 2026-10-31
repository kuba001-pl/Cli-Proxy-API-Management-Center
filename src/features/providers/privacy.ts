import { privacyIdentity } from '@/utils/privacy';
import { isMultiProtocolSponsorBrand } from './sponsorDefinitions';
import type { ProviderResource } from './types';

/** Mask user-defined account/channel labels while preserving credential previews and brand names. */
export const getProviderDisplayName = (
  resource: ProviderResource,
  privacyEnabled: boolean
): string => {
  if (resource.name && !isMultiProtocolSponsorBrand(resource.brand)) {
    return privacyIdentity(privacyEnabled, resource.name);
  }
  return resource.name ?? resource.apiKeyPreview ?? resource.identifier;
};
