/**
 * Zod schemas for every entity, DTO, and wizard section.
 *
 * Per REBUILD_PLAN §17, every feature ships its Zod schema here
 * before the tRPC procedure or frontend form references it. The
 * frontend imports inferred types via the tRPC client; never
 * duplicate a shape.
 *
 * Current scope:
 *   - factFind/* — 12 Fact Find section schemas + server-side
 *     derivation helpers (WP-6.2)
 */
export * as factFind from './factFind/index.js';
export * from './factFind/index.js';
