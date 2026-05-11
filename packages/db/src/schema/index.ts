/**
 * The whole Drizzle schema as a single object — pass this to
 * `drizzle({ ... }, { schema })` so `db.query.<table>` is typed end-to-end.
 *
 * Order matters for drizzle-kit introspection (FKs reference earlier
 * exports), so we re-export tenants → users → teams → join tables → audit.
 */
export * from './enums.js';
export * from './tenants.js';
export * from './users.js';
export * from './teams.js';
export * from './teamMemberships.js';
export * from './auditLog.js';
export * from './adminAuditLog.js';
