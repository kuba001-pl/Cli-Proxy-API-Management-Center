import { Suspense, lazy, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconChevronDown, IconChevronUp, IconSearch } from '@/components/ui/icons';
import { usePrivacyStore } from '@/stores/usePrivacyStore';
import type { UseSourceSearchResult } from '../hooks/useSourceSearch';
import { resolveSourceEditorView } from '../privacy';
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

/** YAML 源码编辑面板：lazy CodeMirror（含语法高亮/折叠/内置搜索快捷键）。 */
export function SourcePanel({ search, value, onChange, theme, editable }: SourcePanelProps) {
  const { t } = useTranslation();
  const privacyEnabled = usePrivacyStore((state) => state.enabled);
  const view = useMemo(
    () => resolveSourceEditorView({ value, onChange, editable, privacyEnabled }),
    [value, onChange, editable, privacyEnabled]
  );

  return (
    <>
      {view.masked ? (
        <p className={styles.privacyNotice} role="status">
          {t('config_management.privacy_source_paused')}
        </p>
      ) : null}
      <div className={styles.editorWrapper}>
        <Suspense fallback={null}>
          <LazyConfigSourceEditor
            // Remount when switching modes so a masked preview never shares undo history
            // with the real document.
            key={view.masked ? 'masked' : 'source'}
            editorRef={search.editorRef}
            value={view.value}
            onChange={view.onChange}
            theme={theme}
            editable={view.editable}
            placeholder={t('config_management.editor_placeholder')}
          />
        </Suspense>
      </div>
    </>
  );
}
