import type { ReactElement } from 'react';

import { soaWizard } from '@advicelink/schemas';
import { Grid, Stack, Input, YesNoSelect } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * SOA Wizard — Cover & Title editor (REBUILD_PLAN §19.1.1).
 *
 * Title page metadata. Most fields auto-populate on the server when
 * a fresh wizard is opened (preparedFor from `personal.firstName +
 * surname`, preparedBy from the assigned adviser, ARN from the team
 * licensee config); the adviser may override every field here. None
 * of the fields are derived from each other server-side.
 */

export interface CoverEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: soaWizard.Cover) => Promise<unknown>;
  isLocked: boolean;
}

export function CoverEditor({
  serverValue,
  onSaveServer,
  isLocked,
}: CoverEditorProps): ReactElement {
  const form = useDraftSection<soaWizard.Cover>({
    schema: soaWizard.coverSchema,
    serverValue,
    onSave: onSaveServer,
  });

  function patch<K extends keyof soaWizard.Cover>(key: K, value: soaWizard.Cover[K]): void {
    form.setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Stack as="section" gap={6}>
      <h2>Cover &amp; Title</h2>
      <p data-fact-find-description>
        The SOA's title page. Most fields pre-fill from the locked Fact Find and team config —
        edit anything here that should differ for this client.
      </p>

      <Grid cols={2} gap={4}>
        <Field label="Document title">
          <Input
            value={form.draft.documentTitle ?? ''}
            onChange={(e) => patch('documentTitle', e.target.value || undefined)}
            placeholder="Statement of Advice"
            disabled={isLocked}
          />
        </Field>
        <Field label="Authorised representative number">
          <Input
            value={form.draft.authorisedRepresentativeNumber ?? ''}
            onChange={(e) =>
              patch('authorisedRepresentativeNumber', e.target.value || undefined)
            }
            disabled={isLocked}
          />
        </Field>

        <Field label="Prepared for">
          <Input
            value={form.draft.preparedFor ?? ''}
            onChange={(e) => patch('preparedFor', e.target.value || undefined)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Prepared by">
          <Input
            value={form.draft.preparedBy ?? ''}
            onChange={(e) => patch('preparedBy', e.target.value || undefined)}
            disabled={isLocked}
          />
        </Field>

        <Field label="Include partner on cover?">
          <YesNoSelect
            value={form.draft.preparedForPartner}
            onChange={(next) => patch('preparedForPartner', next)}
            disabled={isLocked}
          />
        </Field>
        <span />

        <Field label="Preparation date">
          <Input
            type="date"
            value={form.draft.preparationDate ?? ''}
            onChange={(e) => patch('preparationDate', e.target.value || undefined)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Valid until">
          <Input
            type="date"
            value={form.draft.validUntilDate ?? ''}
            onChange={(e) => patch('validUntilDate', e.target.value || undefined)}
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <SaveBar form={form} />
    </Stack>
  );
}
