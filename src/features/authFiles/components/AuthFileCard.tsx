import { useId, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthFileRefreshKey } from '@/features/authFiles/manualRefresh';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconDownload,
  IconInfo,
  IconKey,
  IconModelCluster,
  IconRefreshCw,
  IconSettings,
  IconTrash2,
} from '@/components/ui/icons';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import {
  ResourceActionsMenu,
  type ResourceActionsMenuItem,
} from '@/features/providers/components/ResourceActionsMenu';
import type { AuthFileItem } from '@/types';
import { statusBarDataFromRecentRequests } from '@/utils/recentRequests';
import { formatDateTimeValue, formatFileSize } from '@/utils/format';
import {
  formatModified,
  getAuthFileStatusMessage,
  hasAuthFileStatusWarning,
  getAuthFileIcon,
  getTypeLabel,
  isProblemAuthFile,
  isRuntimeOnlyAuthFile,
  needsAuthFileReauth,
  normalizeProviderKey,
  supportsAuthFileManualRefresh,
  type AuthFileQuotaFilter,
  type ResolvedTheme,
} from '@/features/authFiles/constants';
import { authFileDisplayIdentity, authFilePrivacyIdentities } from '../privacy';
import { privacyIdentity, privacyText } from '@/utils/privacy';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import { useQuotaStore } from '@/stores';
import { QUOTA_ADAPTERS } from '@/features/quota/providers';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { summarizeAuthFileQuota, type AuthFileCachedQuota } from '../quotaSummary';
import { resolveAuthFileQuotaType } from '@/features/authFiles/logic';
import type { AuthFileStatusBarData } from '@/features/authFiles/hooks/useAuthFilesStatusBarCache';
import { AuthFileQuotaSection } from '@/features/authFiles/components/AuthFileQuotaSection';
import { AuthFileCooldownSection } from './AuthFileCooldownSection';
import { getSiwcBindingStatus, supportsSiwcBinding } from '@/features/oauth/siwcBinding';
import { SiwcStatusBadge } from '@/features/oauth/components/SiwcStatusBadge';
import styles from './AuthFileCard.module.scss';

export type AuthFileCardProps = {
  file: AuthFileItem;
  compact: boolean;
  selected: boolean;
  resolvedTheme: ResolvedTheme;
  disableControls: boolean;
  deleting: string | null;
  statusUpdating: Record<string, boolean>;
  manualRefreshing: Record<string, boolean>;
  cooldownResetting: Record<string, boolean>;
  quotaFilterType: AuthFileQuotaFilter;
  statusBarCache: Map<string, AuthFileStatusBarData>;
  /** One-time entrance delay; null/undefined disables entrance motion. */
  entranceDelayMs?: number | null;
  onShowModels: (file: AuthFileItem) => void;
  onDownload: (name: string) => void;
  onManualRefresh: (file: AuthFileItem) => void;
  onCooldownReset: (file: AuthFileItem) => void;
  onOpenPrefixProxyEditor: (file: AuthFileItem) => void;
  onDelete: (name: string) => void;
  onToggleStatus: (file: AuthFileItem, enabled: boolean) => void;
  onToggleSelect: (name: string) => void;
};

