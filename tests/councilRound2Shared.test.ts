/**
 * Council round-2 regressions in the shared shell, primitives, Dashboard, Config and Logs.
 * There is no browser DOM harness: these pin the source contracts behind the fixes; the
 * matching computed layouts were verified in Chromium (menus inside the viewport at every
 * width and sidebar state, 40px segmented options, the 1280 KPI row).
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('shell utility menus', () => {
  const layout = read('src/styles/layout.scss');
  const shell = read('src/components/layout/MainLayout.tsx');

  test('expanded-desktop menus anchor to the docked footer, inside the viewport', () => {
    // The theme menu used to hang 36px off the left edge (right: 0 relative to its trigger).
    expect(layout).not.toMatch(/\.theme-menu-popover \{\s*left: auto;\s*right: 0;/);
    expect(layout).toMatch(
      /\.app-shell:not\(\.sidebar-is-collapsed\) \.header-actions \{[\s\S]*?position: static;/
    );
    expect(layout).toMatch(/right: 12px;\s*bottom: calc\(100% \+ 8px\);\s*left: 12px;/);
  });

  test('dismissal never pulls focus back from a control outside the menu', () => {
    expect(shell).toContain("addEventListener('focusout', handleFocusOut)");
    expect(shell).toContain("removeEventListener('focusout', handleFocusOut)");
    expect(shell).toMatch(/if \(focusInside && focusDropped\) getTrigger\(\)\?\.focus\(\);/);
  });

  test('plugin pages without a logo use a page glyph, not the plugin-management plug', () => {
    const icon = shell.match(/function PluginSidebarIcon[\s\S]*?\n}/)?.[0] ?? '';
    expect(icon).toContain('<IconSidebarPluginPage size={18} />');
    expect(icon).not.toContain('IconSidebarPlugins');
  });
});

describe('touch targets in shared primitives', () => {
  test('segmented options themselves are 40px on touch layouts', () => {
    const css = read('src/components/ui/SegmentedControl.module.scss');
    const mobile = css.slice(css.indexOf('@media (max-width: $breakpoint-mobile)'));
    expect(mobile).toMatch(/\.option \{\s*min-height: \$hit-target-touch;/);
  });

  test('sheet close grows at the shell mobile breakpoint, not only below 640px', () => {
    const css = read('src/components/ui/Sheet/Sheet.module.scss');
    expect(css).toMatch(
      /@media \(max-width: \$breakpoint-mobile\) \{\s*\.closeBtn \{\s*width: \$hit-target-touch;/
    );
  });

  test('Pure White control boundaries clear 3:1 on panels', () => {
    expect(read('src/styles/themes.scss')).toContain('--border-control: #8b8b8b;');
  });
});

describe('dashboard KPI row', () => {
  const css = read('src/features/dashboard/dashboard.module.scss');

  test('desktop widths keep one row of five instead of a full-width first tile', () => {
    expect(css).toMatch(
      /@container \(min-width: 880px\) \{\s*\.statsRow \{\s*grid-template-columns: minmax\(0, 1\.3fr\) repeat\(4, minmax\(0, 1fr\)\);/
    );
    expect(css).not.toContain('@container (min-width: 960px)');
  });

  test('translated status phrases wrap inside narrow tiles', () => {
    const phrase = css.match(/\.hintStatus,\s*\.hintPhrase \{[^}]*\}/)?.[0] ?? '';
    expect(phrase).not.toContain('nowrap');
  });

  test('no stale class lookups remain', () => {
    expect(read('src/features/dashboard/DashboardPage.tsx')).not.toContain('styles.toggleOn');
    expect(read('src/features/logs/LogsPage.tsx')).not.toContain('styles.tabBar');
  });
});

describe('config settings rows', () => {
  test('labels and controls share one bounded grid', () => {
    const css = read('src/features/config/components/fields/Field.module.scss');
    expect(css).toMatch(/grid-template-columns: minmax\(200px, 300px\) minmax\(0, 320px\);/);
    expect(css).not.toContain('--setting-control');
    expect(css).not.toMatch(/\.rowToggle \.rowControl \{\s*justify-content: flex-end;/);
  });
});

describe('logs', () => {
  test('the error-file viewer wraps long lines by default and offers a toggle', () => {
    const page = read('src/features/logs/LogsPage.tsx');
    expect(page).toContain('useState(true)');
    expect(page).toContain('aria-pressed={wrapErrorLog}');
    expect(read('src/features/logs/LogsPage.module.scss')).toMatch(
      /\.errorLogContent\.errorLogWrapped \{\s*white-space: pre-wrap;/
    );
  });
});
