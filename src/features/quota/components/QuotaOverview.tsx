import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { getAuthFileIcon, getTypeLabel } from '@/features/authFiles/constants';
import { useNow } from '@/hooks/useNow';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import type { ResolvedTheme } from '@/types';
import { formatInstantShort, formatRelativeInstant } from '@/utils/quota';
import { getQuotaCacheKey, getQuotaPrivacyDisplayName } from '@/utils/quota/identity';
import { privacyText } from '@/utils/privacy';
import type { QuotaFileEntry } from '../logic';
import { quotaOverviewWindows, representativeQuotaWindow, upcomingQuotaResets } from '../overview';
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

interface Props {
  entries: QuotaFileEntry[];
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined;
  resolvedTheme: ResolvedTheme;
}

export function QuotaSummary({ entries, quotaFor, resolvedTheme }: Props) {
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
      return { type, accounts, observations, lowest };
    });
  }, [entries, quotaFor]);
  if (groups.length === 0) return null;
  return (
    <section className={styles.summary} aria-label={t('quota_management.summary_label')}>
      {groups.map(({ type, accounts, observations, lowest }) => {
        const window = lowest?.window;
        const identities = accounts.flatMap(({ file }) => [file.email, file.projectId]);
        const label = window
          ? privacyText(
              privacyEnabled,
              window.labelKey ? t(window.labelKey, window.labelParams) : window.label,
              identities
            )
          : t(`${type}_quota.idle`);
        return (
          <article key={type} className={styles.summaryItem}>
            <div className={styles.summaryHead}>
              <QuotaProviderHeading type={type} resolvedTheme={resolvedTheme} />
              <span>{t('quota_management.meta_credentials', { count: accounts.length })}</span>
            </div>
            {!window ? (
              <div className={styles.summaryEmpty}>
                <IconRefreshCw size={18} aria-hidden="true" />
                <div>
                  <p>{t('quota_management.not_loaded')}</p>
                  <span>{t('quota_management.empty_hint')}</span>
                </div>
              </div>
            ) : (
              <>
                <p className={styles.windowLabel} title={label}>
                  {label}
                </p>
                <div className={styles.headline}>
                  <strong>
                    {window?.remaining === undefined || window.remaining === null
                      ? '—'
                      : `${Math.round(window.remaining)}%`}
                  </strong>
                  {lowest && (
                    <span title={getQuotaPrivacyDisplayName(lowest.entry.file, privacyEnabled)}>
                      {t('quota_management.lowest')}
                    </span>
                  )}
                </div>
                <div className={styles.meters}>
                  {observations.map(({ entry, window: observation }) => (
                    <div
                      key={getQuotaCacheKey(entry.file)}
                      title={getQuotaPrivacyDisplayName(entry.file, privacyEnabled)}
                    >
                      <QuotaMeter percent={observation.remaining} classes={meterClasses} />
                    </div>
                  ))}
                </div>
                <p className={styles.reset}>
                  {window?.resetAtMs
                    ? `${formatRelativeInstant(window.resetAtMs, now, i18n.resolvedLanguage)} · ${formatInstantShort(window.resetAtMs)}`
                    : '—'}
                </p>
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}

export function UpcomingResets({ entries, quotaFor, resolvedTheme }: Props) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const privacyEnabled = usePrivacyStore((state) => state.enabled);
  const [filter, setFilter] = useState<'all' | 'session' | 'weekly'>('all');
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
  return (
    <section className={styles.upcoming}>
      <header className={styles.upcomingHead}>
        <div>
          <h2>{t('quota_management.upcoming_title')}</h2>
          <p>{t('quota_management.upcoming_description')}</p>
        </div>
        <div
          className={styles.filters}
          role="group"
          aria-label={t('quota_management.upcoming_filter')}
        >
          {(['all', 'session', 'weekly'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setExpanded(false);
              }}
            >
              {value === 'all'
                ? t('auth_files.filter_all')
                : t(`quota_management.windows_mode_${value}`)}
            </button>
          ))}
        </div>
      </header>
      {visible.length === 0 && (
        <p className={styles.empty} role="status">
          {t('quota_management.upcoming_empty')}
        </p>
      )}
      {visible.map(({ key, entry, window }, index) => {
        const date = new Date(window.resetAtMs);
        const day = date.toLocaleDateString(i18n.resolvedLanguage, {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });
        const previousDay = index
          ? new Date(visible[index - 1].window.resetAtMs).toDateString()
          : '';
        const name = getQuotaPrivacyDisplayName(entry.file, privacyEnabled);
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
              <time dateTime={date.toISOString()}>
                {date.toLocaleTimeString(i18n.resolvedLanguage, {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </time>
              <span className={styles.resetIdentity}>
                {icon && <img src={icon} width={24} height={24} alt="" />}
                <span title={name}>{name}</span>
              </span>
              <span className={styles.resetWindow} title={label}>
                {label}
              </span>
              <span className={styles.resetMeter}>
                <QuotaMeter percent={window.remaining} classes={meterClasses} />
                <b>{window.remaining === null ? '—' : `${Math.round(window.remaining)}%`}</b>
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
