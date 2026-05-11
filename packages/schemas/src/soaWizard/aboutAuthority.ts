import { z } from 'zod';

import { basisOfAdviceSchema, feeForServiceModelSchema, longText } from './primitives.js';

/**
 * §19.1.2 `aboutAuthority` — the boilerplate "About us" + scope-of-advice
 * + authority-to-act block at the front of the SOA. The bulk of the
 * narrative is templated by the licensee (rendered through merge
 * tokens at DOCX time, REBUILD_PLAN §19.4.2); this section captures
 * the per-client overrides.
 *
 * AI assist is wired against `scopeOfAdvice` (`promptKey:
 * soaWizardScopeOfAdvice`).
 */
export const aboutAuthoritySchema = z
  .object({
    scopeOfAdvice: longText.optional(),
    excludedFromAdvice: longText.optional(),
    basisOfAdvice: basisOfAdviceSchema.optional(),
    feeForServiceModel: feeForServiceModelSchema.optional(),
    /** Long-form templated default with merge tokens; adviser may edit. */
    authorityStatement: longText.optional(),
    acknowledgementOfRisks: longText.optional(),
  })
  .strict();

export type AboutAuthority = z.infer<typeof aboutAuthoritySchema>;
export const aboutAuthorityDefault: AboutAuthority = aboutAuthoritySchema.parse({});
