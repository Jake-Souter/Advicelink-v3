import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDbClient,
  leadGenGrants,
  tenants,
  users,
  withPlatformAdmin,
  withTenantContext,
  type DbClient,
  type NewTenant,
  type NewUser,
} from '@advicelink/db';
import type { soaWizard } from '@advicelink/schemas';

import { createClient } from '../src/services/clients/create.js';
import { lockFactFind } from '../src/services/clients/lockFactFind.js';
import { upsertSection } from '../src/services/factFind/upsertSection.js';
import { loadSoaWizard } from '../src/services/soaWizard/load.js';
import { upsertSoaWizardSection } from '../src/services/soaWizard/upsertSection.js';
import { refreshFromFactFind } from '../src/services/soaWizard/refreshFromFactFind.js';

/**
 * SOA Wizard service-layer tests.
 *
 * Exercises the WP-8 storage path end-to-end against a real Postgres
 * (so the workflow gate, RLS, and the JSONB merge story are all
 * verified together). Mirrors `factFindServices.test.ts` for shape
 * and tear-down.
 *
 * Scenarios:
 *   1. upsertSoaWizardSection refuses pre-lock (FF not yet locked)
 *   2. upsertSoaWizardSection happy path round-trips a `cover` payload
 *   3. refreshFromFactFind populates `position` from FF aggregates and
 *      preserves adviser-supplied `observations` across re-pull
 *   4. upsertSoaWizardSection preserves OTHER sections on a single-section save
 */

const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const skip = !databaseUrl;