export function AuthFileCard(props: AuthFileCardProps) {
  const { t, i18n } = useTranslation();
  const privacy = usePrivacyStore((state) => state.enabled);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const {
    file,
    compact,
    selected,
    resolvedTheme,
    disableControls,
    deleting,
    statusUpdating,
    manualRefreshing,
    cooldownResetting,
    quotaFilterType,
    statusBarCache,
    entranceDelayMs,
    onShowModels,
    onDownload,
    onManualRefresh,
    onCooldownReset,
    onOpenPrefixProxyEditor,
    onDelete,
    onToggleStatus,
    onToggleSelect,
  } = props;

  const isRuntimeOnly = isRuntimeOnlyAuthFile(file);
  const providerKey = normalizeProviderKey(String(file.type ?? file.provider ?? 'unknown'));
  const isAistudio = providerKey === 'aistudio';
  const showModelsButton = !isRuntimeOnly || isAistudio;
  const showManualRefreshButton = !isRuntimeOnly && supportsAuthFileManualRefresh(providerKey);
  const isManualRefreshing = manualRefreshing[getAuthFileRefreshKey(file)] === true;
  const typeLabel = getTypeLabel(t, providerKey);
  const icon = getAuthFileIcon(providerKey, resolvedTheme);

  const quotaType = resolveAuthFileQuotaType(file, quotaFilterType);
  const showQuotaLayout = Boolean(quotaType) && !isRuntimeOnly;

  const successCount = file.successCount ?? 0;
  const failureCount = file.failureCount ?? 0;
  const authIndexKey = typeof file.authIndex === 'string' ? file.authIndex : null;
  const isCooldownResetting = Boolean(authIndexKey && cooldownResetting[authIndexKey]);
  const statusData =
    (authIndexKey && statusBarCache.get(authIndexKey)) ||
    statusBarDataFromRecentRequests(file.recentRequests ?? []);

  const identities = authFilePrivacyIdentities(file);
  const rawStatusMessage = privacyText(privacy, getAuthFileStatusMessage(file), identities);
  const hasStatusWarning = hasAuthFileStatusWarning(file);
  // Same rule as the header's "N problem" count and the Problem filter.
  const isProblem = isProblemAuthFile(file);
  // The known error says the sign-in itself expired: a refresh cannot fix it, a new sign-in can.
  const needsSignIn = needsAuthFileReauth(file);
  const navigate = useNavigate();

  const priorityValue = Number.isSafeInteger(file.priority) ? file.priority : undefined;
  const weightValue = Number.isSafeInteger(file.weight) ? file.weight : undefined;
  // Notes are free-form account labels (e.g. "Primary Max account"): mask them as a whole.
  const noteValue = privacyIdentity(privacy, typeof file.note === 'string' ? file.note.trim() : '');
  // Lead with account identity and use the file name as secondary text.
  const identity = authFileDisplayIdentity(file, privacy);
  const quota = useQuotaStore((state) =>
    quotaType
      ? (QUOTA_ADAPTERS[quotaType].storeSelector(state)[getQuotaCacheKey(file)] as
          AuthFileCachedQuota | undefined)
      : undefined
  );
  const summary = summarizeAuthFileQuota(quota);
  const statusLocked = statusUpdating[getAuthFileRefreshKey(file)] === true;
  const manualRefreshDisabled =
    disableControls || file.disabled === true || statusLocked || isManualRefreshing;
  const deleteDisabled = disableControls || deleting === file.name || isManualRefreshing;
  // Labelled row actions (the ellipsis is a real menu; the chevron alone expands details).
  const menuItems: ResourceActionsMenuItem[] = [
    ...(needsSignIn
      ? [
          {
            key: 'sign-in',
            label: t('auth_files.sign_in_again'),
            icon: <IconKey size={14} />,
            disabled: disableControls,
            onSelect: () => navigate('/oauth'),
          },
        ]
      : []),
    ...(showModelsButton
      ? [
          {
            key: 'models',
            label: t('auth_files.models_button'),
            icon: <IconModelCluster size={14} />,
            disabled: disableControls,
            onSelect: () => onShowModels(file),
          },
        ]
      : []),
    ...(!isRuntimeOnly && showManualRefreshButton
      ? [
          {
            key: 'refresh',
            label: t('auth_files.manual_refresh_button'),
            icon: <IconRefreshCw size={14} />,
            disabled: manualRefreshDisabled,
            onSelect: () => onManualRefresh(file),
          },
        ]
      : []),
    ...(!isRuntimeOnly
      ? [
          {
            key: 'download',
            label: t('auth_files.download_button'),
            icon: <IconDownload size={14} />,
            disabled: disableControls,
            onSelect: () => onDownload(file.name),
          },
          {
            key: 'settings',
            label: t('auth_files.edit_settings_button'),
            icon: <IconSettings size={14} />,
            disabled: disableControls || isManualRefreshing,
            onSelect: () => onOpenPrefixProxyEditor(file),
          },
          {
            key: 'delete',
            label: t('auth_files.delete_button'),
            icon: <IconTrash2 size={14} />,
            danger: true,
            disabled: deleteDisabled,
            onSelect: () => onDelete(file.name),
          },
        ]
      : []),
  ];
  const siwcExpires = file.siwcExpiresAt
    ? formatDateTimeValue(file.siwcExpiresAt, i18n.language)
    : '';

  // Capture the entrance delay once so subsequent updates do not interrupt it.
  const [mountEntranceDelayMs] = useState<number | null>(entranceDelayMs ?? null);
  const cardClasses = [
    styles.card,
    compact ? styles.cardCompact : '',
    selected ? styles.cardSelected : '',
    file.disabled === true ? styles.cardDisabled : '',
    mountEntranceDelayMs != null ? styles.cardEnter : '',
  ]
    .filter(Boolean)
    .join(' ');
  const cardStyle =
    mountEntranceDelayMs != null
      ? ({ '--card-delay': `${mountEntranceDelayMs}ms` } as CSSProperties)
      : undefined;

  return (
    <article className={cardClasses} style={cardStyle}>
      <header className={styles.head}>
        <div className={styles.rowLead}>
          {!isRuntimeOnly && (
            <SelectionCheckbox
              checked={selected}
              onChange={() => onToggleSelect(file.name)}
              ariaLabel={t('auth_files.card_select', { name: identity.fullName })}
              title={t('auth_files.card_select', { name: identity.fullName })}
            />
          )}
          <button
            type="button"
            className={styles.expand}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${t(expanded ? 'common.collapse' : 'common.expand')} ${identity.primary}`}
            onClick={() => setExpanded((value) => !value)}
          >
            <IconChevronDown size={14} />
          </button>
          <span className={styles.providerIcon} title={typeLabel}>
            {icon ? <img src={icon} alt={typeLabel} /> : typeLabel.slice(0, 1)}
          </span>
          <div className={styles.identity}>
            <h3 className={styles.account} title={identity.primary}>
              {identity.primary}
            </h3>
            {identity.secondary && (
              <span className={styles.fileName} title={identity.fullName}>
                {identity.secondary}
              </span>
            )}
            {supportsSiwcBinding(file) && <SiwcStatusBadge status={getSiwcBindingStatus(file)} />}
            {isRuntimeOnly && (
              <span className={styles.runtimeLabel}>{t('auth_files.type_virtual')}</span>
            )}
            {isProblem && (
              <span className={styles.problemLabel} title={rawStatusMessage || undefined}>
                <IconAlertTriangle size={12} aria-hidden="true" />
                {t(needsSignIn ? 'auth_files.problem_label_sign_in' : 'auth_files.problem_label')}
              </span>
            )}
            {file.disabled === true && (
              <span className={styles.disabledLabel}>{t('auth_files.health_status_disabled')}</span>
            )}
          </div>
        </div>
        <div className={styles.plan}>
          <span>{summary.plan || '—'}</span>
          {priorityValue !== undefined && (
            <span className={styles.muted}>
              {t('auth_files.priority_display')} {priorityValue}
            </span>
          )}
        </div>
        <div className={styles.health}>
          <ProviderStatusBar statusData={statusData} styles={styles} />
          <span className={styles.healthCounts}>
            <span>
              {t('stats.success')} {successCount}
            </span>
            <span>
              {t('stats.failure')}{' '}
              {/* Only the number takes the danger tone, so a column of rows stays calm. */}
              <span className={failureCount > 0 ? styles.failureCount : undefined}>
                {failureCount}
              </span>
            </span>
          </span>
        </div>
        <div className={styles.lowest}>
          {summary.lowest ? (
            <>
              <div className={styles.quotaLabel}>
                <span>
                  {summary.lowest.labelKey
                    ? t(summary.lowest.labelKey, summary.lowest.labelParams ?? {})
                    : summary.lowest.label}
                </span>
                <strong>{Math.round(summary.lowest.remaining)}%</strong>
              </div>
              <div className={styles.meter}>
                <span
                  style={{ width: `${summary.lowest.remaining}%` }}
                  data-warning={summary.lowest.remaining < 50 || undefined}
                />
              </div>
            </>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </div>
        <div className={styles.toggleWrap}>
          {!isRuntimeOnly && (
            <ToggleSwitch
              ariaLabel={t('auth_files.card_toggle', { name: identity.fullName })}
              checked={!file.disabled}
              disabled={
                disableControls ||
                statusUpdating[getAuthFileRefreshKey(file)] === true ||
                isManualRefreshing
              }
              onChange={(value) => onToggleStatus(file, value)}
            />
          )}
        </div>
        <div className={styles.more}>
          {menuItems.length > 0 && (
            <ResourceActionsMenu
              label={t('auth_files.row_actions', { name: identity.primary })}
              items={menuItems}
              triggerClassName={styles.moreTrigger}
            />
          )}
        </div>
      </header>
      <div id={detailsId} className={styles.details} hidden={!expanded}>
        {noteValue && (
          <p className={styles.note} title={noteValue}>
            {noteValue}
          </p>
        )}

        {rawStatusMessage && hasStatusWarning && (
          <div className={styles.warning} title={rawStatusMessage}>
            <IconInfo className={styles.warningIcon} size={14} />
            <span className={styles.warningText}>{rawStatusMessage}</span>
            {needsSignIn && (
              <Button
                variant="secondary"
                size="sm"
                className={styles.signInButton}
                onClick={() => navigate('/oauth')}
                disabled={disableControls}
              >
                <IconKey size={14} />
                {t('auth_files.sign_in_again')}
              </Button>
            )}
          </div>
        )}

        <AuthFileCooldownSection
          snapshot={file.cooldownSnapshot}
          resetting={isCooldownResetting}
          resetDisabled={
            disableControls ||
            statusUpdating[getAuthFileRefreshKey(file)] === true ||
            isManualRefreshing
          }
          onReset={authIndexKey ? () => onCooldownReset(file) : undefined}
        />

        <div className={styles.expandedBody}>
          <div className={styles.quotaDetail}>
            {showQuotaLayout && quotaType && (
              <AuthFileQuotaSection
                file={file}
                quotaType={quotaType}
                disableControls={disableControls}
              />
            )}
          </div>
          <div className={styles.fileDetail}>
            <dl className={styles.metaRow}>
              {/* Stacked rows ellipsize identity; the details always show it in full. */}
              {identity.secondary && (
                <div className={styles.metaIdentity}>
                  <dt className={styles.metaMetricLabel}>{t('auth_files.account_column')}</dt>
                  <dd>{identity.primary}</dd>
                </div>
              )}
              <div className={styles.metaIdentity}>
                <dt className={styles.metaMetricLabel}>{t('auth_files.file_name_label')}</dt>
                <dd>{identity.fullName}</dd>
              </div>
              <div>
                <dt className={styles.metaMetricLabel}>{t('auth_files.file_size')}</dt>
                <dd>{file.size ? formatFileSize(file.size) : '—'}</dd>
              </div>
              <div className={styles.metaModified}>
                <dt className={styles.metaMetricLabel}>{t('auth_files.file_modified')}</dt>
                <dd>{formatModified(file, i18n.language)}</dd>
              </div>
              {priorityValue !== undefined && (
                <div title={t('auth_files.priority_hint')}>
                  <dt className={styles.metaMetricLabel}>{t('auth_files.priority_display')}</dt>
                  <dd>{priorityValue}</dd>
                </div>
              )}
              {weightValue !== undefined && (
                <div title={t('auth_files.weight_tooltip')}>
                  <dt className={styles.metaMetricLabel}>{t('auth_files.weight_display')}</dt>
                  <dd>{weightValue}</dd>
                </div>
              )}
            </dl>
            {supportsSiwcBinding(file) && siwcExpires && (
              <span className={styles.siwcExpires} title={file.siwcExpiresAt}>
                {t('siwc.expires', { date: siwcExpires })}
              </span>
            )}
          </div>
        </div>

        <footer className={styles.actions}>
          <div className={styles.actionsMain}>
            {showModelsButton && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onShowModels(file)}
                title={t('auth_files.models_button')}
                disabled={disableControls}
              >
                <IconModelCluster size={14} />
                {t('auth_files.models_button')}
              </Button>
            )}
            {!isRuntimeOnly && (
              <div className={styles.utilityActions}>
                {showManualRefreshButton && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onManualRefresh(file)}
                    title={t('auth_files.manual_refresh_button')}
                    aria-label={t('auth_files.manual_refresh_button')}
                    disabled={manualRefreshDisabled}
                  >
                    {isManualRefreshing ? (
                      <LoadingSpinner size={14} />
                    ) : (
                      <IconRefreshCw size={14} />
                    )}
                    {t('auth_files.manual_refresh_button')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onDownload(file.name)}
                  title={t('auth_files.download_button')}
                  disabled={disableControls}
                >
                  <IconDownload size={14} />
                  {t('auth_files.download_button')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenPrefixProxyEditor(file)}
                  title={t('auth_files.prefix_proxy_button')}
                  disabled={disableControls || isManualRefreshing}
                >
                  <IconSettings size={14} />
                  {t('auth_files.edit_settings_button')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(file.name)}
                  className={styles.deleteButton}
                  title={t('auth_files.delete_button')}
                  aria-label={t('auth_files.delete_button')}
                  disabled={deleteDisabled}
                >
                  {deleting === file.name ? <LoadingSpinner size={14} /> : <IconTrash2 size={14} />}
                  {t('common.delete')}
                </Button>
              </div>
            )}
          </div>
        </footer>
      </div>
    </article>
  );
}
