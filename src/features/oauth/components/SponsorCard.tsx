import { useId } from 'react';
import { IconExternalLink, IconPlus } from '@/components/ui/icons';
import type { ProviderFlowState } from '../hooks/useOAuthFlows';
import { BrandGlyph } from './BrandGlyph';
import styles from './SponsorCard.module.scss';

export interface SponsorCardSite {
  id: string;
  /** 完整站点名（如「Kimi 国内站」），作为登录按钮的可访问名称。 */
  name: string;
  /** 卡内可见的站点短名（如「国内站」），是 name 的子串，满足 label-in-name。 */
  region: string;
  domain: string;
  status?: ProviderFlowState['status'];
  statusLabel?: string;
  signUpUrl: string;
}

export interface SponsorCardProps {
  title: string;
  caption: string;
  icon: string;
  signUpLabel: string;
  /** Visible verb on each site entry ("Sign in"); falls back to a plus. */
  signInLabel?: string;
  sites: SponsorCardSite[];
  /** 点站点入口：开始该站登录并打开授权对话框。 */
  onOpen: (siteId: string) => void;
}

export function SponsorCard({
  title,
  caption,
  icon,
  signUpLabel,
  signInLabel,
  sites,
  onOpen,
}: SponsorCardProps) {
  const titleId = useId();
  return (
    <div className={styles.card} role="group" aria-labelledby={titleId}>
      <div className={styles.head}>
        <BrandGlyph src={icon} size={40} className={styles.glyph} />
        <div className={styles.headText}>
          <p className={styles.title} id={titleId}>
            {title}
          </p>
          <p className={styles.caption}>{caption}</p>
        </div>
      </div>

      <div className={styles.sites}>
        {sites.map((site) => (
          <SiteEntry
            key={site.id}
            site={site}
            signUpLabel={signUpLabel}
            signInLabel={signInLabel}
            onOpen={() => onOpen(site.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SiteEntry({
  site,
  signUpLabel,
  signInLabel,
  onOpen,
}: {
  site: SponsorCardSite;
  signUpLabel: string;
  signInLabel?: string;
  onOpen: () => void;
}) {
  const metaId = useId();

  return (
    <div className={styles.site} data-status={site.status ?? 'idle'}>
      <div className={styles.siteBody}>
        <span className={styles.siteText}>
          <button
            type="button"
            className={styles.siteMain}
            onClick={onOpen}
            aria-label={site.name}
            aria-haspopup="dialog"
            aria-describedby={metaId}
          >
            {site.region}
          </button>
          <span className={styles.siteMeta} id={metaId}>
            {site.status && site.statusLabel ? (
              <span className={styles.status}>
                <span className={styles.statusDot} aria-hidden="true" />
                {site.statusLabel}
              </span>
            ) : (
              site.domain
            )}
          </span>
        </span>
        <a
          className={styles.signUp}
          href={site.signUpUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${signUpLabel} · ${site.name}`}
        >
          <IconExternalLink size={14} aria-hidden="true" />
          {signUpLabel}
        </a>
        <span className={styles.trail} aria-hidden="true">
          {signInLabel ? (
            <span className={styles.trailLabel}>{signInLabel}</span>
          ) : (
            <IconPlus size={15} />
          )}
        </span>
      </div>
    </div>
  );
}
