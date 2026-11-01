import { privacyText } from '@/utils/privacy';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { useTranslation } from 'react-i18next';
import { IconEye, IconPencil, IconTrash2 } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import {
  getOpenAIProviderRecentStatusData,
  getOpenAIProviderTotalStats,
  getProviderRecentStatusData,
  getProviderTotalStats,
  getProviderUsageKey,
  type ProviderRecentUsageMap,
} from '@/components/providers/utils';
import type { OpenAIProviderConfig } from '@/types';
import type { StatusBarData } from '@/utils/recentRequests';
import type { ProviderResource } from '../types';
import { getProviderDisplayName } from '../privacy';
import { isMultiProtocolSponsorBrand } from '../sponsorDefinitions';
import { ResourceActionsMenu } from './ResourceActionsMenu';
import styles from './ProviderResourceTable.module.scss';
import statusBarStyles from './providerStatusBar.module.scss';

interface ProviderResourceTableProps {
  resources: ProviderResource[];
  selectedId?: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
}

const columnWidths = ['23%', '18%', '10%', '8%', '20%', '8%', '76px'];

const isSponsorResource = (resource: ProviderResource): boolean =>
  isMultiProtocolSponsorBrand(resource.brand);

const resolveStatusBarData = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): StatusBarData => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderRecentStatusData(resource.raw as OpenAIProviderConfig, usageByProvider);
  }
  return getProviderRecentStatusData(
    usageByProvider,
    getProviderUsageKey(resource.brand),
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

const resolveTotalStats = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): { success: number; failure: number } => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderTotalStats(resource.raw as OpenAIProviderConfig, usageByProvider);
  }
  return getProviderTotalStats(
    usageByProvider,
    getProviderUsageKey(resource.brand),
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

export function ProviderResourceTable({
  resources,
  selectedId,
  disableMutations,
  usageByProvider,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
}: ProviderResourceTableProps) {
  const { t } = useTranslation();
  const privacyEnabled = usePrivacyStore((s) => s.enabled);

  const renderProtocolSummary = (r: ProviderResource) =>
    (r.flags.protocols ?? [])
      .map((protocol) => t(`providersPage.sponsor.protocols.${protocol}`))
      .join(' / ');

  const renderFlags = (r: ProviderResource) => {
    const flags = [
      r.flags.claudeCodeCliProfile && t('providersPage.table.cliProfileTag'),
      r.flags.cloakEnabled && t('providersPage.table.cloakTag'),
      r.flags.websockets && t('providersPage.table.websocketsTag'),
    ].filter(Boolean);
    return flags.length ? (
      <div className={styles.flags}>
        {flags.map((label) => (
          <span key={String(label)} className={styles.flagTag}>
            {label}
          </span>
        ))}
      </div>
    ) : null;
  };

  const renderModelsSummary = (r: ProviderResource) => (
    <span
      className={styles.modelCount}
      title={[
        `${t('providersPage.table.metrics.models')}: ${r.modelCount}`,
        `${t('providersPage.table.metrics.headers')}: ${r.headerCount}`,
        `${t('providersPage.table.metrics.keys')}: ${r.apiKeyEntryCount || Number(Boolean(r.apiKey))}`,
      ].join(' · ')}
    >
      {isSponsorResource(r) ? renderProtocolSummary(r) : r.modelCount}
    </span>
  );

  const renderStatus = (r: ProviderResource) => {
    if (r.disabled) {
      return (
        <StatusBadge status="warning" className={styles.statusBadge}>
          {t('providersPage.status.disabled')}
        </StatusBadge>
      );
    }
    return (
      <StatusBadge status="success" className={styles.statusBadge}>
        {t('providersPage.status.active')}
      </StatusBadge>
    );
  };

  const renderPrimary = (r: ProviderResource) => {
    if (isSponsorResource(r)) {
      return (
        <div className={styles.primaryCell}>
          <span className={styles.primaryName}>{getProviderDisplayName(r, privacyEnabled)}</span>
          <span className={styles.primarySub}>
            {r.apiKeyPreview ?? t('providersPage.status.notConfigured')}
          </span>
        </div>
      );
    }
    if (r.brand === 'openaiCompatibility') {
      const extra = r.apiKeyEntryCount > 1 ? ` · +${r.apiKeyEntryCount - 1}` : '';
      return (
        <div className={styles.primaryCell}>
          <span className={styles.primaryName}>{getProviderDisplayName(r, privacyEnabled)}</span>
          <span className={styles.primarySub}>{(r.apiKeyPreview ?? '—') + extra}</span>
        </div>
      );
    }
    return (
      <div className={styles.primaryCell}>
        <span className={styles.primaryName}>{r.apiKeyPreview ?? '—'}</span>
        {r.authIndex ? (
          <span className={styles.primarySub}>
            {t('providersPage.detail.fields.authIndex')}: {r.authIndex}
          </span>
        ) : null}
      </div>
    );
  };

  const renderBaseUrl = (r: ProviderResource) => {
    if (isSponsorResource(r)) {
      return <span className={styles.baseUrl}>{renderProtocolSummary(r)}</span>;
    }
    if (r.brand === 'claude' && !r.baseUrl) {
      return (
        <span className={styles.baseUrl}>
          https://api.anthropic.com {t('providersPage.status.defaultSuffix')}
        </span>
      );
    }
    return (
      <span className={styles.baseUrl}>
        {privacyText(privacyEnabled, r.baseUrl) || t('providersPage.status.notSet')}
      </span>
    );
  };

  return (
    <div className={styles.tableFrame}>
      <Table
        className={styles.providerTable}
        cols={columnWidths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      >
        <TableHeader>
          <TableRow>
            <TableHead>{t('providersPage.table.key')}</TableHead>
            <TableHead>{t('providersPage.table.baseUrl')}</TableHead>
            <TableHead>{t('providersPage.table.prefix')}</TableHead>
            <TableHead>{t('providersPage.table.metrics.models')}</TableHead>
            <TableHead>{t('providersPage.table.status')}</TableHead>
            <TableHead>{t('providersPage.toast.enabled')}</TableHead>
            <TableHead alignRight className={styles.actionsHead}>
              <span className={styles.srOnly}>{t('providersPage.table.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => {
            return (
              <TableRow key={resource.id} selected={resource.id === selectedId}>
                <TableCell>
                  {renderPrimary(resource)}
                  {renderFlags(resource)}
                </TableCell>
                <TableCell>{renderBaseUrl(resource)}</TableCell>
                <TableCell>
                  {resource.prefix ? (
                    <span className={styles.chip}>
                      {privacyText(privacyEnabled, resource.prefix, [resource.name])}
                    </span>
                  ) : (
                    <span className={styles.baseUrl}>{t('providersPage.status.none')}</span>
                  )}
                </TableCell>
                <TableCell>{renderModelsSummary(resource)}</TableCell>
                <TableCell>
                  <div className={styles.statusCell}>
                    {!usageByProvider || isSponsorResource(resource) || resource.disabled
                      ? renderStatus(resource)
                      : null}
                    {usageByProvider && !isSponsorResource(resource) ? (
                      <>
                        <div className={styles.statusBarWrap}>
                          <ProviderStatusBar
                            statusData={resolveStatusBarData(resource, usageByProvider)}
                            styles={statusBarStyles}
                          />
                        </div>
                        {(() => {
                          const stats = resolveTotalStats(resource, usageByProvider);
                          return (
                            <div className={styles.stats}>
                              <span className={styles.statSuccess}>
                                {t('providersPage.status.okCount', { count: stats.success })}
                              </span>
                              <span
                                className={
                                  stats.failure > 0 ? styles.statFailure : styles.statFailureNone
                                }
                              >
                                {t('providersPage.status.failedCount', { count: stats.failure })}
                              </span>
                            </div>
                          );
                        })()}
                      </>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {onToggleDisabled ? (
                    <span className={styles.toggleWrap} onClick={(e) => e.stopPropagation()}>
                      <ToggleSwitch
                        checked={!resource.disabled}
                        disabled={disableMutations}
                        onChange={(value) => onToggleDisabled(resource, !value)}
                        ariaLabel={
                          resource.disabled
                            ? t('providersPage.actions.enable')
                            : t('providersPage.actions.disable')
                        }
                      />
                    </span>
                  ) : null}
                </TableCell>
                <TableCell
                  alignRight
                  className={[
                    styles.actionsCell,
                    resource.id === selectedId ? styles.actionsCellSelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={t('providersPage.actions.edit')}
                      title={t('providersPage.actions.edit')}
                      disabled={disableMutations}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(resource);
                      }}
                    >
                      <IconPencil size={16} />
                    </button>
                    <ResourceActionsMenu
                      label={t('providersPage.actions.more')}
                      items={[
                        {
                          key: 'view',
                          label: t('providersPage.actions.view'),
                          icon: <IconEye size={14} />,
                          onSelect: () => onView(resource),
                        },
                        {
                          key: 'delete',
                          label: t('providersPage.actions.delete'),
                          icon: <IconTrash2 size={14} />,
                          danger: true,
                          disabled: disableMutations,
                          onSelect: () => onDelete(resource),
                        },
                      ]}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
