import { useMemo, useState, type ReactElement } from 'react';
import type { z } from 'zod';

import { Field } from '../forms/Field';

/**
 * Schema-validated JSON editor for the Fact Find sections that don't
 * yet have a bespoke form (employment, partnerEmployment, financial,
 * assets, liabilities, superannuation, contributions, insurance,
 * beneficiaries, riskProfile, recommendations).
 *
 * The textarea holds a JSON-encoded copy of the current section
 * value; on Save the value is parsed, fed through the section's
 * schema (so the same invariants the server enforces apply
 * client-side too), and the result is sent to `factFind.upsertSection`.
 *
 * This keeps every section *functional* in WP-6.4 while the dedicated
 * forms (one section per WP) get built out incrementally.
 */

export interface JsonEditorProps {
  sectionLabel: string;
  schema: z.ZodType<unknown>;
  serverValue: unknown;
  onSaveServer: (parsed: unknown) => Promise<unknown>;
  isLocked: boolean;
}

export function JsonEditor({
  sectionLabel,
  schema,
  serverValue,
  onSaveServer,
  isLocked,
}: JsonEditorProps): ReactElement {
  const initialJson = useMemo(() => JSON.stringify(serverValue ?? {}, null, 2), [serverValue]);
  const [text, setText] = useState(initialJson);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = text !== initialJson;

  async function handleSave(): Promise<void> {
    setError(null);
    setSuccess(false);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      return;
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      setError(
        `Schema validation failed: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
      return;
    }
    setIsSaving(true);
    try {
      await onSaveServer(result.data);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section>
      <h2>{sectionLabel}</h2>
      <p data-banner data-tone="info" style={{ marginBottom: '1rem' }}>
        This section uses the schema-validated JSON editor while the dedicated form is built. Edit
        the JSON directly; invalid payloads are rejected on save.
      </p>
      <Field label={`${sectionLabel} payload`} error={error ?? undefined}>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSuccess(false);
            setError(null);
          }}
          disabled={isLocked}
          spellCheck={false}
          rows={16}
        />
      </Field>
      {success ? (
        <p data-banner data-tone="success" style={{ marginTop: '1rem' }}>
          Saved.
        </p>
      ) : null}
      <div data-form-actions>
        <button
          type="button"
          data-button="secondary"
          onClick={() => {
            setText(initialJson);
            setError(null);
            setSuccess(false);
          }}
          disabled={!isDirty || isSaving}
        >
          Reset
        </button>
        <button
          type="button"
          data-button="primary"
          onClick={() => {
            void handleSave();
          }}
          disabled={!isDirty || isSaving || isLocked}
        >
          {isSaving ? 'Saving…' : 'Save section'}
        </button>
      </div>
    </section>
  );
}
