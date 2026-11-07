import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconAlertTriangle, IconRefreshCw } from '@/components/ui/icons';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { getAuthFileIcon, getTypeLabel } from '@/features/authFiles/constants';
import { useNow } from '@/hooks/useNow';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import type { ResolvedTheme } from '@/types';
import { prefersReducedMotion } from '@/hooks/motion';
import { formatDisplayDay, formatDisplayTime } from '@/utils/dateFormat';
import { formatInstantShort, formatRelativeInstant } from '@/utils/quota';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { resolveTimeZoneLabel } from '@/utils/time/timezone';
import { privacyText } from '@/utils/privacy';
import { quotaAccountLabel } from '../accountLabel';
import { quotaRowDomId, type QuotaFileEntry } from '../logic';
import {
  isQuotaLow,
  quotaOverviewWindows,
  quotaSummaryState,
  representativeQuotaWindow,
  upcomingQuotaResets,
} from '../overview';
import type { QuotaCardState } from '../providers';
import type { QuotaProviderType } from '../providers/types';
import { bindQuotaClasses } from '../types';
import { QuotaMeter } from './QuotaMeter';
import bodyStyles from './QuotaBody.module.scss';
import styles from './QuotaOverview.module.scss';

const meterClasses = bindQuotaClasses(bodyStyles, 'QuotaBody.module.scss');

export function QuotaProviderHeading({
  type,
  resolvedTheme,
  count,
}: {
  type: QuotaProviderType;
  resolvedTheme: ResolvedTheme;
  count?: number;
}) {
  const { t } = useTranslation();
  const icon = getAuthFileIcon(type, resolvedTheme);
  return (
    <div className={styles.provider}>
      {icon && <img src={icon} width={24} height={24} alt="" />}
      <h2>{getTypeLabel(t, type)}</h2>
      {count !== undefined && <span>{count}</span>}
    </div>
  );
}

/** Bring a credential's row into view and move focus to it (keyboard and screen readers). */
function jumpToRow(entry: QuotaFileEntry) {
  const row = document.getElementById(quotaRowDomId(entry));
  if (!row) return;
  row.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  row.focus({ preventScroll: true });
}

interface Props {
  entries: QuotaFileEntry[];
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined;
  resolvedTheme: ResolvedTheme;
}

interface SummaryProps extends Props {
  /** Shown in the single page-level notice when nothing has been loaded yet. */
  onLoadAll?: () => void;
  loadDisabled?: boolean;
}

