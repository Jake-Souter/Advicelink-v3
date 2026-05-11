import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql as drSql } from 'drizzle-orm';

import {
  aiInvocations,
  clients,
  createDbClient,
  leadGenGrants,
  tenants,
  users,
  withPlatformAdmin,
  withTenantContext,
  workflowEvents,
  type DbClient,
  type NewTenant,
  type NewUser,
} from '@advicelink/db';

import { createClient } from '../src/services/clients/create.js';
import { lockFactFind } from '../src/services/clients/lockFactFind.js';
import { executeTransition } from '../src/services/workflow/transition.js';
import { upsertSection } from '../src/services/factFind/upsertSection.js';
import { loadFactFind } from '../src/services/factFind/load.js';
import { setTfn, readTfnPlaintext } from '../src/services/factFind/tfn.js';
import { runAssist } from '../src/services/ai/runAssist.js';

/**
 * Service-layer integration tests.
 *
 * The Fact Find service surface is exercised end-to-end against a
 * real Postgres (the only honest way to verify RLS, the workflow
 * trigger chain, and the per-tenant TFN encryption helpers).
 *
 * We bypass the tRPC adapter and call the services directly inside
 * `withTenantContext` — same path the API takes after the auth
 * middleware resolves a token. Auth-layer tests live in their own
 * file; this file is about the contracts the routers wrap.
 *
 * Scenarios:
 *   1. Lead-gen creates a client → row appears, owner = lead-gen
 *   2. Lead-gen without a grant is rejected
 *   3. Advice firm self-sources a client (originating = NULL)
 *   4. upsertSection persists derivations into JSONB (financial →
 *      contributions.totalSgAnnual mirror)
 *   5. lockFactFind rejects when required personal fields are missing
 *   6. lockFactFind happy path fires the workflow transition + writes
 *      a workflow_events row + stamps fact_find_locked_at
 *   7. setTfn → readTfnPlaintext round-trips through pgcrypto
 *   8. runAssist (stub mode) writes a redacted ai_invocations row
 */

const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const skip = !databaseUrl;

