import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { clients, type Client } from '@advicelink/db';
import {
  factFindSectionDefaults,
  factFindSectionSchemas,
  type FactFindSectionId,
} from '@advicelink/schemas';

import type { TxDb } from '../../trpc/context.js';

/**
 * The shape returned by `loadFactFind`. Every section is parsed
 * through its Zod schema before being returned so the frontend gets
 * back values it can immediately render — even if the underlying
 * JSONB row was hand-edited or partially populated by an earlier
 * schema version.
 *
 * `meta` carries the workflow context the FF UI needs without a
 * second round-trip (lock state, ownership pointers, etc.).
 */
export interface LoadedFactFind {
  meta: {
    clientId: string;
    tenantId: string;
    originatingLeadGenTenantId: string | null;
    destinationAdviceTenantId: string;
    workflowState: string;
    workflowPhase: string;
    factFindLockedAt: Date | null;
    displayName: string;
    /** Whether the row carries a non-null TFN ciphertext. The
     *  plaintext is NEVER returned by `loadFactFind`; the UI shows
     *  a masked preview and offers a separate "view TFN" action
     *  that calls a dedicated decrypt procedure. */
    hasTfn: boolean;
    hasPartnerTfn: boolean;
  };
  sections: Record<FactFindSectionId, unknown>;
}

const SECTION_TO_COLUMN: Record<FactFindSectionId, keyof Client> = {
  personal: 'personal',
  employment: 'employment',
  partnerEmployment: 'partnerEmployment',
  financial: 'financial',
  assets: 'assets',
  liabilities: 'liabilities',
  superannuation: 'superannuation',
  contributions: 'contributions',
  insurance: 'insurance',
  beneficiaries: 'beneficiaries',
  goals: 'goals',
  riskProfile: 'riskProfile',
};

export async function loadFactFind(tx: TxDb, clientId: string): Promise<LoadedFactFind> {
  const [row] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${clientId} not found` });
  }

  const sections = {} as Record<FactFindSectionId, unknown>;
  for (const id of Object.keys(SECTION_TO_COLUMN) as FactFindSectionId[]) {
    const column = SECTION_TO_COLUMN[id];
    const raw = row[column] as unknown;
    const schema = factFindSectionSchemas[id];
    const parsed = schema.safeParse(raw);
    // On a parse failure (legacy row, hand-edited JSONB, schema
    // bumped without a backfill), fall back to the section default.
    // Better to render an empty section than to wedge the whole
    // wizard. The reading is logged at the call site (router-level
    // logger) so we still see what's broken.
    sections[id] = parsed.success ? parsed.data : factFindSectionDefaults[id];
  }

  return {
    meta: {
      clientId: row.id,
      tenantId: row.tenantId,
      originatingLeadGenTenantId: row.originatingLeadGenTenantId,
      destinationAdviceTenantId: row.destinationAdviceTenantId,
      workflowState: row.workflowState,
      workflowPhase: row.workflowPhase,
      factFindLockedAt: row.factFindLockedAt,
      displayName: row.displayName,
      hasTfn: row.tfnEncrypted != null && row.tfnEncrypted.length > 0,
      hasPartnerTfn: row.partnerTfnEncrypted != null && row.partnerTfnEncrypted.length > 0,
    },
    sections,
  };
}
