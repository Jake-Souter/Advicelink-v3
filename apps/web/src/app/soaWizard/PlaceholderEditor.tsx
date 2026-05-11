import type { ReactElement } from 'react';

import { Alert, Stack } from '@advicelink/ui';

import type { SoaWizardSectionMeta } from './sectionMeta';

/**
 * Placeholder editor for SOA Wizard sections that don't yet have a
 * bespoke form (the bespoke ones are migrated section-by-section in
 * the WP-8 follow-up cycle).
 *
 * The placeholder still renders the section header + description so
 * the wizard's sub-nav deep-links don't 404, and surfaces a small
 * preview of the persisted JSON so a developer can sanity-check
 * what's already saved against the schema. There is no SaveBar —
 * editing is intentionally disabled here.
 */
export interface PlaceholderEditorProps {
  meta: SoaWizardSectionMeta;
  serverValue: unknown;
}

export function PlaceholderEditor({ meta, serverValue }: PlaceholderEditorProps): ReactElement {
  // Best-effort pretty-print of the persisted slot. Falls back to the
  // string-coerced form if the value isn't JSON-serialisable.
  let preview = '';
  try {
    preview = JSON.stringify(serverValue ?? {}, null, 2);
  } catch {
    preview = String(serverValue);
  }

  return (
    <Stack as="section" gap={6}>
      <h2>{meta.label}</h2>
      <p data-fact-find-description>{meta.description}</p>

      <Alert tone="neutral" title="Editor coming soon">
        The bespoke editor for this section is on the WP-8 backlog. The persisted shape
        already round-trips through its Zod schema and is safe to populate via the API
        directly while the form is being built.
      </Alert>

      <Stack gap={2}>
        <strong data-fact-find-subheading>Persisted JSON</strong>
        <pre data-fact-find-pre>{preview}</pre>
      </Stack>
    </Stack>
  );
}