export function QuotaSummary({
  entries,
  quotaFor,
  resolvedTheme,
  onLoadAll,
  loadDisabled,
}: SummaryProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const privacyEnabled = usePrivacyStore((state) => state.enabled);
  const groups = useMemo(() => {
    const types = [...new Set(entries.map((entry) => entry.type))];
    return types.map((type) => {
      const accounts = entries.filter((entry) => entry.type === type);
      const observations = accounts.flatMap((entry) => {
        const window = representativeQuotaWindow(quotaOverviewWindows(type, quotaFor(entry)), type);
        return window ? [{ entry, window }] : [];
      });
      const lowest = [...observations].sort((a, b) => a.window.remaining! - b.window.remaining!)[0];
      const statuses = accounts.map((entry) => quotaFor(entry)?.status);
      const state = quotaSummaryState(Boolean(lowest), statuses);
      // Coverage: a healthy headline must not hide credentials that failed or never loaded.
      const loaded = statuses.filter((status) => status === 'success').length;
      const failed = accounts.filter((entry) => quotaFor(entry)?.status === 'error');
      return { type, accounts, observations, lowest, state, loaded, failed };
    });
  }, [entries, quotaFor]);
  if (groups.length === 0) return null;

  // Nothing requested yet: one page-level explanation instead of a card per provider.
  if (groups.every((group) => group.state === 'idle')) {
    return (
      <section className={styles.notLoaded} role="status">
        <span className={styles.notLoadedIcon} aria-hidden="true">
          <IconRefreshCw size={16} />
        </span>
        <p className={styles.notLoadedCopy}>{t('quota_management.not_loaded')}</p>
        {onLoadAll && (
          <Button variant="secondary" size="sm" onClick={onLoadAll} disabled={loadDisabled}>
            {t('quota_management.load_all')}
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className={styles.summary} aria-label={t('quota_management.summary_label')}>
      {groups.map(({ type, accounts, observations, lowest, state, loaded, failed }) => {
        const window = lowest?.window;
        const identities = accounts.flatMap(({ file }) => [file.email, file.projectId]);
        const label = window
          ? privacyText(
              privacyEnabled,
              window.labelKey ? t(window.labelKey, window.labelParams) : window.label,
              identities
            )
          : '';
        const lowestName = lowest
          ? quotaAccountLabel(lowest.entry.file, privacyEnabled).primary
          : '';
        const resetText = window?.resetAtMs
          ? t('quota_management.summary_resets', {
              relative: formatRelativeInstant(window.resetAtMs, now, i18n.resolvedLanguage),
              at: formatInstantShort(window.resetAtMs),
            })
          : null;
        const partial = state !== 'loading' && loaded < accounts.length;
        const providerLabel = getTypeLabel(t, type);
        const failureLine =
          failed.length > 0 ? (
            <p className={styles.coverageAlert}>
              <IconAlertTriangle size={14} aria-hidden="true" />
              <span>{t('quota_management.summary_failed', { count: failed.length })}</span>
              <button
                type="button"
                className={styles.coverageJump}
                aria-label={t('quota_management.summary_view_failed_aria', {
                  provider: providerLabel,
                })}
                onClick={() => jumpToRow(failed[0])}
              >
                {t('quota_management.summary_view_failed')}
              </button>
            </p>
          ) : null;
        return (
          <article
            key={type}
            className={styles.summaryItem}
            data-state={state}
            data-partial={partial || undefined}
          >
            <div className={styles.summaryHead}>
              <QuotaProviderHeading type={type} resolvedTheme={resolvedTheme} />
              <span>
                {partial
                  ? t('quota_management.summary_coverage', {
                      loaded,
                      count: accounts.length,
                    })
                  : t('quota_management.meta_credentials', { count: accounts.length })}
              </span>
            </div>
            {state === 'data' && window ? (
              <>
                <p className={styles.windowLabel}>{label}</p>
                <div className={styles.headline}>
                  <strong>
                    {window.remaining === null ? '—' : `${Math.round(window.remaining)}%`}
                  </strong>
                  <span>{t('quota_management.remaining_label')}</span>
                  {isQuotaLow(window.remaining) && (
                    <span className={styles.lowState}>{t('quota_management.low_state')}</span>
                  )}
                </div>
                {/* One segment per credential, so every account's level stays visible. */}
                <div className={styles.meters}>
                  {observations.map(({ entry, window: observation }) => {
                    const name = quotaAccountLabel(entry.file, privacyEnabled).primary;
                    const value =
                      observation.remaining === null
                        ? '—'
                        : `${Math.round(observation.remaining)}%`;
                    return (
                      <div key={getQuotaCacheKey(entry.file)} title={`${name} · ${value}`}>
                        <QuotaMeter percent={observation.remaining} classes={meterClasses} />
                      </div>
                    );
                  })}
                </div>
                <p className={styles.reset}>
                  {observations.length > 1 && (
                    <span title={lowestName}>
                      {t('quota_management.lowest_of', { count: observations.length })}
                    </span>
                  )}
                  {observations.length > 1 && resetText && <span aria-hidden="true"> · </span>}
                  {resetText && <span>{resetText}</span>}
                </p>
                {failureLine}
              </>
            ) : (
              <div className={styles.summaryState}>
                {state === 'error' && (
                  <IconAlertTriangle size={16} aria-hidden="true" className={styles.stateIcon} />
                )}
                <div>
                  <p className={styles.stateTitle}>{t(`quota_management.summary_${state}`)}</p>
                  {state === 'unavailable' && (
                    <span className={styles.stateHint}>
                      {t(`quota_management.summary_${state}_hint`)}
                    </span>
                  )}
                  {state === 'error' && failureLine}
                </div>
              </div>
            )}
            {state !== 'data' && state !== 'error' && failureLine}
          </article>
        );
      })}
    </section>
  );
}

type ResetFilter = 'all' | 'session' | 'weekly';

export function UpcomingResets({ entries, quotaFor, resolvedTheme }: Props) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const privacyEnabled = usePrivacyStore((state) => state.enabled);
  const [filter, setFilter] = useState<ResetFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const resets = useMemo(
    () => upcomingQuotaResets(entries, quotaFor, now),
    [entries, quotaFor, now]
  );
  const filtered = resets.filter(
    ({ window }) =>
      filter === 'all' ||
      (filter === 'session' ? window.periodHours === 5 : window.periodHours === 168)
  );
  const visible = expanded ? filtered : filtered.slice(0, 5);
  if (resets.length === 0) return null;
  const filterOptions = (['all', 'session', 'weekly'] as const).map((value) => ({
    value,
    label:
      value === 'all' ? t('auth_files.filter_all') : t(`quota_management.windows_mode_${value}`),
  }));
  return (
    <section className={styles.upcoming}>
      <header className={styles.upcomingHead}>
        <div>
          <h2>{t('quota_management.upcoming_title')}</h2>
          <p>
            {t('quota_management.upcoming_description')}
            <span aria-hidden="true"> · </span>
            {t('quota_management.upcoming_timezone', { zone: resolveTimeZoneLabel(new Date(now)) })}
          </p>
        </div>
        <SegmentedControl
          options={filterOptions}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setExpanded(false);
          }}
          ariaLabel={t('quota_management.upcoming_filter')}
        />
      </header>
      {visible.length === 0 && (
        <p className={styles.empty} role="status">
          {t('quota_management.upcoming_empty')}
        </p>
      )}
      {visible.map(({ key, entry, window }, index) => {
        const date = new Date(window.resetAtMs);
        const day = formatDisplayDay(date, i18n.resolvedLanguage);
        const previousDay = index
          ? new Date(visible[index - 1].window.resetAtMs).toDateString()
          : '';
        const account = quotaAccountLabel(entry.file, privacyEnabled);
        const label = privacyText(
          privacyEnabled,
          window.labelKey ? t(window.labelKey, window.labelParams) : window.label,
          [entry.file.email, entry.file.projectId]
        );
        const icon = getAuthFileIcon(entry.type, resolvedTheme);
        return (
          <Fragment key={key}>
            {date.toDateString() !== previousDay && <h3 className={styles.day}>{day}</h3>}
            <div className={styles.resetRow}>
              <time className={styles.resetTime} dateTime={date.toISOString()}>
                {formatDisplayTime(date, i18n.resolvedLanguage)}
              </time>
              <span className={styles.resetIdentity}>
                {icon ? (
                  <img src={icon} width={20} height={20} alt={getTypeLabel(t, entry.type)} />
                ) : null}
                <span className={styles.resetText}>
                  <span className={styles.resetName} title={account.secondary ?? account.primary}>
                    {account.primary}
                  </span>
                  <span className={styles.resetWindow}>{label}</span>
                </span>
              </span>
              <span className={styles.resetMeter}>
                <QuotaMeter percent={window.remaining} classes={meterClasses} />
                <b>
                  {window.remaining === null
                    ? '—'
                    : t('quota_management.percent_left', {
                        percent: Math.round(window.remaining),
                      })}
                  {isQuotaLow(window.remaining) && (
                    <span className={styles.lowState}> · {t('quota_management.low_state')}</span>
                  )}
                </b>
              </span>
              <span className={styles.resetRelative}>
                {formatRelativeInstant(window.resetAtMs, now, i18n.resolvedLanguage)}
              </span>
            </div>
          </Fragment>
        );
      })}
      {filtered.length > 5 && (
        <button
          className={styles.showAll}
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? t('quota_management.upcoming_show_less')
            : t('quota_management.upcoming_show_all', { count: filtered.length })}
        </button>
      )}
    </section>
  );
}
