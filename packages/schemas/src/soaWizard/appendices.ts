import { z } from 'zod';

import { longText, shortText, uuidSchema } from './primitives.js';

/**
 * §19.1.15 `appendices`.
 *
 * Attached documents are pulled from the client's document store at
 * render time; this section just lists which ones to include +
 * carries glossary entries.
 */
export const attachedDocumentSchema = z
  .object({
    id: uuidSchema,
    /** 'fsg' | 'pds' | 'fact-sheet' | 'other' — kept open as text. */
    documentType: shortText,
    label: shortText,
    /** S3 key (REBUILD_PLAN §9.3). */
    storageKey: shortText,
  })
  .strict();
export type AttachedDocument = z.infer<typeof attachedDocumentSchema>;

export const glossaryTermSchema = z
  .object({
    id: uuidSchema,
    term: shortText,
    definition: longText,
  })
  .strict();
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;

export const appendicesSchema = z
  .object({
    attachedDocuments: z.array(attachedDocumentSchema).max(40).default([]),
    glossary: z.array(glossaryTermSchema).max(60).default([]),
    notes: longText.optional(),
  })
  .strict();

export type Appendices = z.infer<typeof appendicesSchema>;
export const appendicesDefault: Appendices = appendicesSchema.parse({});