describe.skipIf(skip)('Fact Find services', () => {
  let client: DbClient;
  const runSlug = `ff-svc-${process.pid}-${Date.now()}`;
  let leadGenTenantId = '';
  let adviceTenantId = '';
  let unrelatedAdviceTenantId = '';
  let leadGenUserId = '';
  let leadGenParaplannerId = '';
  let adviceUserId = '';

  beforeAll(async () => {
    client = createDbClient(databaseUrl!, {
      max: 1,
      applicationName: 'advicelink-ff-svc-test',
      tfnMasterKey: 'test-master-key-do-not-use-in-prod',
    });

    await withPlatformAdmin(client, async (tx) => {
      const seeded = await tx
        .insert(tenants)
        .values([
          {
            slug: `${runSlug}-leadgen`,
            displayName: 'Lead Gen',
            kind: 'lead_gen',
          } satisfies NewTenant,
          {
            slug: `${runSlug}-advice`,
            displayName: 'Destination Advice',
            kind: 'advice',
          } satisfies NewTenant,
          {
            slug: `${runSlug}-other`,
            displayName: 'Unrelated Advice',
            kind: 'advice',
          } satisfies NewTenant,
        ])
        .returning({ id: tenants.id, slug: tenants.slug });
      leadGenTenantId = seeded.find((t) => t.slug === `${runSlug}-leadgen`)!.id;
      adviceTenantId = seeded.find((t) => t.slug === `${runSlug}-advice`)!.id;
      unrelatedAdviceTenantId = seeded.find((t) => t.slug === `${runSlug}-other`)!.id;

      const seededUsers = await tx
        .insert(users)
        .values([
          {
            tenantId: leadGenTenantId,
            firebaseUid: `${runSlug}-leadgen-fbuid`,
            email: 'leadgen@example.test',
            displayName: 'LG User',
            role: 'lead_gen',
          } satisfies NewUser,
          {
            tenantId: leadGenTenantId,
            firebaseUid: `${runSlug}-leadgen-pp-fbuid`,
            email: 'leadgen-pp@example.test',
            displayName: 'LG Paraplanner',
            role: 'paraplanner',
          } satisfies NewUser,
          {
            tenantId: adviceTenantId,
            firebaseUid: `${runSlug}-advice-fbuid`,
            email: 'advice@example.test',
            displayName: 'Adv User',
            role: 'adviser',
          } satisfies NewUser,
        ])
        .returning({ id: users.id, tenantId: users.tenantId, role: users.role });
      leadGenUserId = seededUsers.find(
        (u) => u.tenantId === leadGenTenantId && u.role === 'lead_gen',
      )!.id;
      leadGenParaplannerId = seededUsers.find(
        (u) => u.tenantId === leadGenTenantId && u.role === 'paraplanner',
      )!.id;
      adviceUserId = seededUsers.find((u) => u.tenantId === adviceTenantId)!.id;

      // Active grant lead-gen → destination advice
      await tx.insert(leadGenGrants).values({
        leadGenTenantId,
        adviceTenantId,
        grantedByUserId: adviceUserId,
      });
    });
  });

  afterAll(async () => {
    if (!client) return;
    await client.sql.begin(async (tx) => {
      await tx.unsafe(`ALTER TABLE workflow_events DISABLE TRIGGER workflow_events_no_delete`);
      await tx.unsafe(`ALTER TABLE ai_invocations DISABLE TRIGGER ai_invocations_no_delete`);
      try {
        // ai_invocations FK on tenants is RESTRICT so it has to be
        // wiped first; the trigger is already disabled above.
        await tx.unsafe(`DELETE FROM ai_invocations WHERE tenant_id IN ($1, $2, $3)`, [
          leadGenTenantId,
          adviceTenantId,
          unrelatedAdviceTenantId,
        ]);
        await tx.unsafe(`DELETE FROM clients WHERE tenant_id IN ($1, $2, $3)`, [
          leadGenTenantId,
          adviceTenantId,
          unrelatedAdviceTenantId,
        ]);
        await tx.unsafe(
          `DELETE FROM lead_gen_grants WHERE lead_gen_tenant_id = $1 AND advice_tenant_id = $2`,
          [leadGenTenantId, adviceTenantId],
        );
        await tx.unsafe(`DELETE FROM users WHERE tenant_id IN ($1, $2, $3)`, [
          leadGenTenantId,
          adviceTenantId,
          unrelatedAdviceTenantId,
        ]);
        await tx.unsafe(`DELETE FROM tenants WHERE id IN ($1, $2, $3)`, [
          leadGenTenantId,
          adviceTenantId,
          unrelatedAdviceTenantId,
        ]);
      } finally {
        await tx.unsafe(`ALTER TABLE workflow_events ENABLE TRIGGER workflow_events_no_delete`);
        await tx.unsafe(`ALTER TABLE ai_invocations ENABLE TRIGGER ai_invocations_no_delete`);
      }
    });
    await client.sql.end({ timeout: 5 });
  });

  /** Convenience: spin up a fresh lead-gen-owned client. */
  async function makeLeadGenClient(firstName: string, surname: string): Promise<string> {
    return withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      async (tx) => {
        const created = await createClient(tx, {
          personal: { firstName, surname },
          destinationAdviceTenantId: adviceTenantId,
          actor: { id: leadGenUserId, role: 'lead_gen', tenantId: leadGenTenantId },
        });
        return created.id;
      },
    );
  }

  it('lead-gen createClient sets all three tenant pointers correctly', async () => {
    const id = await makeLeadGenClient('Aria', 'CreateOne');
    await withPlatformAdmin(client, async (tx) => {
      const [row] = await tx.select().from(clients).where(eq(clients.id, id));
      expect(row!.tenantId).toBe(leadGenTenantId);
      expect(row!.originatingLeadGenTenantId).toBe(leadGenTenantId);
      expect(row!.destinationAdviceTenantId).toBe(adviceTenantId);
      expect(row!.workflowState).toBe('factFinding');
      expect(row!.workflowPhase).toBe('factFind');
    });
  });

  it('lead-gen createClient rejects when no active grant links to the destination', async () => {
    await expect(
      withTenantContext(
        client,
        { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
        (tx) =>
          createClient(tx, {
            personal: { firstName: 'NoGrant', surname: 'Stranger' },
            destinationAdviceTenantId: unrelatedAdviceTenantId,
            actor: { id: leadGenUserId, role: 'lead_gen', tenantId: leadGenTenantId },
          }),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('advice firm self-source flow: originating = NULL, destination = self', async () => {
    const created = await withTenantContext(
      client,
      { tenantId: adviceTenantId, userId: adviceUserId, userRole: 'adviser' },
      (tx) =>
        createClient(tx, {
          personal: { firstName: 'Selfie', surname: 'Source' },
          actor: { id: adviceUserId, role: 'adviser', tenantId: adviceTenantId },
        }),
    );
    expect(created.tenantId).toBe(adviceTenantId);
    expect(created.originatingLeadGenTenantId).toBeNull();
    expect(created.destinationAdviceTenantId).toBe(adviceTenantId);
  });

  it('upsertSection runs deriveAll and persists cross-section derivations', async () => {
    const id = await makeLeadGenClient('Derive', 'Test');
    await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      async (tx) => {
        await upsertSection(tx, {
          clientId: id,
          sectionId: 'financial',
          payload: {
            incomes: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                incomeType: 'Salary',
                grossAnnual: 100000,
                sgEligible: true,
                superGuaranteePercent: 12,
              },
            ],
          },
          actor: { id: leadGenUserId, role: 'lead_gen' },
        });
        const loaded = await loadFactFind(tx, id);
        const financial = loaded.sections.financial as { totalSgAnnual?: number };
        const contributions = loaded.sections.contributions as { totalSgAnnual?: number };
        expect(financial.totalSgAnnual).toBe(12000);
        expect(contributions.totalSgAnnual).toBe(12000);
      },
    );
  });

  it('lockFactFind rejects when required personal fields are missing', async () => {
    const id = await makeLeadGenClient('Half', 'Filled');
    await expect(
      withTenantContext(
        client,
        { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
        (tx) =>
          lockFactFind(tx, {
            clientId: id,
            actor: { id: leadGenUserId, role: 'lead_gen', tenantId: leadGenTenantId },
            rowTenantId: leadGenTenantId,
          }),
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('lockFactFind happy path advances workflow and writes a workflow_events row', async () => {
    const id = await makeLeadGenClient('Ready', 'ToLock');

    // Fill the rest of the required personal fields.
    await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) =>
        upsertSection(tx, {
          clientId: id,
          sectionId: 'personal',
          payload: {
            firstName: 'Ready',
            surname: 'ToLock',
            dateOfBirth: '1990-05-01',
            email: 'ready@example.test',
            mobile: '0412 999 999',
          },
          actor: { id: leadGenUserId, role: 'lead_gen' },
        }),
    );

    // Per the canonical workflow, `lockFactFind` is paraplanner-only.
    // The lead-gen agency runs its own paraplanners; ownership of the
    // row stays with the lead-gen tenant pre-handoff.
    const result = await withTenantContext(
      client,
      {
        tenantId: leadGenTenantId,
        userId: leadGenParaplannerId,
        userRole: 'paraplanner',
      },
      (tx) =>
        lockFactFind(tx, {
          clientId: id,
          actor: {
            id: leadGenParaplannerId,
            role: 'paraplanner',
            tenantId: leadGenTenantId,
          },
          rowTenantId: leadGenTenantId,
        }),
    );
    expect(result.fromState).toBe('factFinding');
    expect(result.toState).toBe('draftingSOA');

    await withPlatformAdmin(client, async (tx) => {
      const [row] = await tx.select().from(clients).where(eq(clients.id, id));
      expect(row!.workflowState).toBe('draftingSOA');
      expect(row!.workflowPhase).toBe('soaProduction');
      expect(row!.factFindLockedAt).not.toBeNull();

      const events = await tx.select().from(workflowEvents).where(eq(workflowEvents.clientId, id));
      expect(events).toHaveLength(1);
      expect(events[0]!.transitionName).toBe('lockFactFind');
      expect(events[0]!.fromState).toBe('factFinding');
      expect(events[0]!.toState).toBe('draftingSOA');
      expect(events[0]!.actorId).toBe(leadGenParaplannerId);
    });
  });

  it('executeTransition with the wrong role is rejected at the canTransition gate', async () => {
    const id = await makeLeadGenClient('Wrong', 'Role');
    await expect(
      withTenantContext(
        client,
        { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
        (tx) =>
          executeTransition(tx, {
            clientId: id,
            // sendSOAForReview belongs to the paraplanner; lead-gen
            // shouldn't be able to fire it from any state.
            transitionName: 'sendSOAForReview',
            actor: { id: leadGenUserId, role: 'lead_gen', tenantId: leadGenTenantId },
            rowTenantId: leadGenTenantId,
          }),
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('TFN setTfn → readTfnPlaintext round-trips through pgcrypto', async () => {
    const id = await makeLeadGenClient('Tfn', 'Round');
    const plain = '987654321';

    await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      async (tx) => {
        await setTfn(tx, {
          clientId: id,
          slot: 'self',
          plaintext: plain,
          actorId: leadGenUserId,
        });
        const recovered = await readTfnPlaintext(tx, { clientId: id, slot: 'self' });
        expect(recovered).toBe(plain);
      },
    );

    // Verify ciphertext is armored and DOES NOT contain the plaintext digits.
    await withPlatformAdmin(client, async (tx) => {
      const [row] = await tx
        .select({ tfn: clients.tfnEncrypted })
        .from(clients)
        .where(eq(clients.id, id));
      expect(row!.tfn).toMatch(/^-----BEGIN PGP MESSAGE-----/);
      expect(row!.tfn).not.toContain(plain);
    });
  });

  it('runAssist (stub mode) writes an ai_invocations row with redacted I/O', async () => {
    const id = await makeLeadGenClient('AI', 'Assist');
    const before = await withPlatformAdmin(client, (tx) =>
      tx.select({ count: drSql<number>`count(*)::int` }).from(aiInvocations),
    );
    const baseline = before[0]!.count;

    const result = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) =>
        runAssist(tx, {
          promptKey: 'factFindGoalsNext12Months',
          input: {
            displayName: 'AI Assist',
            // Bullet contains an email + a phone — verify they are
            // redacted before persistence.
            factsBullets: ['Contact alice@example.com phone 0412 345 678 ASAP'],
          },
          tenantId: leadGenTenantId,
          userId: leadGenUserId,
          clientId: id,
        }),
    );
    expect(result.output.suggestion).toContain('AI Assist');

    await withPlatformAdmin(client, async (tx) => {
      const after = await tx.select({ count: drSql<number>`count(*)::int` }).from(aiInvocations);
      expect(after[0]!.count).toBe(baseline + 1);

      const [row] = await tx
        .select()
        .from(aiInvocations)
        .where(eq(aiInvocations.id, result.invocationId));
      expect(row!.tenantId).toBe(leadGenTenantId);
      expect(row!.clientId).toBe(id);
      expect(row!.promptKey).toBe('factFindGoalsNext12Months');
      expect(row!.model).toMatch(/\+stub$/);
      const redactedInput = row!.redactedInput as { factsBullets: string[] };
      expect(redactedInput.factsBullets[0]).toContain('[EMAIL]');
      expect(redactedInput.factsBullets[0]).toContain('[PHONE]');
      expect(redactedInput.factsBullets[0]).not.toContain('alice@example.com');
    });
  });
});
