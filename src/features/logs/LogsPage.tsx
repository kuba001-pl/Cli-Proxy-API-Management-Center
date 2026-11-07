import { useDeferredValue, useEffect, useMemo, useReducer, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { lockScroll, unlockScroll } from '@/components/ui/scrollLock';
import {
  IconCopy,
  IconCode,
  IconDownload,
  IconEye,
  IconFileText,
  IconInfo,
  IconExternalLink,
  IconEyeOff,
  IconMaximize2,
  IconMinimize2,
  IconRefreshCw,
  IconSearch,
  IconSlidersHorizontal,
  IconTimer,
  IconTrash2,
  IconX,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore, useConfigStore, useNotificationStore, usePrivacyStore } from '@/stores';
import { logsApi, responseDataToText, type ErrorLogFile } from '@/services/api/logs';
import { INITIAL_VISIBLE_LINES } from './model/logBuffer';
import { useLogStream } from './hooks/useLogStream';
import { copyToClipboard } from '@/utils/clipboard';
import { getErrorMessage } from '@/utils/helpers';
import { downloadBlob } from '@/utils/download';
import {
  createLogParserCache,
  searchLogEntries,
  filterLogEntries,
} from '@/features/logs/model/logSelectors';
import { Select } from '@/components/ui/Select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { formatDisplayTime, formatDisplayTimestamp } from '@/utils/dateFormat';
import { parseUnixTimestamp } from '@/utils/format';
import { MANAGEMENT_API_PREFIX } from '@/utils/constants';
import { HTTP_METHODS, STATUS_GROUPS, type LogState } from './model/logTypes';
import { createLogRequestGuard } from './model/logRequests';
import { errorLogViewerReducer } from './model/errorLogViewer';
import { shouldExitLogFullscreen } from './model/logFullscreen';
import { IconWrapText } from './components/IconWrapText';
import { useLogFilters } from './hooks/useLogFilters';
import { isNearBottom, useLogScroller } from './hooks/useLogScroller';
import {
  createLogDisplayCache,
  logIdentities,
  privacyLogFileName,
  privacyLogText,
} from './model/logPrivacy';
import styles from './LogsPage.module.scss';

const INITIAL_DISPLAY_LINES = INITIAL_VISIBLE_LINES;

type TabType = 'logs' | 'errors';

/** File modification time in the shared human format (`Nov 6, 2026, 23:02`). */
const formatModified = (value: unknown): string => {
  const date = parseUnixTimestamp(value);
  return date ? formatDisplayTimestamp(date) : '—';
};

export function LogsPage() {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const privacyEnabled = usePrivacyStore((state) => state.enabled);
  const [displayLogLine] = useState(createLogDisplayCache);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const config = useConfigStore((state) => state.config);
  const requestLogEnabled = config?.requestLog ?? false;

  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [hideManagementLogs, setHideManagementLogs] = useLocalStorage(
    'logsPage.hideManagementLogs',
    true
  );
  const [showRawLogs, setShowRawLogs] = useLocalStorage('logsPage.showRawLogs', false);
  // No saved choice yet: phones wrap so the endpoint and message are visible without
  // scrolling sideways; wide screens keep one line per entry.
  const [savedWrapLogs, setWrapLogs] = useLocalStorage<boolean | null>('logsPage.wrapLogs', null);
  const narrowViewport = useMediaQuery('(max-width: 900px)');
  const wrapLogs = savedWrapLogs ?? narrowViewport;
  const [structuredFiltersExpanded, setStructuredFiltersExpanded] = useState(false);
  const [errorLogs, setErrorLogs] = useState<ErrorLogFile[]>([]);
  const errorLogNames = useMemo(
    () =>
      new Map(errorLogs.map((item) => [item.name, privacyLogFileName(privacyEnabled, item.name)])),
    [errorLogs, privacyEnabled]
  );
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [errorLogsError, setErrorLogsError] = useState('');
  const [errorLogViewer, dispatchErrorLogViewer] = useReducer(errorLogViewerReducer, {
    status: 'closed',
  });
  const selectedErrorLog = errorLogViewer.status === 'closed' ? null : errorLogViewer.item;
  // The diagnosis usually sits at the end of one long response line: wrap by default.
  const [wrapErrorLog, setWrapErrorLog] = useState(true);
  const errorLogDisplay = useMemo(
    () => ({
      name: selectedErrorLog ? privacyLogFileName(privacyEnabled, selectedErrorLog.name) : '',
      content: privacyLogText(
        privacyEnabled,
        errorLogViewer.status === 'ready' ? errorLogViewer.text : ''
      ),
      error: privacyLogText(
        privacyEnabled,
        errorLogViewer.status === 'error' ? errorLogViewer.message : ''
      ),
    }),
    [errorLogViewer, selectedErrorLog, privacyEnabled]
  );
  const [viewerRequestId, setViewerRequestId] = useState<string | null>(null);
  const [requestLogDownloading, setRequestLogDownloading] = useState(false);
  const [fullscreenLogs, setFullscreenLogs] = useState(false);

  const [requests] = useState(() => ({
    session: createLogRequestGuard(),
    errors: createLogRequestGuard(),
    viewer: createLogRequestGuard(),
  }));

  const {
    logBuffer,
    visibleCount,
    setVisibleCount,
    lastUpdated,
    catchingUp,
    wasReset,
    loading,
    clearingLogs,
    error,
    autoRefresh,
    setAutoRefresh,
    cpaNeedsFileLogging,
    showFileLoggingRequired,
    loadLogs,
    clearLogs,
  } = useLogStream({
    active: activeTab === 'logs',
    isFollowing: () => isNearBottom(logViewerRef.current),
    onFollow: () => requestScrollToBottom(),
  });

  const disableControls = connectionStatus !== 'connected';
  const refreshDisabled = disableControls || loading || clearingLogs || cpaNeedsFileLogging;
  const autoRefreshDisabled = disableControls || showFileLoggingRequired;
  const clearDisabled = disableControls || clearingLogs || showFileLoggingRequired;

  const downloadLogs = () => {
    const text = logBuffer.buffer.join('\n');
    downloadBlob({ filename: 'logs.txt', blob: new Blob([text], { type: 'text/plain' }) });
    showNotification(t('logs.download_success'), 'success');
  };

  const loadErrorLogs = async () => {
    if (useAuthStore.getState().connectionStatus !== 'connected') {
      setLoadingErrors(false);
      return;
    }
    const request = requests.errors.invalidate();
    setLoadingErrors(true);
    setErrorLogsError('');
    try {
      const res = await logsApi.fetchErrorLogs();
      if (!requests.errors.isCurrent(request)) return;
      // API 返回 { files: [...] }
      setErrorLogs(Array.isArray(res.files) ? res.files : []);
    } catch (err: unknown) {
      if (!requests.errors.isCurrent(request)) return;
      console.error('Failed to load error logs:', err);
      setErrorLogs([]);
      const message = getErrorMessage(err);
      setErrorLogsError(
        message ? `${t('logs.error_logs_load_error')}: ${message}` : t('logs.error_logs_load_error')
      );
    } finally {
      if (requests.errors.isCurrent(request)) setLoadingErrors(false);
    }
  };

  useHeaderRefresh(() => (activeTab === 'errors' ? loadErrorLogs() : loadLogs(false)));

  const downloadErrorLog = async (name: string) => {
    const session = requests.session.capture();
    try {
      const response = await logsApi.downloadErrorLog(name);
      if (!requests.session.isCurrent(session)) return;
      downloadBlob({ filename: name, blob: new Blob([response.data], { type: 'text/plain' }) });
      showNotification(t('logs.error_log_download_success'), 'success');
    } catch (err: unknown) {
      if (!requests.session.isCurrent(session)) return;
      // Store the raw message plus log identities; the toast masks reactively at render time.
      const message = getErrorMessage(err);
      showNotification(
        `${t('notification.download_failed')}${message ? `: ${message}` : ''}`,
        'error',
        undefined,
        { identities: [...logIdentities(message), ...logIdentities(name)] }
      );
    }
  };

  const openErrorLog = async (item: ErrorLogFile, byRequestId?: string) => {
    setViewerRequestId(byRequestId ?? null);
    const requestId = requests.viewer.invalidate();
    dispatchErrorLogViewer({ type: 'open', item });

    try {
      if (item.size && item.size > 2 * 1024 * 1024) throw new Error(t('logs.preview_too_large'));
      const response = byRequestId
        ? await logsApi.downloadRequestLogById(byRequestId)
        : await logsApi.downloadErrorLog(item.name);
      if (response.data instanceof Blob && response.data.size > 2 * 1024 * 1024) {
        throw new Error(t('logs.preview_too_large'));
      }
      const text = await responseDataToText(response.data);
      if (!requests.viewer.isCurrent(requestId)) return;
      dispatchErrorLogViewer({ type: 'ready', text });
    } catch (err: unknown) {
      if (!requests.viewer.isCurrent(requestId)) return;
      const message =
        byRequestId &&
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        err.status === 404
          ? `${t('logs.request_log_missing')} ${getErrorMessage(err)}`
          : getErrorMessage(err);
      dispatchErrorLogViewer({
        type: 'error',
        message: message
          ? `${t('logs.error_log_open_failed')}: ${message}`
          : t('logs.error_log_open_failed'),
      });
    }
  };

  const closeErrorLogViewer = () => {
    requests.viewer.invalidate();
    dispatchErrorLogViewer({ type: 'close' });
  };

  const copySelectedErrorLog = async () => {
    if (errorLogViewer.status !== 'ready' || !errorLogViewer.text) return;
    const session = requests.session.capture();
    const ok = await copyToClipboard(errorLogViewer.text);
    if (!requests.session.isCurrent(session)) return;
    showNotification(
      ok
        ? t('logs.error_log_copy_success')
        : t('logs.copy_failed', { defaultValue: 'Copy failed' }),
      ok ? 'success' : 'error'
    );
  };

  useEffect(() => {
    const resetErrors = () => {
      requests.errors.invalidate();
      setErrorLogs([]);
      setLoadingErrors(false);
      setErrorLogsError('');
    };
    const invalidateSession = () => {
      requests.session.invalidate();
      requests.errors.invalidate();
      requests.viewer.invalidate();
    };

    // Store subscriptions invalidate synchronously, before a response can beat effect cleanup.
    const unsubscribeAuth = useAuthStore.subscribe((next, previous) => {
      if (
        next.apiBase === previous.apiBase &&
        next.managementKey === previous.managementKey &&
        next.connectionStatus === previous.connectionStatus &&
        next.isAuthenticated === previous.isAuthenticated
      )
        return;
      invalidateSession();
      resetErrors();
      dispatchErrorLogViewer({ type: 'close' });
      setViewerRequestId(null);
      setRequestLogDownloading(false);
    });
    const unsubscribeConfig = useConfigStore.subscribe((next, previous) => {
      if (next.config?.requestLog !== previous.config?.requestLog) resetErrors();
    });
    return () => {
      unsubscribeAuth();
      unsubscribeConfig();
      invalidateSession();
    };
  }, [requests]);

  useEffect(() => {
    if (activeTab !== 'errors') return;
    if (connectionStatus !== 'connected') return;
    void loadErrorLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, connectionStatus, apiBase, managementKey, requestLogEnabled]);

  const [parseEntries] = useState(createLogParserCache);
  const entries = useMemo(() => parseEntries(logBuffer), [logBuffer, parseEntries]);
  const [levelFilter, setLevelFilter] = useState('');
  const trimmedSearchQuery = deferredSearchQuery.trim();
  const isSearching = trimmedSearchQuery.length > 0;
  const parsedSearchLines = useMemo(
    () => searchLogEntries(entries, trimmedSearchQuery, hideManagementLogs),
    [entries, trimmedSearchQuery, hideManagementLogs]
  );

  const filters = useLogFilters({ parsedLines: parsedSearchLines });
  const structuredFiltersPanelId = 'logs-structured-filters';
  const structuredFilterCount =
    filters.methodFilters.length + filters.statusFilters.length + filters.pathFilters.length;

  const filteredParsedLines = useMemo(
    () =>
      filterLogEntries(parsedSearchLines, {
        methods: filters.methodFilterSet,
        statuses: filters.statusFilterSet,
        paths: filters.pathFilterSet,
        level: levelFilter,
      }),
    [
      parsedSearchLines,
      filters.methodFilterSet,
      filters.statusFilterSet,
      filters.pathFilterSet,
      levelFilter,
    ]
  );
  const removedCount = logBuffer.buffer.length - filteredParsedLines.length;
  const filteredLines = useMemo(
    () => filteredParsedLines.map((line) => line.raw),
    [filteredParsedLines]
  );
  const logState = useMemo<LogState>(
    () => ({
      buffer: filteredLines,
      visibleFrom: Math.max(0, filteredLines.length - visibleCount),
    }),
    [filteredLines, visibleCount]
  );
  const setLogState: Dispatch<SetStateAction<LogState>> = (update) => {
    const next = typeof update === 'function' ? update(logState) : update;
    setVisibleCount(next.buffer.length - next.visibleFrom);
  };
  useEffect(() => {
    setVisibleCount(INITIAL_DISPLAY_LINES);
  }, [
    setVisibleCount,
    trimmedSearchQuery,
    hideManagementLogs,
    levelFilter,
    filters.methodFilterSet,
    filters.statusFilterSet,
    filters.pathFilterSet,
  ]);
  const parsedVisibleLines = filteredParsedLines.slice(logState.visibleFrom);

  const {
    canLoadMore,
    handleLogScroll,
    logViewerRef,
    requestScrollToBottom,
    isFollowing,
    resumeFollowing,
    pendingLines,
    historyEvicted,
  } = useLogScroller({
    logState,
    setLogState,
    bufferStart: logBuffer.bufferStart,
    loading,
    isSearching,
    filteredLineCount: filteredLines.length,
    hasStructuredFilters: filters.hasStructuredFilters,
    showRawLogs,
    wrapLogs,
  });

  const copyLogLine = async (raw: string) => {
    const ok = await copyToClipboard(raw);
    if (ok) {
      showNotification(t('logs.copy_success', { defaultValue: 'Copied to clipboard' }), 'success');
    } else {
      showNotification(t('logs.copy_failed', { defaultValue: 'Copy failed' }), 'error');
    }
  };

  const downloadRequestLog = async (id: string) => {
    const session = requests.session.capture();
    setRequestLogDownloading(true);
    try {
      const response = await logsApi.downloadRequestLogById(id);
      if (!requests.session.isCurrent(session)) return;
      downloadBlob({
        filename: `request-${id}.log`,
        blob: new Blob([response.data], { type: 'text/plain' }),
      });
      showNotification(t('logs.request_log_download_success'), 'success');
    } catch (err: unknown) {
      if (!requests.session.isCurrent(session)) return;
      // Store the raw message plus log identities; the toast masks reactively at render time.
      const message = getErrorMessage(err);
      showNotification(
        `${t('notification.download_failed')}${message ? `: ${message}` : ''}`,
        'error',
        undefined,
        { identities: logIdentities(message) }
      );
    } finally {
      if (requests.session.isCurrent(session)) setRequestLogDownloading(false);
    }
  };

  useEffect(() => {
    if (!fullscreenLogs) return;

    document.body.classList.add('logs-fullscreen-active');
    lockScroll();

    const handleEscape = (event: KeyboardEvent) => {
      if (!shouldExitLogFullscreen(event, !!document.querySelector('.modal-overlay'))) return;
      setFullscreenLogs(false);
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.classList.remove('logs-fullscreen-active');
      unlockScroll();
    };
  }, [fullscreenLogs]);

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <div className={styles.heading}>
          <h1 className={styles.pageTitle}>{t('logs.title')}</h1>
        </div>
        <SegmentedControl<TabType>
          ariaLabel={t('logs.title')}
          value={activeTab}
          onChange={(tab) => {
            if (tab === 'errors') setFullscreenLogs(false);
            setActiveTab(tab);
          }}
          options={[
            { value: 'logs', label: t('logs.log_content') },
            { value: 'errors', label: t('logs.error_logs_modal_title') },
          ]}
        />
      </header>

      <div className={styles.content}>
        {activeTab === 'logs' && (
          <Card
            className={[styles.logCard, fullscreenLogs ? styles.logCardFullscreen : '']
              .filter(Boolean)
              .join(' ')}
          >
            {showFileLoggingRequired && (
              <div className="status-badge warning">
                {t(
                  cpaNeedsFileLogging
                    ? 'logs.cpa_file_logging_required'
                    : 'logs.file_logging_required'
                )}
              </div>
            )}
            {error && (
              <div className="error-box" role="alert">
                {privacyLogText(privacyEnabled, error)}
              </div>
            )}
            <div className={styles.filters}>
              <div className={styles.searchWrapper}>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('logs.search_placeholder')}
                  aria-label={t('logs.search_placeholder')}
                  className={styles.searchInput}
                  leftElement={<IconSearch size={16} className={styles.searchIcon} />}
                  rightElement={
                    searchQuery ? (
                      <button
                        type="button"
                        className={styles.searchClear}
                        onClick={() => setSearchQuery('')}
                        title={t('logs.clear_search')}
                        aria-label={t('logs.clear_search')}
                      >
                        <IconX size={16} />
                      </button>
                    ) : undefined
                  }
                />
              </div>

              <Select
                className={styles.levelSelect}
                fullWidth={false}
                value={levelFilter}
                onChange={setLevelFilter}
                size="sm"
                ariaLabel={t('logs.level_filter')}
                options={[
                  { value: '', label: t('logs.all_levels') },
                  ...['trace', 'debug', 'info', 'warn', 'error', 'fatal'].map((level) => ({
                    value: level,
                    label: level.toUpperCase(),
                  })),
                ]}
              />
              <div className={styles.filterPanelHeader}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.filterPanelToggle}
                  onClick={() => setStructuredFiltersExpanded((prev) => !prev)}
                  aria-haspopup="dialog"
                  aria-expanded={structuredFiltersExpanded}
                  aria-label={t('logs.filter_panel_title')}
                  title={t('logs.filter_panel_title')}
                >
                  <span className={styles.filterPanelButtonContent}>
                    <IconSlidersHorizontal size={16} />
                    <span className={styles.filterPanelLabel}>{t('logs.filter_panel_title')}</span>
                    {structuredFilterCount > 0 && (
                      <span className={styles.filterPanelCount}>
                        {t('logs.filter_panel_active_count', { count: structuredFilterCount })}
                      </span>
                    )}
                  </span>
                </Button>
              </div>

              <Modal
                open={structuredFiltersExpanded}
                onClose={() => setStructuredFiltersExpanded(false)}
                title={t('logs.filter_panel_title')}
                width={640}
                footer={
                  <Button variant="secondary" onClick={() => setStructuredFiltersExpanded(false)}>
                    {t('common.close')}
                  </Button>
                }
              >
                <div id={structuredFiltersPanelId} className={styles.structuredFilters}>
                  <div className={styles.filterChipGroup}>
                    <span className={styles.filterChipLabel}>{t('logs.filter_method')}</span>
                    <div className={styles.filterChipList}>
                      {HTTP_METHODS.map((method) => {
                        const active = filters.methodFilters.includes(method);
                        const count = filters.methodCounts[method] ?? 0;
                        return (
                          <button
                            key={method}
                            type="button"
                            className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                            onClick={() => filters.toggleMethodFilter(method)}
                            disabled={count === 0 && !active}
                            aria-pressed={active}
                          >
                            {method} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.filterChipGroup}>
                    <span className={styles.filterChipLabel}>{t('logs.filter_status')}</span>
                    <div className={styles.filterChipList}>
                      {STATUS_GROUPS.map((statusGroup) => {
                        const active = filters.statusFilters.includes(statusGroup);
                        const count = filters.statusCounts[statusGroup] ?? 0;
                        return (
                          <button
                            key={statusGroup}
                            type="button"
                            className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                            onClick={() => filters.toggleStatusFilter(statusGroup)}
                            disabled={count === 0 && !active}
                            aria-pressed={active}
                          >
                            {t(`logs.filter_status_${statusGroup}`)} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.filterChipGroup}>
                    <span className={styles.filterChipLabel}>{t('logs.filter_path')}</span>
                    <div className={styles.filterChipList}>
                      {filters.pathOptions.length === 0 ? (
                        <span className={styles.filterChipHint}>{t('logs.filter_path_empty')}</span>
                      ) : (
                        filters.pathOptions.map(({ path, count }) => {
                          const active = filters.pathFilters.includes(path);
                          return (
                            <button
                              key={path}
                              type="button"
                              className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                              onClick={() => filters.togglePathFilter(path)}
                              aria-pressed={active}
                              title={privacyLogText(privacyEnabled, path)}
                            >
                              {privacyLogText(privacyEnabled, path)} ({count})
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={filters.clearStructuredFilters}
                    disabled={!filters.hasStructuredFilters}
                  >
                    {t('logs.clear_filters')}
                  </Button>
                </div>

                <div className={styles.displayOptions}>
                  <ToggleSwitch
                    checked={wrapLogs}
                    onChange={setWrapLogs}
                    label={t('logs.wrap_lines')}
                  />
                  <ToggleSwitch
                    checked={hideManagementLogs}
                    onChange={setHideManagementLogs}
                    label={
                      <span className={styles.switchLabel}>
                        <IconEyeOff size={16} />
                        {t('logs.hide_management_logs', { prefix: MANAGEMENT_API_PREFIX })}
                      </span>
                    }
                  />

                  <ToggleSwitch
                    checked={showRawLogs}
                    onChange={setShowRawLogs}
                    label={
                      <span
                        className={styles.switchLabel}
                        title={t('logs.show_raw_logs_hint', {
                          defaultValue: 'Show original log text for easier multi-line copy',
                        })}
                      >
                        <IconCode size={16} />
                        {t('logs.show_raw_logs', { defaultValue: 'Show raw logs' })}
                      </span>
                    }
                  />
                </div>
              </Modal>

              <div className={styles.toolbar}>
                <Button
                  variant="secondary"
                  size="sm"
                  className={`${styles.actionButton} ${styles.liveToggle}`}
                  aria-pressed={autoRefresh}
                  title={t('logs.reading_enabled')}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  disabled={autoRefreshDisabled}
                >
                  <span className={styles.buttonContent}>
                    <IconTimer size={16} aria-hidden="true" />
                    <span className={styles.liveLabel}>{t('logs.live_toggle')}</span>
                  </span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => loadLogs(false)}
                  disabled={refreshDisabled}
                  className={styles.actionButton}
                  title={t('logs.refresh_button')}
                  aria-label={t('logs.refresh_button')}
                >
                  <IconRefreshCw size={16} />
                </Button>
                <span className={styles.toolbarDivider} aria-hidden="true" />
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.actionButton}
                  aria-pressed={wrapLogs}
                  aria-label={t('logs.wrap_lines')}
                  title={t('logs.wrap_lines')}
                  onClick={() => setWrapLogs(!wrapLogs)}
                >
                  <IconWrapText size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={downloadLogs}
                  disabled={logBuffer.buffer.length === 0}
                  className={styles.actionButton}
                  title={t('logs.download_cached')}
                  aria-label={t('logs.download_cached')}
                >
                  <IconDownload size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearLogs}
                  disabled={clearDisabled}
                  className={`${styles.actionButton} ${styles.clearButton}`}
                  title={t('logs.clear_button')}
                  aria-label={t('logs.clear_button')}
                >
                  <IconTrash2 size={16} />
                </Button>
                <span className={styles.toolbarDivider} aria-hidden="true" />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFullscreenLogs((prev) => !prev)}
                  className={styles.actionButton}
                  aria-pressed={fullscreenLogs}
                  aria-label={
                    fullscreenLogs ? t('logs.exit_fullscreen_button') : t('logs.fullscreen_button')
                  }
                  title={
                    fullscreenLogs ? t('logs.exit_fullscreen_button') : t('logs.fullscreen_button')
                  }
                >
                  <span className={styles.buttonContent}>
                    {fullscreenLogs ? <IconMinimize2 size={16} /> : <IconMaximize2 size={16} />}
                  </span>
                </Button>
              </div>
            </div>

            <div className={styles.viewerArea}>
              <div className={styles.notices}>
                {wasReset && (
                  <div className="hint" role="status">
                    {t('logs.cursor_reset_notice')}
                  </div>
                )}
                {historyEvicted && (
                  <div className="hint" role="status">
                    {t('logs.history_evicted')}
                  </div>
                )}
              </div>
              {!isFollowing && (
                <Button
                  className={styles.followButton}
                  variant="secondary"
                  size="sm"
                  onClick={resumeFollowing}
                >
                  {t('logs.resume_following', { count: pendingLines })}
                </Button>
              )}

              {loading && logBuffer.buffer.length === 0 ? (
                <div className="hint">{t('logs.loading')}</div>
              ) : logBuffer.buffer.length > 0 && filteredLines.length > 0 ? (
                <div
                  ref={logViewerRef}
                  className={[
                    styles.logPanel,
                    wrapLogs ? styles.wrapped : '',
                    fullscreenLogs ? styles.logPanelFullscreen : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onScroll={handleLogScroll}
                  tabIndex={0}
                  role="region"
                  aria-label={t('logs.log_content')}
                  aria-busy={loading}
                >
                  {canLoadMore && (
                    <div className={styles.loadMoreBanner}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setVisibleCount((count) => Math.min(filteredLines.length, count + 200))
                        }
                      >
                        {t('logs.filter_load_more')}
                      </Button>
                      <div className={styles.loadMoreStats}>
                        <span>{t('logs.loaded_lines', { count: parsedVisibleLines.length })}</span>
                        {removedCount > 0 && (
                          <span className={styles.loadMoreCount}>
                            {t('logs.filtered_lines', { count: removedCount })}
                          </span>
                        )}
                        <span className={styles.loadMoreCount}>
                          {t('logs.hidden_lines', { count: logState.visibleFrom })}
                        </span>
                      </div>
                    </div>
                  )}
                  {showRawLogs ? (
                    <pre className={styles.rawLog} spellCheck={false}>
                      {parsedVisibleLines.map((line) => (
                        <span key={line.id} data-log-id={line.id} style={{ display: 'block' }}>
                          {displayLogLine(line, privacyEnabled).raw || '\u00a0'}
                        </span>
                      ))}
                    </pre>
                  ) : (
                    <div className={styles.logList}>
                      {parsedVisibleLines.map((line) => {
                        const display = displayLogLine(line, privacyEnabled);
                        const rowClassNames = [styles.logRow];
                        if (line.level === 'warn') rowClassNames.push(styles.rowWarn);
                        if (line.level === 'error' || line.level === 'fatal')
                          rowClassNames.push(styles.rowError);
                        return (
                          <div
                            key={line.id}
                            data-log-id={line.id}
                            className={rowClassNames.join(' ')}
                            onDoubleClick={() => {
                              void copyLogLine(line.raw);
                            }}
                            title={t('logs.double_click_copy_hint', {
                              defaultValue: 'Double-click to copy',
                            })}
                          >
                            <div className={styles.timestamp}>{line.timestamp || ''}</div>
                            <div className={styles.level}>
                              {line.level && (
                                <span
                                  className={[
                                    styles.badge,
                                    line.level === 'info' ? styles.levelInfo : '',
                                    line.level === 'warn' ? styles.levelWarn : '',
                                    line.level === 'error' || line.level === 'fatal'
                                      ? styles.levelError
                                      : '',
                                    line.level === 'debug' ? styles.levelDebug : '',
                                    line.level === 'trace' ? styles.levelTrace : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  {line.level.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className={styles.rowMain}>
                              {typeof line.statusCode === 'number' && (
                                <span
                                  className={[
                                    styles.badge,
                                    styles.statusBadge,
                                    line.statusCode >= 200 && line.statusCode < 300
                                      ? styles.statusSuccess
                                      : line.statusCode >= 300 && line.statusCode < 400
                                        ? styles.statusInfo
                                        : line.statusCode >= 400 && line.statusCode < 500
                                          ? styles.statusWarn
                                          : styles.statusError,
                                  ].join(' ')}
                                >
                                  {line.statusCode}
                                </span>
                              )}

                              {line.latency && (
                                <span className={styles.latency}>{line.latency}</span>
                              )}

                              {line.method && (
                                <span className={[styles.badge, styles.methodBadge].join(' ')}>
                                  {line.method}
                                </span>
                              )}

                              {line.path && (
                                <span className={styles.path} title={display.path}>
                                  {display.path}
                                </span>
                              )}

                              {line.message && (
                                <span className={styles.message} title={display.message}>
                                  {display.message}
                                </span>
                              )}
                              {line.source && (
                                <span className={styles.source} title={display.source}>
                                  {display.source}
                                </span>
                              )}

                              {line.ip && (
                                <span className={styles.pill} title={display.ip}>
                                  {display.ip}
                                </span>
                              )}
                              {line.requestId && (
                                <button
                                  type="button"
                                  className={[styles.badge, styles.requestIdBadge].join(' ')}
                                  title={t('logs.view_request', { id: display.requestId })}
                                  aria-label={t('logs.view_request', { id: display.requestId })}
                                  onClick={() =>
                                    void openErrorLog(
                                      { name: `request-${line.requestId}.log` },
                                      line.requestId
                                    )
                                  }
                                >
                                  {display.requestId}
                                  <IconExternalLink size={12} />
                                </button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                className={styles.copyButton}
                                title={t('logs.copy_line')}
                                onClick={() => void copyLogLine(line.raw)}
                                aria-label={t('logs.copy_line')}
                              >
                                <IconCopy size={14} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : logBuffer.buffer.length > 0 ? (
                <EmptyState
                  title={t('logs.search_empty_title')}
                  description={t('logs.search_empty_desc')}
                />
              ) : showFileLoggingRequired ? (
                <EmptyState
                  title={t(
                    cpaNeedsFileLogging
                      ? 'logs.cpa_file_logging_required_title'
                      : 'logs.file_logging_required_title'
                  )}
                  description={t(
                    cpaNeedsFileLogging
                      ? 'logs.cpa_file_logging_required_desc'
                      : 'logs.file_logging_required_desc'
                  )}
                />
              ) : (
                <EmptyState title={t('logs.empty_title')} description={t('logs.empty_desc')} />
              )}
              <footer className={styles.statusBar}>
                <div
                  className={styles.readStatus}
                  role="status"
                  data-live={autoRefresh && !disableControls}
                >
                  {t(
                    catchingUp && autoRefresh
                      ? 'logs.read_status_catching_up'
                      : autoRefresh
                        ? 'logs.read_status_live'
                        : 'logs.read_status_paused'
                  )}
                  {lastUpdated && (
                    <> · {t('logs.last_updated', { time: formatDisplayTime(lastUpdated) })}</>
                  )}
                </div>
                <div className={styles.bufferStatus}>
                  {t('logs.buffer_scope', {
                    count: logBuffer.buffer.length,
                    matched: filteredLines.length,
                  })}
                </div>
              </footer>
            </div>
          </Card>
        )}

        {activeTab === 'errors' && (
          <section className={styles.errorCard} aria-label={t('logs.error_logs_modal_title')}>
            <div className={styles.errorToolbar}>
              <p className={styles.errorDescription}>{t('logs.error_logs_description')}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadErrorLogs}
                loading={loadingErrors}
                disabled={disableControls}
                className={styles.actionButton}
                title={t('common.refresh')}
                aria-label={t('common.refresh')}
              >
                <IconRefreshCw size={16} />
              </Button>
            </div>
            {requestLogEnabled && (
              <div className={styles.archiveNotice} role="status">
                <IconInfo size={16} aria-hidden="true" />
                <span>{t('logs.error_logs_request_log_enabled')}</span>
              </div>
            )}
            {errorLogsError && (
              <div className="error-box" role="alert">
                {privacyLogText(privacyEnabled, errorLogsError)}
              </div>
            )}
            <div className={styles.errorPanel} aria-busy={loadingErrors}>
              <div className={styles.errorTableSurface}>
                <table className={styles.errorTable}>
                  <thead>
                    <tr>
                      <th scope="col">{t('logs.error_logs_file')}</th>
                      <th scope="col" className={styles.fileSize}>
                        {t('logs.error_logs_size')}
                      </th>
                      <th scope="col">{t('logs.error_logs_modified')}</th>
                      <th scope="col">
                        <span className={styles.srOnly}>{t('logs.error_logs_actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingErrors ? (
                      <tr>
                        <td colSpan={4} className={styles.tableEmpty} role="status">
                          {t('common.loading')}
                        </td>
                      </tr>
                    ) : errorLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.tableEmpty}>
                          <EmptyState title={t('logs.error_logs_empty')} />
                        </td>
                      </tr>
                    ) : (
                      errorLogs.map((item) => (
                        <tr key={item.name}>
                          <td className={styles.fileName}>
                            <span className={styles.fileNameContent}>
                              <IconFileText size={16} aria-hidden="true" />
                              <span title={errorLogNames.get(item.name)}>
                                {errorLogNames.get(item.name)}
                              </span>
                            </span>
                          </td>
                          <td className={styles.fileSize}>
                            {typeof item.size === 'number'
                              ? `${(item.size / 1024).toFixed(1)} KB`
                              : '—'}
                          </td>
                          <td className={styles.fileModified}>
                            {item.modified ? formatModified(item.modified) : '—'}
                          </td>
                          <td>
                            <div className={styles.fileActions}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void openErrorLog(item)}
                                disabled={disableControls}
                              >
                                <IconEye size={16} />
                                {t('logs.error_logs_open')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadErrorLog(item.name)}
                                disabled={disableControls}
                              >
                                <IconDownload size={16} />
                                {t('logs.error_logs_download')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      <Modal
        open={errorLogViewer.status !== 'closed'}
        onClose={closeErrorLogViewer}
        title={errorLogDisplay.name || t('logs.error_log_view_title')}
        width={960}
        footer={
          <>
            <Button variant="secondary" onClick={closeErrorLogViewer}>
              {t('common.close')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void copySelectedErrorLog();
              }}
              disabled={errorLogViewer.status !== 'ready' || !errorLogViewer.text}
            >
              {t('common.copy')}
            </Button>
            <Button
              onClick={() => {
                if (viewerRequestId) void downloadRequestLog(viewerRequestId);
                else if (selectedErrorLog) void downloadErrorLog(selectedErrorLog.name);
              }}
              loading={requestLogDownloading}
              disabled={errorLogViewer.status === 'closed' || errorLogViewer.status === 'loading'}
            >
              {t('logs.error_logs_download')}
            </Button>
          </>
        }
      >
        <div className={styles.errorLogViewer}>
          {selectedErrorLog && (
            <div className={styles.errorLogViewerMeta}>
              <span>
                {t('logs.error_logs_size')}:{' '}
                {selectedErrorLog.size ? `${(selectedErrorLog.size / 1024).toFixed(1)} KB` : '-'}
              </span>
              <span>
                {t('logs.error_logs_modified')}:{' '}
                {selectedErrorLog.modified ? formatModified(selectedErrorLog.modified) : '-'}
              </span>
            </div>
          )}
          {errorLogViewer.status === 'ready' && errorLogViewer.text && (
            <div className={styles.errorLogViewerTools}>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={wrapErrorLog}
                onClick={() => setWrapErrorLog((value) => !value)}
              >
                <IconWrapText size={16} />
                {t('logs.wrap_lines')}
              </Button>
            </div>
          )}
          {errorLogViewer.status === 'error' && (
            <div className="error-box">{errorLogDisplay.error}</div>
          )}
          {errorLogViewer.status === 'loading' && <div className="hint">{t('common.loading')}</div>}
          {errorLogViewer.status === 'ready' &&
            (errorLogViewer.text ? (
              <pre
                className={`${styles.errorLogContent} ${wrapErrorLog ? styles.errorLogWrapped : ''}`}
                spellCheck={false}
              >
                {errorLogDisplay.content}
              </pre>
            ) : (
              <div className="hint">{t('logs.error_log_empty_content')}</div>
            ))}
        </div>
      </Modal>
    </div>
  );
}