describe.skipIf(skip)('SOA Wizard services', () => {
  let client: DbClient;
  const runSlug = `soa-svc-${process.pid}-${Date.now()}`;
  let leadGenTenantId = '';
  let adviceTenantId = '';
  let leadGenUserId = '';
  let leadGenParaplannerId = '';
  let adviceUserId = '';

  beforeAll(async () => {
    client = createDbClient(databaseUrl!, {
      max: 1,
      applicationName: 'advicelink-soa-svc-test',
      tfnMasterKey: 'test-master-key-do-not-use-in-prod',
    });

    await withPlatformAdmin(client, async (tx) => {
      const seeded = await tx
        .insert(tenants)
        .values([
          { slug: `${runSlug}-leadgen`, displayName: 'Lead Gen', kind: 'lead_gen' } satisfies NewTenant,
          { slug: `${runSlug}-advice`, displayName: 'Advice', kind: 'advice' } satisfies NewTenant,
        ])
        .returning({ id: tenants.id, slug: tenants.slug });
      leadGenTenantId = seeded.find((t) => t.slug === `${runSlug}-leadgen`)!.id;
      adviceTenantId = seeded.find((t) => t.slug === `${runSlug}-advice`)!.id;

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
        await tx.unsafe(`DELETE FROM ai_invocations WHERE tenant_id IN ($1, $2)`, [
          leadGenTenantId,
          adviceTenantId,
        ]);
        await tx.unsafe(`DELETE FROM clients WHERE tenant_id IN ($1, $2)`, [
          leadGenTenantId,
          adviceTenantId,
        ]);
        await tx.unsafe(
          `DELETE FROM lead_gen_grants WHERE lead_gen_tenant_id = $1 AND advice_tenant_id = $2`,
          [leadGenTenantId, adviceTenantId],
        );
        await tx.unsafe(`DELETE FROM users WHERE tenant_id IN ($1, $2)`, [
          leadGenTenantId,
          adviceTenantId,
        ]);
        await tx.unsafe(`DELETE FROM tenants WHERE id IN ($1, $2)`, [
          leadGenTenantId,
          adviceTenantId,
        ]);
      } finally {
        await tx.unsafe(`ALTER TABLE workflow_events ENABLE TRIGGER workflow_events_no_delete`);
        await tx.unsafe(`ALTER TABLE ai_invocations ENABLE TRIGGER ai_invocations_no_delete`);
      }
    });
    await client.sql.end({ timeout: 5 });
  });

  /**
   * Convenience: create a lead-gen client, fully fill the personal
   * section, lock the Fact Find (advancing to draftingSOA), and
   * return the client id.
   */
  async function makeClientReadyForSoa(firstName: string, surname: string): Promise<string> {
    const id = await withTenantContext(
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
    await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) =>
        upsertSection(tx, {
          clientId: id,
          sectionId: 'personal',
          payload: {
            firstName,
            surname,
            dateOfBirth: '1985-04-12',
            email: `${firstName.toLowerCase()}@example.test`,
            mobile: '0412 345 678',
          },
          actor: { id: leadGenUserId, role: 'lead_gen' },
        }),
    );
    await withTenantContext(
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
    return id;
  }

  it('upsertSoaWizardSection refuses to write before the Fact Find is locked', async () => {
    // A fresh lead-gen client — FF is NOT yet locked.
    const id = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      async (tx) => {
        const created = await createClient(tx, {
          personal: { firstName: 'Pre', surname: 'Lock' },
          destinationAdviceTenantId: adviceTenantId,
          actor: { id: leadGenUserId, role: 'lead_gen', tenantId: leadGenTenantId },
        });
        return created.id;
      },
    );

    await expect(
      withTenantContext(
        client,
        {
          tenantId: leadGenTenantId,
          userId: leadGenParaplannerId,
          userRole: 'paraplanner',
        },
        (tx) =>
          upsertSoaWizardSection(tx, {
            clientId: id,
            sectionId: 'cover',
            payload: { documentTitle: 'Statement of Advice' },
            actor: { id: leadGenParaplannerId, role: 'paraplanner' },
          }),
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('upsertSoaWizardSection round-trips a cover payload after FF is locked', async () => {
    const id = await makeClientReadyForSoa('Cov', 'Round');
    const payload: soaWizard.Cover = {
      documentTitle: 'Statement of Advice',
      preparedFor: 'Cov Round',
      preparedBy: 'Adv User',
      authorisedRepresentativeNumber: '12345',
      preparationDate: '2026-01-05',
      validUntilDate: '2026-02-04',
      preparedForPartner: false,
    };

    const loaded = await withTenantContext(
      client,
      {
        tenantId: leadGenTenantId,
        userId: leadGenParaplannerId,
        userRole: 'paraplanner',
      },
      (tx) =>
        upsertSoaWizardSection(tx, {
          clientId: id,
          sectionId: 'cover',
          payload,
          actor: { id: leadGenParaplannerId, role: 'paraplanner' },
        }),
    );

    expect(loaded.sections.cover).toMatchObject({
      documentTitle: 'Statement of Advice',
      preparedFor: 'Cov Round',
      preparationDate: '2026-01-05',
      validUntilDate: '2026-02-04',
    });
  });

  it('refreshFromFactFind populates position and preserves adviser observations across re-pull', async () => {
    const id = await makeClientReadyForSoa('Ref', 'Resh');

    // 1) Initial refresh — adviser hasn't typed anything yet.
    const first = await withTenantContext(
      client,
      {
        tenantId: leadGenTenantId,
        userId: leadGenParaplannerId,
        userRole: 'paraplanner',
      },
      (tx) =>
        refreshFromFactFind(tx, {
          clientId: id,
          actor: { id: leadGenParaplannerId, role: 'paraplanner' },
        }),
    );
    const initialPosition = first.sections.position as {
      observations?: string;
      household?: { netWealth?: number };
    };
    // No assets in this client yet, so netWealth = 0.
    expect(initialPosition.household?.netWealth ?? 0).toBe(0);
    expect(initialPosition.observations).toBeUndefined();

    // 2) Adviser types observations + saves.
    await withTenantContext(
      client,
      {
        tenantId: leadGenTenantId,
        userId: leadGenParaplannerId,
        userRole: 'paraplanner',
      },
      (tx) =>
        upsertSoaWizardSection(tx, {
          clientId: id,
          sectionId: 'position',
          payload: {
            ...initialPosition,
            observations: 'Healthy income but light on emergency cash buffer.',
          },
          actor: { id: leadGenParaplannerId, role: 'paraplanner' },
        }),
    );

    // 3) Re-refresh — observations should survive.
    const second = await withTenantContext(
      client,
      {
        tenantId: leadGenTenantId,
        userId: leadGenParaplannerId,
        userRole: 'paraplanner',
      },
      (tx) =>
        refreshFromFactFind(tx, {
          clientId: id,
          actor: { id: leadGenParaplannerId, role: 'paraplanner' },
        }),
    );
    const refreshedPosition = second.sections.position as { observations?: string };
    expect(refreshedPosition.observations).toBe(
      'Healthy income but light on emergency cash buffer.',
    );
  });

  it('upsertSoaWizardSection writing one section preserves the other 14', async () => {
    const id = await makeClientReadyForSoa('Pre', 'Serve');

    // First save: cover
    await withTenantContext(
      client,
      {
        tenantId: leadGenTenantId,
        userId: leadGenParaplannerId,
        userRole: 'paraplanner',
      },
      (tx) =>
        upsertSoaWizardSection(tx, {
          clientId: id,
          sectionId: 'cover',
          payload: { documentTitle: 'SOA Draft' },
          actor: { id: leadGenParaplannerId, role: 'paraplanner' },
        }),
    );

    // Second save: aboutAuthority
    const after = await withTenantContext(
      client,
      {
        tenantId: leadGenTenantId,
        userId: leadGenParaplannerId,
        userRole: 'paraplanner',
      },
      (tx) =>
        upsertSoaWizardSection(tx, {
          clientId: id,
          sectionId: 'aboutAuthority',
          payload: { scopeOfAdvice: 'Comprehensive personal advice.' },
          actor: { id: leadGenParaplannerId, role: 'paraplanner' },
        }),
    );

    expect((after.sections.cover as { documentTitle?: string }).documentTitle).toBe('SOA Draft');
    expect(
      (after.sections.aboutAuthority as { scopeOfAdvice?: string }).scopeOfAdvice,
    ).toBe('Comprehensive personal advice.');
  });

  it('loadSoaWizard returns defaults for every section on a fresh row', async () => {
    const id = await makeClientReadyForSoa('Fresh', 'Load');
    const loaded = await withTenantContext(
      client,
      {
        tenantId: leadGenTenantId,
        userId: leadGenParaplannerId,
        userRole: 'paraplanner',
      },
      (tx) => loadSoaWizard(tx, id),
    );
    // Every section should be present with the default shape.
    for (const sectionId of [
      'cover',
      'aboutAuthority',
      'goals',
      'position',
      'riskProfile',
      'strategyRecommendations',
      'insuranceRecommendations',
      'superRecommendations',
      'investmentRecommendations',
      'cashflowModelling',
      'projections',
      'feesCosts',
      'implementationPlan',
      'authorityToProceed',
      'appendices',
    ] as const) {
      expect(loaded.sections[sectionId]).toBeDefined();
    }
    expect(loaded.meta.factFindLockedAt).not.toBeNull();
    expect(loaded.meta.workflowState).toBe('draftingSOA');
  });
});
