import { TRPCError } from '@trpc/server';

import { type Personal, type Dependant, type FactFindSectionId } from '@advicelink/schemas';

import type { LoadedFactFind } from './load.js';

/**
 * Guard for the `lockFactFind` transition.
 *
 * Per REBUILD_PLAN §11.1, the Fact Find may only be locked when the
 * minimum-required field set is populated:
 *
 *   - personal: firstName, surname, dateOfBirth, email, mobile
 *   - every dependant (when `personal.hasDependants === true`):
 *     firstName, surname, dateOfBirth
 *
 * Other completeness rules (insurance covers, AR cadence target, etc.)
 * are evaluated at SOA-presentation time, not here. The intent at
 * Fact Find lock is "do we have enough to start drafting an SOA?".
 *
 * Returns the list of missing-field paths so the UI can highlight
 * them. Throws `BAD_REQUEST` with the same list if `mode: 'throw'`.
 */

export type MissingField = {
  section: FactFindSectionId;
  path: string;
  message: string;
};

export interface AssertReadyToLockOptions {
  /** When 'throw' (default), raises a TRPCError if any field missing.
   *  When 'collect', returns the list and lets the caller decide. */
  mode?: 'throw' | 'collect';
}

export function assertReadyToLock(
  loaded: LoadedFactFind,
  options: AssertReadyToLockOptions = {},
): MissingField[] {
  const personal = loaded.sections.personal as Personal;
  const missing: MissingField[] = [];

  for (const field of ['firstName', 'surname', 'dateOfBirth', 'email', 'mobile'] as const) {
    if (personal[field] == null || String(personal[field]).trim().length === 0) {
      missing.push({
        section: 'personal',
        path: `personal.${field}`,
        message: `personal.${field} is required to lock the Fact Find`,
      });
    }
  }

  if (personal.hasDependants === true) {
    const deps: Dependant[] = personal.dependants ?? [];
    deps.forEach((dep, idx) => {
      for (const field of ['firstName', 'surname', 'dateOfBirth'] as const) {
        if (dep[field] == null || String(dep[field]).trim().length === 0) {
          missing.push({
            section: 'personal',
            path: `personal.dependants[${idx}].${field}`,
            message: `Dependant #${idx + 1} ${field} is required to lock the Fact Find`,
          });
        }
      }
    });
  }

  if ((options.mode ?? 'throw') === 'throw' && missing.length > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Fact Find is not ready to lock: ${missing.length} required field(s) missing`,
      cause: { missing },
    });
  }
  return missing;
}
