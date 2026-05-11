import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { clients } from '@advicelink/db';
import {
  SOA_WIZARD_SECTION_IDS,
  soaWizardSectionDefaults,
  soaWizardSectionSchemas,
  type SoaWizardSectionId,
} from '@advicelink/schemas';

import type { TxDb } from '../../trpc/context.js';

/**
 * Shape returned by `loadSoaWizard`.
 *
 * Mirror of `LoadedFactFind` for consistency:
 *  - `meta` carries the workflow context the wizard UI needs without
 *    a second round-trip (lock + phase + display-name).
 *  - `sections` is the per-section payload, each parsed through its
 *    own Zod schema so the UI gets back values it can immediately
 *    render even if the underlying JSONB row was hand-edited or
 *    written by an earlier schema version.
 *
 * Unlike the Fact Find load, every section is sourced from the SAME
 * column (`clients.soa_wizard_data`) keyed by section id; the column
 * is JSONB so this is a single round-trip read.
 */
export interface LoadedSoaWizard {
  meta: {
    clientId: string;
    tenantId: string;
    originatingLeadGenTenantId: string | null;
    destinationAdviceTenantId: string;
    workflowState: string;
    workflowPhase: string;
    /** Required: the SOA Wizard is gated on the FF being locked. */
    factFindLockedAt: Date | null;
    soaPresentedAt: Date | null;
    soaAcceptedAt: Date | null;
    displayName: string;
  };
  sections: Record<SoaWizardSectionId, unknown>;
}

export async function loadSoaWizard(tx: TxDb, clientId: string): Promise<LoadedSoaWizard> {
  const [row] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${clientId} not found` });
  }

  // Every section's data lives keyed by its id under `soa_wizard_data`.
  // We coerce the raw JSONB to a record for typed lookup and fall
  // back to `{}` when the row was just created (every fresh client).
  const raw = (row.soaWizardData ?? {}) as Record<string, unknown>;

  const sections = {} as Record<SoaWizardSectionId, unknown>;
  for (const id of SOA_WIZARD_SECTION_IDS) {
    const schema = soaWizardSectionSchemas[id];
    const slot = raw[id];
    // Empty / missing slot → use the section default. Otherwise parse
    // through the section's Zod schema. On parse failure (legacy row,
    // schema bumped without a backfill) we fall back to the default
    // so the wizard renders an empty section rather than wedging the
    // whole page; the parse error is logged at the router layer.
    if (slot == null) {
      sections[id] = soaWizardSectionDefaults[id];
      continue;
    }
    const parsed = schema.safeParse(slot);
    sections[id] = parsed.success ? parsed.data : soaWizardSectionDefaults[id];
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
      soaPresentedAt: row.soaPresentedAt,
      soaAcceptedAt: row.soaAcceptedAt,
      displayName: row.displayName,
    },
    sections,
  };
}
