/**
 * Manifest schemas + template authoring tooling. Templates live in S3 at
 * `tenants/{tenant_id}/templates/{type}/{version}.docx` with a sibling
 * `manifest.json` declaring every placeholder + source path + required flag.
 *
 * The Document Maps admin (REBUILD_PLAN §6.25) consumes these manifests so
 * paraplanners can see exactly which Fact Find / SOA Wizard fields back each
 * placeholder. See REBUILD_PLAN §8.3 + §19.4 for the placeholder source
 * notation (`client.*`, `tenant.*`, `computed:*`, `chart:*`, `image:*`).
 *
 * Authoring guide: `AUTHORING.md` (added in Work Package 9).
 */
export {};
