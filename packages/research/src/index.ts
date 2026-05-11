/**
 * Research adapter (Lonsec — Phase B post-launch).
 *
 * NOT integrated at v1 launch — Recommended Portfolios admin (REBUILD_PLAN
 * §10.6) is populated by hand. When Lonsec goes live the pattern is
 * "nightly batch + local cache" (`lonsec_portfolios` mirror table); end users
 * never call Lonsec endpoints directly. See REBUILD_PLAN §19.12.7 and
 * `docs/Lonsec-API-Integration.md`.
 */
export {};
