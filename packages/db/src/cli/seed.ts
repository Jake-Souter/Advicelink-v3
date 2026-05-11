import { eq, sql as drSql } from 'drizzle-orm';

import { readyAdviceBrandBundle } from '@advicelink/branding';

import { env } from '../config/env.js';
import {
  createDbClient,
  withPlatformAdmin,
  type Db,
  type DbClient,
} from '../client.js';
import {
  teamMemberships,
  teams,
  tenants,
  users,
  type NewTeam,
  type NewTeamMembership,
  type NewTenant,
  type NewUser,
} from '../schema/index.js';

/**
 * Idempotent dev seed. Re-running yields the same DB state — useful when
 * a fresh Railway environment is wiped and re-provisioned.
 *
 * Seeds:
 *   - The "Ready Advice" tenant (slug: ready-advice) carrying its brand bundle.
 *   - One platform_super_admin user (your Firebase UID — set FIREBASE_BOOT_*
 *     env vars before running, otherwise a documented placeholder is inserted).
 *   - One Marketing team and one Advice team.
 *   - Membership rows wiring the super-admin into the Advice team as
 *     `management` (lets WP-3 tests assert non-trivial allow-lists).
 *
 * Run via:  pnpm --filter @advicelink/db db:seed
 *           (wrapped in `doppler run` for DATABASE_URL)
 *
 * The "real" platform admin should rotate the seeded user once they
 * complete a real Firebase login; the seed only exists to give WP-3 a
 * known-good row to authenticate against in dev.
 */

const READY_ADVICE_SLUG = 'ready-advice';

const BOOT_ADMIN_FIREBASE_UID =
  env.FIREBASE_BOOT_ADMIN_UID ?? 'firebase-uid-placeholder-rotate-me';
const BOOT_ADMIN_EMAIL = env.FIREBASE_BOOT_ADMIN_EMAIL ?? 'platform-admin@readyadvice.local';
const BOOT_ADMIN_DISPLAY_NAME = env.FIREBASE_BOOT_ADMIN_DISPLAY_NAME ?? 'Platform Super Admin';

async function upsertTenant(tx: Db): Promise<string> {
  const [existing] = await tx
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, READY_ADVICE_SLUG));
  if (existing) {
    console.log(`tenants    ✓ ${READY_ADVICE_SLUG} (already present, id=${existing.id})`);
    return existing.id;
  }

  const insert: NewTenant = {
    slug: READY_ADVICE_SLUG,
    displayName: 'Ready Advice',
    primaryDomain: 'readyadvice.com.au',
    status: 'active',
    brandBundle: readyAdviceBrandBundle as unknown as Record<string, unknown>,
    featureFlags: {},
  };
  const [row] = await tx.insert(tenants).values(insert).returning({ id: tenants.id });
  if (!row) throw new Error('Failed to insert ready-advice tenant');
  console.log(`tenants    + ${READY_ADVICE_SLUG} (id=${row.id})`);
  return row.id;
}

async function upsertSuperAdmin(tx: Db, tenantId: string): Promise<string> {
  const [existing] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, BOOT_ADMIN_FIREBASE_UID));
  if (existing) {
    console.log(`users      ✓ ${BOOT_ADMIN_EMAIL} (id=${existing.id})`);
    return existing.id;
  }

  const insert: NewUser = {
    tenantId,
    firebaseUid: BOOT_ADMIN_FIREBASE_UID,
    email: BOOT_ADMIN_EMAIL,
    displayName: BOOT_ADMIN_DISPLAY_NAME,
    role: 'platform_super_admin',
  };
  const [row] = await tx.insert(users).values(insert).returning({ id: users.id });
  if (!row) throw new Error('Failed to insert boot super-admin user');
  console.log(`users      + ${BOOT_ADMIN_EMAIL} (id=${row.id})`);
  return row.id;
}

async function upsertTeam(
  tx: Db,
  tenantId: string,
  payload: { name: string; type: NewTeam['type'] },
  createdBy: string,
): Promise<string> {
  const [existing] = await tx
    .select({ id: teams.id })
    .from(teams)
    .where(drSql`${teams.tenantId} = ${tenantId} AND ${teams.name} = ${payload.name}`);
  if (existing) {
    console.log(`teams      ✓ ${payload.name} (${payload.type}, id=${existing.id})`);
    return existing.id;
  }

  const insert: NewTeam = {
    tenantId,
    name: payload.name,
    type: payload.type,
    config: {},
    licensee: {},
    createdBy,
  };
  const [row] = await tx.insert(teams).values(insert).returning({ id: teams.id });
  if (!row) throw new Error(`Failed to insert team ${payload.name}`);
  console.log(`teams      + ${payload.name} (${payload.type}, id=${row.id})`);
  return row.id;
}

async function upsertMembership(tx: Db, payload: NewTeamMembership): Promise<void> {
  const [existing] = await tx
    .select({ teamId: teamMemberships.teamId })
    .from(teamMemberships)
    .where(
      drSql`${teamMemberships.teamId} = ${payload.teamId}
            AND ${teamMemberships.userId} = ${payload.userId}
            AND ${teamMemberships.seat} = ${payload.seat}`,
    );
  const userTag = payload.userId.slice(0, 8);
  const teamTag = payload.teamId.slice(0, 8);
  if (existing) {
    console.log(`memberships ✓ user=${userTag}… on team=${teamTag}… as ${payload.seat}`);
    return;
  }
  await tx.insert(teamMemberships).values(payload);
  console.log(`memberships + user=${userTag}… on team=${teamTag}… as ${payload.seat}`);
}

async function seed(client: DbClient): Promise<void> {
  await withPlatformAdmin(client, async (tx) => {
    const tenantId = await upsertTenant(tx);
    const adminId = await upsertSuperAdmin(tx, tenantId);
    const marketingTeamId = await upsertTeam(
      tx,
      tenantId,
      { name: 'Marketing — Lead Gen', type: 'marketing' },
      adminId,
    );
    const advisoryTeamId = await upsertTeam(
      tx,
      tenantId,
      { name: 'Advice — Core', type: 'advisory' },
      adminId,
    );
    await upsertMembership(tx, {
      teamId: advisoryTeamId,
      userId: adminId,
      seat: 'management',
      isPrimary: true,
      tenantId,
      createdBy: adminId,
    });

    void marketingTeamId; // referenced for completeness; WP-3 will wire users to it
  });
}

async function main(): Promise<void> {
  const client = createDbClient(env.DATABASE_URL, {
    max: 1,
    ssl: env.DATABASE_SSL === 'false' ? false : env.DATABASE_SSL,
    applicationName: 'advicelink-seed',
  });
  try {
    await seed(client);
    console.log('Seed complete.');
  } finally {
    await client.sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
