import type { ReactElement } from 'react';

import { employmentSchema, type Employment, type EmploymentStatus } from '@advicelink/schemas';

import { Field } from '../forms/Field';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Employment editor (REBUILD_PLAN §7.5.2).
 *
 * Used twice — once for the primary client (`employment` section) and
 * once for the partner (`partnerEmployment`) — with a label prop
 * that swaps the heading. Same Zod shape, two columns on `clients`.
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
    <section>
      <h2>{heading}</h2>

      <div data-row-grid>
        <Field label="Occupation" error={form.errors['occupation']}>
          <input
            type="text"
            value={form.draft.occupation ?? ''}
            onChange={(e) =>
              patch('occupation', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked}
          />
        </Field>
        <Field label="Employer" error={form.errors['employer']}>
          <input
            type="text"
            value={form.draft.employer ?? ''}
            onChange={(e) => patch('employer', e.target.value === '' ? undefined : e.target.value)}
            disabled={isLocked}
          />
        </Field>
      </div>

      <div data-row-grid="3" style={{ marginTop: '1rem' }}>
        <Field label="Employment status" error={form.errors['employmentStatus']}>
          <select
            value={form.draft.employmentStatus ?? ''}
            onChange={(e) =>
              patch(
                'employmentStatus',
                e.target.value === '' ? undefined : (e.target.value as EmploymentStatus),
              )
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="% of work in office"
          error={form.errors['percentageWorkInOffice']}
          help="0–100"
        >
          <input
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
      </div>

      <Field label="Work duties" error={form.errors['workDuties']}>
        <textarea
          rows={3}
          value={form.draft.workDuties ?? ''}
          onChange={(e) => patch('workDuties', e.target.value === '' ? undefined : e.target.value)}
          disabled={isLocked}
        />
      </Field>

      <h3 style={{ marginTop: '1.5rem' }}>Leave accrued (hours)</h3>
      <div data-row-grid="3">
        <Field label="Annual leave" error={form.errors['annualLeaveAccruedHours']}>
          <input
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
          <input
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
          <input
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
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>Workplace risk factors</h3>
      <div data-row-grid>
        <Field label="Works with hazardous materials">
          <select
            value={
              form.draft.worksWithHazardousMaterials == null
                ? ''
                : form.draft.worksWithHazardousMaterials
                  ? 'yes'
                  : 'no'
            }
            onChange={(e) =>
              patch(
                'worksWithHazardousMaterials',
                e.target.value === '' ? undefined : e.target.value === 'yes',
              )
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Works at heights over 12m">
          <select
            value={
              form.draft.worksAtHeightsOver12m == null
                ? ''
                : form.draft.worksAtHeightsOver12m
                  ? 'yes'
                  : 'no'
            }
            onChange={(e) =>
              patch(
                'worksAtHeightsOver12m',
                e.target.value === '' ? undefined : e.target.value === 'yes',
              )
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      </div>

      <SaveBar form={form} />
    </section>
  );
}
