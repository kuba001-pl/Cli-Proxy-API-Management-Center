/** Alternate route paths that render the same page as a primary sidebar entry. */
const NAV_ALIASES: Record<string, readonly string[]> = {
  '/': ['/dashboard'],
};

/**
 * Link target for a sidebar entry. While an alias of the entry is the current route, the
 * link points at that alias so NavLink marks it active (class and aria-current) as it does
 * on the canonical path.
 */
export function resolveNavTarget(path: string, pathname: string): string {
  const current = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return NAV_ALIASES[path]?.includes(current) ? current : path;
}
