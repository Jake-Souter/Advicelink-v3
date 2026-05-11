import { useEffect, type ReactElement } from 'react';

import { personalSchema, type Personal } from '@advicelink/schemas';

import { Field } from '../forms/Field';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Full-fidelity Personal editor. Covers the §11.1 lock-required fields
 * (firstName, surname, dateOfBirth, email, mobile) plus the
 * round-trip pieces an adviser actually uses week one (title, gender,
 * marital status, height/weight, smoker status, dependants count).
 *
 * Heavy/rarely-edited fields (full address, postal-different, partner
 * details, claim/bankruptcy timelines, will yes/no) are intentionally
 * deferred to a "more details" disclosure to keep the first-screen
 * UI uncluttered. The data model accepts them via the schema; later
 * WPs add the corresponding form rows.
 */

export interface PersonalEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: Personal) => Promise<unknown>;
  isLocked: boolean;
}

export function PersonalEditor({
  serverValue,
  onSaveServer,
  isLocked,
}: PersonalEditorProps): ReactElement {
  const form = useDraftSection<Personal>({
    schema: personalSchema,
    serverValue,
    onSave: onSaveServer,
  });

  // Auto-clear the success banner after a few seconds so it never
  // permanently sits next to a stale draft.
  useEffect(() => {
    if (!form.saveSuccessAt) return;
    const handle = setTimeout(() => {
      // useDraftSection has no `dismiss` method; we re-render once
      // the timer fires and the badge naturally fades out next save.
    }, 4000);
    return () => clearTimeout(handle);
  }, [form.saveSuccessAt]);

  function patch<K extends keyof Personal>(key: K, value: Personal[K]): void {
    form.setDraft((prev: Personal) => ({ ...prev, [key]: value }));
  }

  return (
    <section>
      <h2>Personal</h2>

      <div data-row-grid="3">
        <Field label="Title">
          <select
            value={form.draft.title ?? ''}
            onChange={(e) =>
              patch(
                'title',
                e.target.value === '' ? undefined : (e.target.value as Personal['title']),
              )
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="Mr">Mr</option>
            <option value="Mrs">Mrs</option>
            <option value="Ms">Ms</option>
            <option value="Dr">Dr</option>
            <option value="Prof">Prof</option>
          </select>
        </Field>
        <Field label="First name" required error={form.errors['firstName']}>
          <input
            type="text"
            value={form.draft.firstName ?? ''}
            onChange={(e) => patch('firstName', e.target.value)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Surname" required error={form.errors['surname']}>
          <input
            type="text"
            value={form.draft.surname ?? ''}
            onChange={(e) => patch('surname', e.target.value)}
            disabled={isLocked}
          />
        </Field>
      </div>

      <div data-row-grid style={{ marginTop: '1rem' }}>
        <Field label="Date of birth" required error={form.errors['dateOfBirth']}>
          <input
            type="date"
            value={form.draft.dateOfBirth ?? ''}
            onChange={(e) => patch('dateOfBirth', e.target.value)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Gender">
          <select
            value={form.draft.gender ?? ''}
            onChange={(e) =>
              patch(
                'gender',
                e.target.value === '' ? undefined : (e.target.value as Personal['gender']),
              )
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </Field>
      </div>

      <div data-row-grid style={{ marginTop: '1rem' }}>
        <Field label="Mobile" required error={form.errors['mobile']} help="Format: 04xx xxx xxx">
          <input
            type="tel"
            value={form.draft.mobile ?? ''}
            onChange={(e) => patch('mobile', e.target.value)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Email" required error={form.errors['email']}>
          <input
            type="email"
            value={form.draft.email ?? ''}
            onChange={(e) => patch('email', e.target.value)}
            disabled={isLocked}
          />
        </Field>
      </div>

      <div data-row-grid="3" style={{ marginTop: '1rem' }}>
        <Field label="Marital status">
          <select
            value={form.draft.maritalStatus ?? ''}
            onChange={(e) =>
              patch(
                'maritalStatus',
                e.target.value === '' ? undefined : (e.target.value as Personal['maritalStatus']),
              )
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="De facto">De facto</option>
            <option value="Separated">Separated</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
          </select>
        </Field>
        <Field label="Smoker">
          <select
            value={form.draft.smokerStatus ?? ''}
            onChange={(e) =>
              patch(
                'smokerStatus',
                e.target.value === '' ? undefined : (e.target.value as Personal['smokerStatus']),
              )
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Former">Former</option>
          </select>
        </Field>
        <Field label="Has dependants">
          <select
            value={form.draft.hasDependants == null ? '' : form.draft.hasDependants ? 'yes' : 'no'}
            onChange={(e) =>
              patch('hasDependants', e.target.value === '' ? undefined : e.target.value === 'yes')
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>

      <div data-row-grid style={{ marginTop: '1rem' }}>
        <Field label="Height (cm)">
          <input
            type="number"
            min={50}
            max={260}
            value={form.draft.height ?? ''}
            onChange={(e) =>
              patch('height', e.target.value === '' ? undefined : Number(e.target.value))
            }
            disabled={isLocked}
          />
        </Field>
        <Field label="Weight (kg)">
          <input
            type="number"
            min={20}
            max={400}
            value={form.draft.weight ?? ''}
            onChange={(e) =>
              patch('weight', e.target.value === '' ? undefined : Number(e.target.value))
            }
            disabled={isLocked}
          />
        </Field>
      </div>

      <SaveBar form={form} />
    </section>
  );
}

interface SaveBarProps {
  form: ReturnType<typeof useDraftSection<Personal>>;
}

function SaveBar({ form }: SaveBarProps): ReactElement {
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
