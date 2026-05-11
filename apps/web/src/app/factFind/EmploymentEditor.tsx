import type { ReactElement } from 'react';

import { employmentSchema, type Employment, type EmploymentStatus } from '@advicelink/schemas';
import { Grid, Input, Select, Stack, Textarea, YesNoSelect } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Employment editor (REBUILD_PLAN §7.5.2).
 *
 * Captures the primary client's employment. Partner employment data
 * (employer, occupation) lives on `personal.partner*`; the dedicated
 * `partnerEmployment` Fact Find section was retired in WP-7 follow-up.
 *
 * Hours-of-leave inputs are presented in the same row as the
 * employment status because that is how advisers think about them
 * during data capture; the SOA insurance template later converts
 * hours → weeks for the cover-affordability section.
 */

const EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = [
  'Full-time',
  'Part-time',
  'Casual',
  'Self-employed',
  'Contractor',
  'Unemployed',
  'Retired',
  'Home duties',
  'Student',
];

export interface EmploymentEditorProps {
  /** 'Employment' for primary client, 'Partner employment' for partner. */
  heading: string;
  serverValue: unknown;
  onSaveServer: (parsed: Employment) => Promise<unknown>;
  isLocked: boolean;
}

export function EmploymentEditor({
  heading,
  serverValue,
  onSaveServer,
  isLocked,
}: EmploymentEditorProps): ReactElement {
  const form = useDraftSection<Employment>({
    schema: employmentSchema,
    serverValue,
    onSave: onSaveServer,
  });

  function patch<K extends keyof Employment>(key: K, value: Employment[K]): void {
    form.setDraft((prev: Employment) => ({ ...prev, [key]: value }));
  }

  return (
    <Stack as="section" gap={6}>
      <h2>{heading}</h2>

      <Grid cols={2} gap={4}>
        <Field label="Occupation" error={form.errors['occupation']}>
          <Input
            type="text"
            value={form.draft.occupation ?? ''}
            onChange={(e) =>
              patch('occupation', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked}
          />
        </Field>
        <Field label="Employer" error={form.errors['employer']}>
          <Input
            type="text"
            value={form.draft.employer ?? ''}
            onChange={(e) => patch('employer', e.target.value === '' ? undefined : e.target.value)}
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <Grid cols={2} gap={4}>
        <Field label="Employment status" error={form.errors['employmentStatus']}>
          <Select
            value={form.draft.employmentStatus ?? undefined}
            onValueChange={(v) =>
              patch('employmentStatus', (v ?? undefined) as EmploymentStatus | undefined)
            }
            disabled={isLocked}
            clearable
            options={EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field
          label="% of work in office"
          error={form.errors['percentageWorkInOffice']}
          help="0–100"
        >
          <Input
            type="number"
            min={0}
            max={100}
            value={form.draft.percentageWorkInOffice ?? ''}
            onChange={(e) =>
              patch(
                'percentageWorkInOffice',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <Field label="Work duties" error={form.errors['workDuties']}>
        <Textarea
          rows={3}
          value={form.draft.workDuties ?? ''}
          onChange={(e) => patch('workDuties', e.target.value === '' ? undefined : e.target.value)}
          disabled={isLocked}
        />
      </Field>

      <h3>Leave accrued (hours)</h3>
      <Grid cols={3} gap={4}>
        <Field label="Annual leave" error={form.errors['annualLeaveAccruedHours']}>
          <Input
            type="number"
            min={0}
            step={1}
            value={form.draft.annualLeaveAccruedHours ?? ''}
            onChange={(e) =>
              patch(
                'annualLeaveAccruedHours',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
            disabled={isLocked}
          />
        </Field>
        <Field label="Sick leave" error={form.errors['sickLeaveAccruedHours']}>
          <Input
            type="number"
            min={0}
            step={1}
            value={form.draft.sickLeaveAccruedHours ?? ''}
            onChange={(e) =>
              patch(
                'sickLeaveAccruedHours',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
            disabled={isLocked}
          />
        </Field>
        <Field label="Long service leave" error={form.errors['longServiceLeaveAccruedHours']}>
          <Input
            type="number"
            min={0}
            step={1}
            value={form.draft.longServiceLeaveAccruedHours ?? ''}
            onChange={(e) =>
              patch(
                'longServiceLeaveAccruedHours',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <h3>Workplace risk factors</h3>
      <Grid cols={2} gap={4}>
        <Field label="Works with hazardous materials">
          <YesNoSelect
            value={form.draft.worksWithHazardousMaterials ?? undefined}
            onChange={(v) => patch('worksWithHazardousMaterials', v)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Works at heights over 12m">
          <YesNoSelect
            value={form.draft.worksAtHeightsOver12m ?? undefined}
            onChange={(v) => patch('worksAtHeightsOver12m', v)}
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <SaveBar form={form} />
    </Stack>
  );
}
