import type { ReactElement } from 'react';

import { Alert, Button, Cluster, Stack } from '@advicelink/ui';

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
    <Stack gap={3}>
      {form.saveError ? <Alert tone="danger">{form.saveError}</Alert> : null}
      {form.saveSuccessAt && !form.isDirty ? <Alert tone="success">Saved.</Alert> : null}
      <Cluster justify="end" gap={2}>
        <Button
          type="button"
          tone="secondary"
          onClick={form.reset}
          disabled={!form.isDirty || form.isSaving}
        >
          Reset
        </Button>
        <Button
          type="button"
          onClick={() => {
            void form.save();
          }}
          disabled={!form.isDirty || form.isSaving}
        >
          {form.isSaving ? 'Saving…' : 'Save section'}
        </Button>
      </Cluster>
    </Stack>
  );
}
