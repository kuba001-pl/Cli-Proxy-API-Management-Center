import { Suspense, lazy, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconChevronDown, IconChevronUp, IconSearch } from '@/components/ui/icons';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import type { UseSourceSearchResult } from '../hooks/useSourceSearch';
import { resolveSourcePreview } from '../privacy';
import styles from './SourcePanel.module.scss';

const LazyConfigSourceEditor = lazy(() => import('./ConfigSourceEditor'));

export type SourceSearchBarProps = {
  search: UseSourceSearchResult;
  disabled: boolean;
};

/** 源码模式的紧凑搜索条：放在页头操作区，编辑器紧贴页头（对应 config-source.png）。 */
export function SourceSearchBar({ search, disabled }: SourceSearchBarProps) {
  const { t } = useTranslation();
  const {
    searchQuery,
    searchResults,
    lastSearchedQuery,
    handleSearchChange,
    executeSearch,
    handleSearchKeyDown,
    handlePrevMatch,
    handleNextMatch,
  } = search;

  const isCurrentQuery = Boolean(searchQuery) && lastSearchedQuery === searchQuery;
  // Prev/next run a fresh search when the query changed since the last run, so the bar
  // needs no separate trailing search button (Enter / Shift+Enter still work too).
  const navDisabled = disabled || !searchQuery || (isCurrentQuery && searchResults.total === 0);
  const handlePrev = () => (isCurrentQuery ? handlePrevMatch() : executeSearch('prev'));
  const handleNext = () => (isCurrentQuery ? handleNextMatch() : executeSearch('next'));

  return (
    <div className={styles.searchBar}>
      <div className={styles.searchInputWrapper}>
        <Input
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={t('config_management.search_placeholder')}
          aria-label={t('config_management.search_placeholder')}
          disabled={disabled}
          className={styles.searchInput}
          leftElement={<IconSearch size={14} className={styles.searchIcon} />}
          rightElement={
            isCurrentQuery ? (
              <span className={styles.searchCount} role="status">
                {searchResults.total > 0
                  ? `${searchResults.current} / ${searchResults.total}`
                  : t('config_management.search_no_results')}
              </span>
            ) : undefined
          }
        />
      </div>

      <div className={styles.searchActions}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrev}
          disabled={navDisabled}
          title={t('config_management.search_prev')}
          aria-label={t('config_management.search_prev')}
        >
          <IconChevronUp size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNext}
          disabled={navDisabled}
          title={t('config_management.search_next')}
          aria-label={t('config_management.search_next')}
        >
          <IconChevronDown size={16} />
        </Button>
      </div>
    </div>
  );
}

export type SourcePanelProps = {
  search: UseSourceSearchResult;
  value: string;
  onChange: (value: string) => void;
  theme: 'light' | 'dark';
  editable: boolean;
};

/**
 * YAML 源码编辑面板：lazy CodeMirror（含语法高亮/折叠/内置搜索快捷键）。
 * Privacy mode swaps the editor for a separate, hard read-only preview of the masked text;
 * the editable instance and its onChange are unmounted, so masks can never reach the real
 * document, and the pending draft (held by the page) is shown again when privacy turns off.
 */
export function SourcePanel({ search, value, onChange, theme, editable }: SourcePanelProps) {
  const { t } = useTranslation();
  const privacyEnabled = usePrivacyStore((state) => state.enabled);
  const preview = useMemo(
    () => resolveSourcePreview(value, privacyEnabled),
    [value, privacyEnabled]
  );
  const noticeId = useId();

  return (
    <div className={styles.sourceRegion}>
      {preview.masked ? (
        <p id={noticeId} className={styles.privacyNotice} role="status">
          {t('config_management.privacy_source_paused')}
        </p>
      ) : null}
      <div className={styles.editorWrapper}>
        <Suspense fallback={null}>
          {preview.masked ? (
            <LazyConfigSourceEditor
              key="masked-preview"
              // Search/navigation only moves the selection over what is on screen.
              editorRef={search.editorRef}
              value={preview.previewText}
              theme={theme}
              editable={false}
              readOnly
              ariaDescribedBy={noticeId}
              placeholder={t('config_management.editor_placeholder')}
            />
          ) : (
            <LazyConfigSourceEditor
              key="source"
              editorRef={search.editorRef}
              value={value}
              onChange={onChange}
              theme={theme}
              editable={editable}
              placeholder={t('config_management.editor_placeholder')}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
