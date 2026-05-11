/**
 * Year-by-year projection engine + sandboxed expression evaluator.
 *
 * Populated by Work Package 13. The same engine code path drives the
 * Projections page, the SOA Wizard's projections section, the ROA / EO
 * Wizard's updatedProjections section, the AR Wizard snapshots, AND the
 * DOCX `projection-report` and SOA/ROA/AR projection placeholders. There
 * is no second implementation. See REBUILD_PLAN.md §19.5 + §19.5.7.
 *
 * Legislated rates per FY live in `src/legislatedRates/<fy>.ts` (start with
 * `2025-26.ts` per §19.5.3); old runs remain reproducible via versioned
 * pointers on `projection_runs` rows.
 */
export {};
