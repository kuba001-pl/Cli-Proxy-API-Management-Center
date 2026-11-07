import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const readSource = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = readSource('src/features/logs/LogsPage.tsx');
const styles = readSource('src/features/logs/LogsPage.module.scss');
const layout = readSource('src/styles/layout.scss');

// Structural guards complement the browser viewport/interaction checks. They do not
// assert browser layout: the important contract is a single flexible scrolling viewer.
describe('log workspace layout contract', () => {
  test('viewer uses remaining space instead of resolution-specific height budgets', () => {
    const panel = styles.match(/\.logPanel \{([^}]+)\}/)?.[1] ?? '';
    expect(panel).toContain('flex: 1');
    expect(panel).toContain('min-height: 0');
    expect(panel).toContain('overflow: auto');
    expect(panel).not.toMatch(/(?:max-height|height):\s*(?:calc|\d+px)/);
    expect(styles).not.toContain('resize: vertical');
    expect(styles).not.toMatch(/calc\(100vh\s*-/);
    expect(styles).not.toMatch(/\n\s*(?:height|min-height|max-height):\s*(?:360|420|480)px/);
    expect(layout).toMatch(
      /&\.content-logs,?\s*(?:&\.content-plugin-resource\s*)?\{\s*height: 100dvh;\s*min-height: 0;\s*overflow: hidden;/
    );
  });

  test('error archive and fullscreen share the flexible viewport contract', () => {
    const archive = styles.match(/\.errorPanel \{([^}]+)\}/)?.[1] ?? '';
    const fullscreen = styles.match(/\.logCardFullscreen:global\(\.card\) \{([^}]+)\}/)?.[1] ?? '';
    expect(archive).toContain('flex: 1');
    expect(archive).toContain('min-height: 0');
    expect(archive).not.toMatch(/\bheight:\s*\d+px/);
    expect(fullscreen).toContain('height: 100dvh');
    expect(styles).not.toMatch(/\.pageHeader\s*\{\s*display: none/);
    expect(page).toContain('className={styles.errorCard}');
  });

  test('advanced controls are closed initially and opened in a focus-managed modal', () => {
    expect(page).toContain(
      '[structuredFiltersExpanded, setStructuredFiltersExpanded] = useState(false)'
    );
    expect(page).not.toContain('logsPage.structuredFiltersExpanded');
    expect(page).toContain('aria-haspopup="dialog"');
    expect(page).toMatch(/<Modal\s+open=\{structuredFiltersExpanded\}/);
    expect(page).toContain("'logsPage.showRawLogs'");
    expect(page).toContain("'logsPage.hideManagementLogs'");
    expect(page).not.toContain('!fullscreenLogs &&');
  });

  test('row actions do not wrap into an empty line or remove keyboard access', () => {
    const copy = styles.match(/^\.copyButton:global\(\.btn\) \{([^}]+)\}/m)?.[1] ?? '';
    expect(copy).toContain('position: sticky');
    // A saved wrap choice wins; without one, phones wrap so the endpoint stays visible.
    expect(page).toContain("useLocalStorage<boolean | null>('logsPage.wrapLogs', null)");
    expect(page).toContain('const wrapLogs = savedWrapLogs ?? narrowViewport;');
    expect(page).toContain('aria-pressed={wrapLogs}');
    // Rows fit the viewer instead of growing to max-content, so the request ID never clips.
    expect(styles).not.toContain('width: max-content');
    const list = styles.match(/^\.logList \{([^}]+)\}/m)?.[1] ?? '';
    expect(list).toContain('width: 100%');
    const shrinkable = styles.match(/^\.source,\n\.pill \{([^}]+)\}/m)?.[1] ?? '';
    expect(shrinkable).toContain('min-width: 0');
    expect(page).toContain('title={display.source}');
    expect(page).toContain('title={display.ip}');
    expect(styles).toContain('flex-wrap: nowrap');
    expect(styles).toContain('.logRow:focus-within .copyButton');
    expect(page).toContain("aria-label={t('logs.copy_line')}");
    expect(page).toContain('tabIndex={0}');
    expect(page).toContain("aria-label={t('logs.log_content')}");
    expect(page).toContain('aria-pressed={autoRefresh}');
  });

  test('background refresh retains loaded content and compact status stays outside viewer', () => {
    expect(page).toContain('loading && logBuffer.buffer.length === 0');
    expect(page).toContain('<footer className={styles.statusBar}>');
    expect(page).toContain('<div className={styles.viewerArea}>');
    expect(page).toContain('onScroll={handleLogScroll}');
    expect(page).toContain('onClick={resumeFollowing}');
    expect(page).toContain('data-log-id={line.id}');
  });

  test('routine buffer eviction does not add a persistent warning banner', () => {
    expect(page).not.toContain("t('logs.buffer_evicted')");
    expect(page).not.toContain('logBuffer.evicted > 0');
    // A lost reading position and a backend cursor reset remain actionable notices.
    expect(page).toContain("t('logs.history_evicted')");
    expect(page).toContain("t('logs.cursor_reset_notice')");
  });

  test('toolbar controls share one sizing rule rather than mixing small variants', () => {
    expect(page).toContain('className={styles.levelSelect}');
    expect(styles).toMatch(
      /\.searchInput:global\(\.input\),\s*\.levelSelect > button,\s*\.filterPanelToggle:global\(\.btn\),\s*\.actionButton:global\(\.btn\) \{[^}]*height: var\(--log-control-height\)/
    );
    expect(styles).toContain('--log-control-height: 32px');
    expect(styles).toContain('width: var(--log-control-height)');
    // Touch layouts grow the shared height to the 40px hit target rather than mixing sizes.
    expect(styles).toContain('--log-control-height: #{$hit-target-touch};');
  });

  test('all supported locales describe both filtering and display settings', () => {
    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr']) {
      const messages = JSON.parse(readSource(`src/i18n/locales/${locale}.json`));
      expect(messages.logs.filter_panel_title).toBeTruthy();
      expect(messages.logs.show_raw_logs).toBeTruthy();
      expect(messages.logs.wrap_lines).toBeTruthy();
      expect(messages.logs.hide_management_logs).toBeTruthy();
      // The page header carries no template caption (de-slop rule 3).
      expect(messages.logs.caption).toBeUndefined();
      expect(messages.logs.error_logs_file).toBeTruthy();
      expect(messages.logs.error_logs_actions).toBeTruthy();
    }
  });
});
