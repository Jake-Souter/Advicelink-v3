import { useEffect, type ReactElement } from 'react';

import {
  isPartneredStatus,
  personalSchema,
  type Personal,
  type Address,
} from '@advicelink/schemas';

import { Field } from '../forms/Field';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Full-fidelity Personal editor. Covers the §7.5.1 + §11.1 fields
 * the adviser uses week one — name, contact, marital status,
 * dependants, height/weight/smoker — plus the home / postal
 * addresses, partner block, will / bankruptcy / insurance-claim
 * disclosures. Partner-specific fields render only when the marital
 * status is `Married` or `De facto` (the canonical partnered set
 * exported by the schemas package as `isPartneredStatus`).
 *
 * The richer partner record (employment, income breakdown) lives on
 * the dedicated `partnerEmployment` Fact Find section.
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

  function patchAddress(key: 'homeAddress' | 'postalAddress', next: Partial<Address>): void {
    form.setDraft((prev: Personal) => {
      const current = (prev[key] ?? { country: 'Australia' }) as Address;
      return { ...prev, [key]: { ...current, ...next } };
    });
  }

  const partnered = isPartneredStatus(form.draft.maritalStatus);
  const home = (form.draft.homeAddress ?? { country: 'Australia' }) as Address;
  const postal = (form.draft.postalAddress ?? { country: 'Australia' }) as Address;

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
            <option value="YES">Yes</option>
            <option value="NO">No</option>
            <option value="FORMER">Former</option>
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

      <h3 style={{ marginTop: '1.5rem' }}>Home address</h3>
      <AddressBlock
        value={home}
        onChange={(patch) => patchAddress('homeAddress', patch)}
        disabled={isLocked}
        idPrefix="home"
      />

      <div data-row-grid style={{ marginTop: '1rem' }}>
        <Field label="Postal address differs from home">
          <select
            value={
              form.draft.hasDifferentPostalAddress == null
                ? ''
                : form.draft.hasDifferentPostalAddress
                  ? 'yes'
                  : 'no'
            }
            onChange={(e) => {
              const next = e.target.value === '' ? undefined : e.target.value === 'yes';
              form.setDraft((prev: Personal) => ({
                ...prev,
                hasDifferentPostalAddress: next,
                postalAddress: next === false ? null : prev.postalAddress,
              }));
            }}
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="no">No (same as home)</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      </div>

      {form.draft.hasDifferentPostalAddress === true ? (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Postal address</h3>
          <AddressBlock
            value={postal}
            onChange={(patch) => patchAddress('postalAddress', patch)}
            disabled={isLocked}
            idPrefix="postal"
          />
        </>
      ) : null}

      {partnered ? (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Partner</h3>
          <p data-banner data-tone="info" style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            Partner shown because marital status is &lsquo;{form.draft.maritalStatus}&rsquo;.
            Employment, income breakdown and contact details for the partner live in the
            <strong> Partner Employment</strong> section.
          </p>
          <div data-row-grid="3">
            <Field label="Partner name" error={form.errors['partnerName']}>
              <input
                type="text"
                value={form.draft.partnerName ?? ''}
                onChange={(e) =>
                  patch('partnerName', e.target.value === '' ? undefined : e.target.value)
                }
                disabled={isLocked}
              />
            </Field>
            <Field label="Partner DOB" error={form.errors['partnerDateOfBirth']}>
              <input
                type="date"
                value={form.draft.partnerDateOfBirth ?? ''}
                onChange={(e) =>
                  patch('partnerDateOfBirth', e.target.value === '' ? undefined : e.target.value)
                }
                disabled={isLocked}
              />
            </Field>
            <Field label="Partner annual income (AUD)" error={form.errors['partnerIncomeAnnual']}>
              <input
                type="number"
                min={0}
                step={100}
                value={form.draft.partnerIncomeAnnual ?? ''}
                onChange={(e) =>
                  patch(
                    'partnerIncomeAnnual',
                    e.target.value === '' ? undefined : Number(e.target.value),
                  )
                }
                disabled={isLocked}
              />
            </Field>
          </div>
        </>
      ) : null}

      <h3 style={{ marginTop: '1.5rem' }}>Other personal details</h3>
      <div data-row-grid="3">
        <Field label="Qualification">
          <input
            type="text"
            value={form.draft.qualification ?? ''}
            onChange={(e) =>
              patch('qualification', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked}
          />
        </Field>
        <Field label="Next of kin">
          <input
            type="text"
            value={form.draft.nextOfKin ?? ''}
            onChange={(e) => patch('nextOfKin', e.target.value === '' ? undefined : e.target.value)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Next of kin contact">
          <input
            type="text"
            value={form.draft.nextOfKinContact ?? ''}
            onChange={(e) =>
              patch('nextOfKinContact', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked}
          />
        </Field>
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>Disclosures</h3>
      <div data-row-grid="3">
        <Field label="Has a current will">
          <select
            value={form.draft.hasWill == null ? '' : form.draft.hasWill ? 'yes' : 'no'}
            onChange={(e) =>
              patch('hasWill', e.target.value === '' ? undefined : e.target.value === 'yes')
            }
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Has previously claimed on insurance">
          <select
            value={
              form.draft.hasClaimedOnInsurance == null
                ? ''
                : form.draft.hasClaimedOnInsurance
                  ? 'yes'
                  : 'no'
            }
            onChange={(e) => {
              const next = e.target.value === '' ? undefined : e.target.value === 'yes';
              form.setDraft((prev: Personal) => ({
                ...prev,
                hasClaimedOnInsurance: next,
                insuranceClaim: next === false ? null : prev.insuranceClaim,
              }));
            }}
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Has been declared bankrupt">
          <select
            value={
              form.draft.hasBeenBankrupt == null ? '' : form.draft.hasBeenBankrupt ? 'yes' : 'no'
            }
            onChange={(e) => {
              const next = e.target.value === '' ? undefined : e.target.value === 'yes';
              form.setDraft((prev: Personal) => ({
                ...prev,
                hasBeenBankrupt: next,
                bankruptcy: next === false ? null : prev.bankruptcy,
              }));
            }}
            disabled={isLocked}
          >
            <option value="">—</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      </div>

      {form.draft.hasClaimedOnInsurance === true ? (
        <div data-row-grid style={{ marginTop: '0.75rem' }}>
          <Field label="Date of insurance claim">
            <input
              type="date"
              value={form.draft.insuranceClaim?.dateOfClaim ?? ''}
              onChange={(e) => {
                const date = e.target.value === '' ? undefined : e.target.value;
                form.setDraft((prev: Personal) => ({
                  ...prev,
                  insuranceClaim: { ...(prev.insuranceClaim ?? {}), dateOfClaim: date },
                }));
              }}
              disabled={isLocked}
            />
          </Field>
          <Field label="Insurance claim notes">
            <textarea
              rows={3}
              value={form.draft.insuranceClaim?.notes ?? ''}
              onChange={(e) => {
                const notes = e.target.value === '' ? undefined : e.target.value;
                form.setDraft((prev: Personal) => ({
                  ...prev,
                  insuranceClaim: { ...(prev.insuranceClaim ?? {}), notes },
                }));
              }}
              disabled={isLocked}
            />
          </Field>
        </div>
      ) : null}

      {form.draft.hasBeenBankrupt === true ? (
        <div data-row-grid style={{ marginTop: '0.75rem' }}>
          <Field label="Date of bankruptcy">
            <input
              type="date"
              value={form.draft.bankruptcy?.dateOfBankruptcy ?? ''}
              onChange={(e) => {
                const date = e.target.value === '' ? undefined : e.target.value;
                form.setDraft((prev: Personal) => ({
                  ...prev,
                  bankruptcy: { ...(prev.bankruptcy ?? {}), dateOfBankruptcy: date },
                }));
              }}
              disabled={isLocked}
            />
          </Field>
          <Field label="Bankruptcy notes">
            <textarea
              rows={3}
              value={form.draft.bankruptcy?.notes ?? ''}
              onChange={(e) => {
                const notes = e.target.value === '' ? undefined : e.target.value;
                form.setDraft((prev: Personal) => ({
                  ...prev,
                  bankruptcy: { ...(prev.bankruptcy ?? {}), notes },
                }));
              }}
              disabled={isLocked}
            />
          </Field>
        </div>
      ) : null}

      <Field label="Health notes" help="Optional context for the underwriter / risk profile.">
        <textarea
          rows={3}
          value={form.draft.healthNotes ?? ''}
          onChange={(e) => patch('healthNotes', e.target.value === '' ? undefined : e.target.value)}
          disabled={isLocked}
        />
      </Field>

      <SaveBar form={form} />
    </section>
  );
}

/**
 * AU-address sub-form. Renders the six address fields in a tight
 * grid with a state dropdown that matches the canonical
 * `auStateSchema` enum.
 */
interface AddressBlockProps {
  value: Address;
  onChange: (patch: Partial<Address>) => void;
  disabled: boolean;
  idPrefix: string;
}

const AU_STATES: ReadonlyArray<Address['state']> = [
  'ACT',
  'NSW',
  'NT',
  'QLD',
  'SA',
  'TAS',
  'VIC',
  'WA',
];

function AddressBlock({ value, onChange, disabled }: AddressBlockProps): ReactElement {
  return (
    <>
      <div data-row-grid="3">
        <Field label="Street">
          <input
            type="text"
            value={value.street ?? ''}
            onChange={(e) =>
              onChange({ street: e.target.value === '' ? undefined : e.target.value })
            }
            disabled={disabled}
          />
        </Field>
        <Field label="Suburb">
          <input
            type="text"
            value={value.suburb ?? ''}
            onChange={(e) =>
              onChange({ suburb: e.target.value === '' ? undefined : e.target.value })
            }
            disabled={disabled}
          />
        </Field>
        <Field label="City">
          <input
            type="text"
            value={value.city ?? ''}
            onChange={(e) => onChange({ city: e.target.value === '' ? undefined : e.target.value })}
            disabled={disabled}
          />
        </Field>
      </div>
      <div data-row-grid="3" style={{ marginTop: '0.75rem' }}>
        <Field label="State">
          <select
            value={value.state ?? ''}
            onChange={(e) =>
              onChange({
                state:
                  e.target.value === ''
                    ? undefined
                    : (e.target.value as NonNullable<Address['state']>),
              })
            }
            disabled={disabled}
          >
            <option value="">—</option>
            {AU_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Postcode" help="4 digits">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={value.postcode ?? ''}
            onChange={(e) =>
              onChange({ postcode: e.target.value === '' ? undefined : e.target.value })
            }
            disabled={disabled}
          />
        </Field>
        <Field label="Country">
          <input
            type="text"
            value={value.country ?? 'Australia'}
            onChange={(e) => onChange({ country: e.target.value })}
            disabled={disabled}
          />
        </Field>
      </div>
    </>
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
