/**
 * Backend strings keyed by enum, accessed via `strings(key, params)`. Locale
 * argument accepted but always returns en-AU at v1 (REBUILD_PLAN §19.18).
 *
 * Toast messages, audit-log lines, file-note auto templates (§19.11), and
 * email subjects all live here once the relevant work packages land.
 */
export type SupportedLocale = 'en-AU';

export function strings(key: string, _params?: Record<string, unknown>): string {
  // TODO(WP-3): replace with the real lookup once the registry is populated.
  return key;
}
