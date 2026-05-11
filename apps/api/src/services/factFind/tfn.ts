import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import { clients } from '@advicelink/db';
import { tfnPlaintextSchema } from '@advicelink/schemas';

import type { TxDb } from '../../trpc/context.js';

/**
 * TFN read/write helpers.
 *
 * Encrypt + decrypt happen entirely in Postgres via the
 * `app_encrypt_tfn` / `app_decrypt_tfn` SQL functions defined in
 * `migrations/0006_clients.sql`. The functions read the per-tenant
 * key from the `app.tfn_master_key` GUC, which is set on every
 * `withTenantContext` transaction by the wrapper in
 * `packages/db/src/client.ts`.
 *
 * The plaintext only ever lives:
 *   - in the inbound HTTP request body
 *   - in the `WITH plaintext AS (...)` CTE inside this transaction
 *   - on the wire back to the caller (decrypt path only)
 *
 * It is NEVER persisted to disk in the clear; the `pgp_sym_encrypt`
 * call happens before the row hits the WAL.
 */

export type TfnSlot = 'self' | 'partner';

const SLOT_TO_COLUMN: Record<TfnSlot, 'tfn_encrypted' | 'partner_tfn_encrypted'> = {
  self: 'tfn_encrypted',
  partner: 'partner_tfn_encrypted',
};

export async function setTfn(
  tx: TxDb,
  args: { clientId: string; slot: TfnSlot; plaintext: string; actorId: string },
): Promise<void> {
  const validated = tfnPlaintextSchema.safeParse(args.plaintext);
  if (!validated.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'TFN must be 8 or 9 digits with no spaces',
      cause: validated.error,
    });
  }
  const column = SLOT_TO_COLUMN[args.slot];
  const result = await tx.execute(
    sql`UPDATE clients
           SET ${sql.identifier(column)} = app_encrypt_tfn(tenant_id, ${validated.data}),
               updated_at = now(),
               updated_by = ${args.actorId}::uuid
         WHERE id = ${args.clientId}::uuid
         RETURNING id`,
  );
  if ((result as unknown as Array<unknown>).length === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${args.clientId} not found` });
  }
}

export async function clearTfn(
  tx: TxDb,
  args: { clientId: string; slot: TfnSlot; actorId: string },
): Promise<void> {
  const column = SLOT_TO_COLUMN[args.slot];
  await tx
    .update(clients)
    .set({
      [column === 'tfn_encrypted' ? 'tfnEncrypted' : 'partnerTfnEncrypted']: null,
      updatedBy: args.actorId,
      updatedAt: sql`now()`,
    })
    .where(eq(clients.id, args.clientId));
}

/**
 * Decrypt and return the plaintext for the given slot. Returns
 * `null` when no ciphertext is stored. Callers MUST surface this
 * via a dedicated audit-trailed UI action — a Fact Find load does
 * NOT include the plaintext.
 */
export async function readTfnPlaintext(
  tx: TxDb,
  args: { clientId: string; slot: TfnSlot },
): Promise<string | null> {
  const column = SLOT_TO_COLUMN[args.slot];
  const rows = (await tx.execute(
    sql`SELECT app_decrypt_tfn(tenant_id, ${sql.identifier(column)}) AS plaintext
          FROM clients
         WHERE id = ${args.clientId}::uuid`,
  )) as unknown as Array<{ plaintext: string | null }>;
  if (rows.length === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${args.clientId} not found` });
  }
  return rows[0]?.plaintext ?? null;
}
