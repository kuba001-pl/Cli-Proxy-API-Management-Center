import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Every `styles.foo` read from a component must have a `.foo` selector in its module
// (element-qualified selectors such as `button.foo` count). Dynamic lookups are ignored.
const ROOTS = [
  'src/features/authFiles',
  'src/features/providers',
  'src/features/oauth',
  'src/components/providers',
  'src/components/ui',
  'src/pages/login',
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.tsx') ? [path] : [];
  });

const root = resolve(import.meta.dir, '..');
const files = [
  ...ROOTS.flatMap((dir) => walk(join(root, dir))),
  join(root, 'src/pages/LoginPage.tsx'),
];

describe('CSS module class references', () => {
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/import (\w+) from '([^']+\.module\.scss)';/g)];
    if (imports.length === 0) continue;
    test(file.slice(root.length + 1), () => {
      const missing: string[] = [];
      for (const [, name, spec] of imports) {
        const path = spec.startsWith('@/')
          ? join(root, 'src', spec.slice(2))
          : resolve(dirname(file), spec);
        if (!existsSync(path)) continue;
        const scss = readFileSync(path, 'utf8');
        const used = new Set(
          [...source.matchAll(new RegExp(`\\b${name}\\.([A-Za-z_][\\w]*)`, 'g'))].map((m) => m[1])
        );
        for (const cls of used) {
          if (!new RegExp(`\\.${cls}(?![\\w-])`).test(scss)) missing.push(`${name}.${cls}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }
});
