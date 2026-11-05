import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/ui/Collapsible';
import { formatPercent } from '@/utils/format';
import { TRAFFIC_BUCKET_MINUTES, type TrafficWindow } from '../types';
import { axisMax, bucketRangeLabel, bucketStartLabel } from '../utils';
import { buildSmoothLinePath } from './curve';
import styles from './ThroughputChart.module.scss';

/** 纵轴刻度条数（含 0），即 TICK_COUNT - 1 个间隔 */
const TICK_COUNT = 5;

interface ThroughputChartProps {
  traffic: TrafficWindow;
}

export function ThroughputChart({ traffic }: ThroughputChartProps) {
  const { t } = useTranslation();
  const gradientId = useId();
  const tooltipId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { buckets, totalSuccess, totalFailure, total, peakIndex, peakTotal } = traffic;
  const scaleMax = useMemo(() => axisMax(peakTotal, TICK_COUNT - 1), [peakTotal]);

  const geometry = useMemo(() => {
    const points = buckets.map((bucket, index) => ({
      x: ((index + 0.5) / buckets.length) * 1000,
      y: 200 - (bucket.success / scaleMax) * 200,
    }));
    const failures = points.map((point, index) => ({
      x: point.x,
      y: 200 - (buckets[index].failed / scaleMax) * 200,
    }));
    const line = buildSmoothLinePath(points, 0, 200);
    const first = points[0];
    const last = points[points.length - 1];
    return {
      line,
      area: first && last ? `${line} L${last.x} 200 L${first.x} 200 Z` : '',
      failures: buildSmoothLinePath(failures, 0, 200),
    };
  }, [buckets, scaleMax]);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, index) => {
        const ratio = 1 - index / (TICK_COUNT - 1);
        return { ratio, value: Math.round(scaleMax * ratio) };
      }),
    [scaleMax]
  );

  const xAxisTicks = useMemo(() => {
    if (buckets.length === 0) return [];
    const positions = [0, Math.floor((buckets.length - 1) / 2), buckets.length - 1];
    return Array.from(new Set(positions)).map((index) => ({
      index,
      label: bucketStartLabel(buckets[index]?.time, index, buckets.length),
    }));
  }, [buckets]);

  const summary = t('dashboard.traffic_chart_summary', {
    total,
    success: totalSuccess,
    failed: totalFailure,
    minutes: traffic.windowMinutes,
  });

  const activeBucket = activeIndex === null ? null : buckets[activeIndex];

  if (buckets.length === 0) {
    return (
      <div className={styles.placeholder}>
        <p className={styles.placeholderTitle}>{t('dashboard.traffic_unavailable')}</p>
        <p className={styles.placeholderHint}>{t('dashboard.traffic_unavailable_hint')}</p>
      </div>
    );
  }

  return (
    <figure className={styles.chart}>
      {/* 两条序列 → 图例常驻，并直接带上数值（浅色主题下绿色对比度偏低，数值即为补偿） */}
      <figcaption className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchSuccess}`} aria-hidden="true" />
          {t('stats.success')}
          <b className={styles.legendValue}>{totalSuccess.toLocaleString()}</b>
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchFailure}`} aria-hidden="true" />
          {t('stats.failure')}
          <b className={styles.legendValue}>{totalFailure.toLocaleString()}</b>
        </span>
      </figcaption>

      <div className={styles.plot}>
        <div className={styles.yAxis} aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick.ratio}
              className={styles.yTick}
              style={{ top: `${(1 - tick.ratio) * 100}%` }}
            >
              {tick.value.toLocaleString()}
            </span>
          ))}
        </div>

        <div className={styles.canvas}>
          <div className={styles.gridlines} aria-hidden="true">
            {ticks.map((tick) => (
              <span
                key={tick.ratio}
                className={styles.gridline}
                style={{ top: `${(1 - tick.ratio) * 100}%` }}
              />
            ))}
          </div>

          <svg
            className={styles.series}
            viewBox="0 0 1000 200"
            preserveAspectRatio="none"
            role="img"
            aria-label={summary}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--text-secondary)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--text-secondary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={geometry.area} fill={`url(#${gradientId})`} />
            <path className={styles.successLine} d={geometry.line} />
            {totalFailure > 0 && <path className={styles.failureLine} d={geometry.failures} />}
          </svg>
          <div className={styles.columns} onMouseLeave={() => setActiveIndex(null)}>
            {buckets.map((bucket, index) => {
              const bucketTotal = bucket.success + bucket.failed;
              const range = bucketRangeLabel(bucket.time, index, buckets.length);
              return (
                <button
                  type="button"
                  key={bucket.time ?? index}
                  className={`${styles.column} ${activeIndex === index ? styles.columnActive : ''}`}
                  aria-label={`${range}: ${t('dashboard.traffic_chart_summary', {
                    total: bucketTotal,
                    success: bucket.success,
                    failed: bucket.failed,
                    minutes: TRAFFIC_BUCKET_MINUTES,
                  })}`}
                  aria-describedby={activeIndex === index ? tooltipId : undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  onClick={() => setActiveIndex(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setActiveIndex(null);
                    const next =
                      event.key === 'ArrowRight'
                        ? event.currentTarget.nextElementSibling
                        : event.key === 'ArrowLeft'
                          ? event.currentTarget.previousElementSibling
                          : null;
                    if (next instanceof HTMLButtonElement) {
                      event.preventDefault();
                      next.focus();
                    }
                  }}
                >
                  {index === peakIndex && peakTotal > 0 && (
                    <span
                      className={styles.peakLabel}
                      style={{ bottom: `${Math.min(100, (bucketTotal / scaleMax) * 100)}%` }}
                    >
                      {peakTotal.toLocaleString()}
                    </span>
                  )}
                  <span
                    className={styles.activePoint}
                    style={{ bottom: `${(bucket.success / scaleMax) * 100}%` }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          {total === 0 && <p className={styles.noRequests}>{t('status_bar.no_requests')}</p>}

          {activeBucket && (
            <div
              className={styles.tooltip}
              style={{
                left: `${((activeIndex! + 0.5) / buckets.length) * 100}%`,
                transform:
                  activeIndex! < buckets.length * 0.15
                    ? 'translateX(0)'
                    : activeIndex! > buckets.length * 0.85
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
              }}
              id={tooltipId}
              role="status"
            >
              <span className={styles.tooltipTime}>
                {bucketRangeLabel(activeBucket.time, activeIndex!, buckets.length)}
              </span>
              <span className={styles.tooltipRow}>
                <span
                  className={`${styles.legendSwatch} ${styles.swatchSuccess}`}
                  aria-hidden="true"
                />
                {t('stats.success')}
                <b>{activeBucket.success.toLocaleString()}</b>
              </span>
              <span className={styles.tooltipRow}>
                <span
                  className={`${styles.legendSwatch} ${styles.swatchFailure}`}
                  aria-hidden="true"
                />
                {t('stats.failure')}
                <b>{activeBucket.failed.toLocaleString()}</b>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.xAxis} aria-hidden="true">
        {xAxisTicks.map((tick) => (
          <span
            key={tick.index}
            className={styles.xTick}
            style={{ left: `${((tick.index + 0.5) / buckets.length) * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      <Collapsible className={styles.tableToggle} label={t('dashboard.traffic_table')}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('dashboard.traffic_table_window')}</th>
              <th scope="col">{t('stats.success')}</th>
              <th scope="col">{t('stats.failure')}</th>
              <th scope="col">{t('dashboard.success_rate')}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket, index) => {
              const bucketTotal = bucket.success + bucket.failed;
              return (
                <tr key={bucket.time ?? index}>
                  <th scope="row">{bucketRangeLabel(bucket.time, index, buckets.length)}</th>
                  <td>{bucket.success.toLocaleString()}</td>
                  <td>{bucket.failed.toLocaleString()}</td>
                  <td>
                    {bucketTotal > 0 ? formatPercent((bucket.success / bucketTotal) * 100) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Collapsible>
    </figure>
  );
}
