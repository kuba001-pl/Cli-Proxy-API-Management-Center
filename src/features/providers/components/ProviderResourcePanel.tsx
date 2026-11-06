import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconExternalLink, IconPlus, IconSearch } from '@/components/ui/icons';
import type { ProviderRecentUsageMap } from '@/components/providers/utils';
import { PROVIDER_LOGOS } from '../brandLogos';
import { PROVIDER_DESCRIPTORS } from '../descriptors';
import { getKimiAffiliateUrl } from '../kimi';
import type { ProviderGroup, ProviderResource } from '../types';
import { ProviderResourceTable } from './ProviderResourceTable';
import { ProviderResourceToolbar } from './ProviderResourceToolbar';
import type { ProviderSortBy, SortDir } from '../types';
import styles from './ProviderResourcePanel.module.scss';

export interface ProviderPanelControls {
  sortBy: ProviderSortBy;
  sortDir: SortDir;
  onSortBy: (value: ProviderSortBy) => void;
  onSortDir: (value: SortDir) => void;
  availableModels: ReadonlyArray<string>;
  selectedModels: ReadonlySet<string>;
  onSelectedModelsChange: (next: Set<string>) => void;
}

interface ProviderResourcePanelProps {
  group: ProviderGroup;
  filter: string;
  onFilterChange: (value: string) => void;
  filteredResources: ProviderResource[];
  selectedId: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  toolbarControls?: ProviderPanelControls;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
  onCreate: () => void;
}

export function ProviderResourcePanel({
  group,
  filter,
  onFilterChange,
  filteredResources,
  selectedId,
  disableMutations,
  usageByProvider,
  toolbarControls,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
  onCreate,
}: ProviderResourcePanelProps) {
  const { t, i18n } = useTranslation();
  const logo = PROVIDER_LOGOS[group.id];
  const providerTitle = t(`providersPage.providerNames.${group.id}`);
  // A provider with no resources yet gets one task, not search/sort tools for empty data.
  const hasResources = group.resources.length > 0;
  const namedEntries = PROVIDER_DESCRIPTORS[group.id]?.supportsName === true;
  const hasActiveFilters =
    filter.trim().length > 0 || (toolbarControls?.selectedModels.size ?? 0) > 0;
  const clearFilters = () => {
    onFilterChange('');
    toolbarControls?.onSelectedModelsChange(new Set());
  };
  const registrationUrl =
    group.id === 'kimi' ? getKimiAffiliateUrl(i18n.resolvedLanguage ?? i18n.language) : null;
  const logoClassName = [
    styles.logo,
    logo?.themeSurface ? styles.logoThemeSurface : '',
    logo?.darkSrc ? styles.logoThemeLight : '',
    logo?.invertOnDark ? styles.logoInvertOnDark : '',
  ]
    .filter(Boolean)
    .join(' ');
  const darkLogoClassName = [
    styles.logo,
    logo?.themeSurface ? styles.logoThemeSurface : '',
    styles.logoThemeDark,
  ]
    .filter(Boolean)
    .join(' ');

  const titleContent = (
    <>
      {logo ? (
        <>
          <img src={logo.src} alt="" aria-hidden="true" className={logoClassName} />
          {logo.darkSrc ? (
            <img src={logo.darkSrc} alt="" aria-hidden="true" className={darkLogoClassName} />
          ) : null}
        </>
      ) : null}
      <h2 className={styles.title}>{providerTitle}</h2>
    </>
  );

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.titleArea}>
            <div className={styles.titleRow}>{titleContent}</div>
            {registrationUrl ? (
              <a
                className={styles.sponsorLink}
                href={registrationUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className={styles.sponsorLinkText}>
                  {t('providersPage.sponsor.registerNow')}
                </span>
                <IconExternalLink className={styles.sponsorLinkIcon} size={14} />
              </a>
            ) : null}
          </div>
          {hasResources ? (
            <dl className={styles.summary}>
              {[
                [
                  'keys',
                  group.resources.reduce(
                    (sum, resource) =>
                      sum + (resource.apiKeyEntryCount || Number(Boolean(resource.apiKey))),
                    0
                  ),
                ],
                ['models', group.resources.reduce((sum, resource) => sum + resource.modelCount, 0)],
                [
                  'headers',
                  group.resources.reduce((sum, resource) => sum + resource.headerCount, 0),
                ],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt>{t(`providersPage.table.metrics.${key}`)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {hasResources ? (
          <div className={styles.headerToolbarRow}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon} aria-hidden="true">
                <IconSearch size={16} />
              </span>
              <input
                aria-label={t('providersPage.table.filterPlaceholder')}
                type="search"
                className={styles.searchInput}
                value={filter}
                onChange={(event) => onFilterChange(event.target.value)}
                placeholder={t('providersPage.table.filterPlaceholder')}
              />
            </div>
            {toolbarControls ? (
              <ProviderResourceToolbar
                key={group.id}
                sortBy={toolbarControls.sortBy}
                sortDir={toolbarControls.sortDir}
                onSortBy={toolbarControls.onSortBy}
                onSortDir={toolbarControls.onSortDir}
                availableModels={toolbarControls.availableModels}
                selectedModels={toolbarControls.selectedModels}
                onSelectedModelsChange={toolbarControls.onSelectedModelsChange}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {!hasResources ? (
        <div className={styles.empty}>
          <h3 className={styles.emptyTitle}>
            {t(
              namedEntries
                ? 'providersPage.table.emptyTitleNamed'
                : 'providersPage.table.emptyTitle',
              { provider: providerTitle }
            )}
          </h3>
          <p className={styles.emptyDescription}>
            {t(
              namedEntries
                ? 'providersPage.table.emptyDescriptionNamed'
                : 'providersPage.table.emptyDescription',
              { provider: providerTitle }
            )}
          </p>
          <Button
            variant="primary"
            size="sm"
            className={styles.emptyAction}
            onClick={onCreate}
            disabled={disableMutations}
          >
            <IconPlus size={16} />
            {t(namedEntries ? 'providersPage.actions.addProvider' : 'providersPage.actions.addKey')}
          </Button>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className={styles.empty}>
          <h3 className={styles.emptyTitle}>{t('providersPage.table.noMatchesTitle')}</h3>
          {hasActiveFilters ? (
            <Button
              variant="secondary"
              size="sm"
              className={styles.emptyAction}
              onClick={clearFilters}
            >
              {t('providersPage.table.clearFilters')}
            </Button>
          ) : null}
        </div>
      ) : (
        <ProviderResourceTable
          resources={filteredResources}
          selectedId={selectedId}
          disableMutations={disableMutations}
          usageByProvider={usageByProvider}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleDisabled={onToggleDisabled}
        />
      )}
    </section>
  );
}
