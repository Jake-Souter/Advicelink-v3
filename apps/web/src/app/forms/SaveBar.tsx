import type { ReactElement } from 'react';

import type { UseDraftSectionResult } from './useDraftSection';

/**
 * `SaveBar` — shared explicit-save footer for every Fact Find
 * editor. Consumes the result of `useDraftSection` so the same
 * "dirty / saving / saved / failed" semantics apply across sections
 * without per-editor duplication.
 *
 * The Fact Find UI never autosaves on every keystroke — sections
 * commit on the user's explicit "Save section" click. That keeps
 * the audit trail (one `audit_log` entry per save) legible and
 * avoids racy autosave loops while the cross-section derivations
 * fan out (`deriveAll` in the upsert service).
 */
export interface SaveBarProps<T> {
  form: UseDraftSectionResult<T>;
}

export function SaveBar<T>({ form }: SaveBarProps<T>): ReactElement {
  return (
    <>
      {form.saveError ? (
        <p data-banner data-tone="danger" role="alert" style={{ marginTop: '1rem' }}>
          {form.saveError}
        </p>
      ) : null}
      {form.saveSuccessAt && !form.isDirty ? (
        <p data-banner data-tone="success" style={{ marginTop: '1rem' }}>
          Saved.
        </p>
      ) : null}
      <div data-form-actions>
        <button
          type="button"
          data-button="secondary"
          onClick={form.reset}
          disabled={!form.isDirty || form.isSaving}
        >
          Reset
        </button>
        <button
          type="button"
          data-button="primary"
          onClick={() => {
            void form.save();
          }}
          disabled={!form.isDirty || form.isSaving}
        >
          {form.isSaving ? 'Saving…' : 'Save section'}
        </button>
      </div>
    </>
  );
}
