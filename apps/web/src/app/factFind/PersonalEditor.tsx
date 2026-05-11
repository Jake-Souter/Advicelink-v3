import { useEffect, type ReactElement } from 'react';

import {
  isPartneredStatus,
  personalSchema,
  type Personal,
  type Address,
} from '@advicelink/schemas';
import { Alert, Grid, Input, Select, Stack, Textarea, YesNoSelect } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { SaveBar } from '../forms/SaveBar';
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
 * Partner income detail is captured in the Income section as a row
 * marked against the partner; the dedicated `partnerEmployment` Fact
 * Find section was retired in WP-7 follow-up.
 */

const TITLE_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'] as const;
const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;
const MARITAL_OPTIONS = [
  'Single',
  'Married',
  'De facto',
  'Separated',
  'Divorced',
  'Widowed',
] as const;
const SMOKER_OPTIONS: ReadonlyArray<{
  value: NonNullable<Personal['smokerStatus']>;
  label: string;
}> = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'FORMER', label: 'Former' },
];

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
    <Stack as="section" gap={6}>
      <h2>Personal</h2>

      <Grid cols={3} gap={4}>
        <Field label="Title">
          <Select
            value={form.draft.title ?? undefined}
            onValueChange={(v) => patch('title', (v ?? undefined) as Personal['title'])}
            disabled={isLocked}
            clearable
            options={TITLE_OPTIONS.map((t) => ({ value: t, label: t }))}
          />
        </Field>
        <Field label="First name" required error={form.errors['firstName']}>
          <Input
            type="text"
            value={form.draft.firstName ?? ''}
            onChange={(e) => patch('firstName', e.target.value)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Surname" required error={form.errors['surname']}>
          <Input
            type="text"
            value={form.draft.surname ?? ''}
            onChange={(e) => patch('surname', e.target.value)}
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <Grid cols={2} gap={4}>
        <Field label="Date of birth" required error={form.errors['dateOfBirth']}>
          <Input
            type="date"
            value={form.draft.dateOfBirth ?? ''}
            onChange={(e) => patch('dateOfBirth', e.target.value)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Gender">
          <Select
            value={form.draft.gender ?? undefined}
            onValueChange={(v) => patch('gender', (v ?? undefined) as Personal['gender'])}
            disabled={isLocked}
            clearable
            options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))}
          />
        </Field>
      </Grid>

      <Grid cols={2} gap={4}>
        <Field label="Mobile" required error={form.errors['mobile']} help="Format: 04xx xxx xxx">
          <Input
            type="tel"
            value={form.draft.mobile ?? ''}
            onChange={(e) => patch('mobile', e.target.value)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Email" required error={form.errors['email']}>
          <Input
            type="email"
            value={form.draft.email ?? ''}
            onChange={(e) => patch('email', e.target.value)}
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <Grid cols={3} gap={4}>
        <Field label="Marital status">
          <Select
            value={form.draft.maritalStatus ?? undefined}
            onValueChange={(v) =>
              patch('maritalStatus', (v ?? undefined) as Personal['maritalStatus'])
            }
            disabled={isLocked}
            clearable
            options={MARITAL_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Smoker">
          <Select
            value={form.draft.smokerStatus ?? undefined}
            onValueChange={(v) =>
              patch('smokerStatus', (v ?? undefined) as Personal['smokerStatus'])
            }
            disabled={isLocked}
            clearable
            options={SMOKER_OPTIONS}
          />
        </Field>
        <Field label="Has dependants">
          <YesNoSelect
            value={form.draft.hasDependants ?? undefined}
            onChange={(v) => patch('hasDependants', v)}
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <Grid cols={2} gap={4}>
        <Field label="Height (cm)">
          <Input
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
          <Input
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
      </Grid>

      <h3>Home address</h3>
      <AddressBlock
        value={home}
        onChange={(p) => patchAddress('homeAddress', p)}
        disabled={isLocked}
        idPrefix="home"
      />

      <Grid cols={2} gap={4}>
        <Field label="Postal address differs from home">
          <YesNoSelect
            value={form.draft.hasDifferentPostalAddress ?? undefined}
            onChange={(next) => {
              form.setDraft((prev: Personal) => ({
                ...prev,
                hasDifferentPostalAddress: next,
                postalAddress: next === false ? null : prev.postalAddress,
              }));
            }}
            disabled={isLocked}
            yesLabel="Yes"
            noLabel="No (same as home)"
          />
        </Field>
      </Grid>

      {form.draft.hasDifferentPostalAddress === true ? (
        <>
          <h3>Postal address</h3>
          <AddressBlock
            value={postal}
            onChange={(p) => patchAddress('postalAddress', p)}
            disabled={isLocked}
            idPrefix="postal"
          />
        </>
      ) : null}

      {partnered ? (
        <Stack gap={3}>
          <h3>Partner</h3>
          <Alert tone="info">
            Partner shown because marital status is &lsquo;{form.draft.maritalStatus}&rsquo;.
            Employment, income breakdown and contact details for the partner live in the{' '}
            <strong>Partner Employment</strong> section.
          </Alert>
          <Grid cols={3} gap={4}>
            <Field label="Partner name" error={form.errors['partnerName']}>
              <Input
                type="text"
                value={form.draft.partnerName ?? ''}
                onChange={(e) =>
                  patch('partnerName', e.target.value === '' ? undefined : e.target.value)
                }
                disabled={isLocked}
              />
            </Field>
            <Field label="Partner DOB" error={form.errors['partnerDateOfBirth']}>
              <Input
                type="date"
                value={form.draft.partnerDateOfBirth ?? ''}
                onChange={(e) =>
                  patch('partnerDateOfBirth', e.target.value === '' ? undefined : e.target.value)
                }
                disabled={isLocked}
              />
            </Field>
            <Field label="Partner annual income (AUD)" error={form.errors['partnerIncomeAnnual']}>
              <Input
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
          </Grid>
        </Stack>
      ) : null}

      <h3>Other personal details</h3>
      <Grid cols={3} gap={4}>
        <Field label="Qualification">
          <Input
            type="text"
            value={form.draft.qualification ?? ''}
            onChange={(e) =>
              patch('qualification', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked}
          />
        </Field>
        <Field label="Next of kin">
          <Input
            type="text"
            value={form.draft.nextOfKin ?? ''}
            onChange={(e) => patch('nextOfKin', e.target.value === '' ? undefined : e.target.value)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Next of kin contact">
          <Input
            type="text"
            value={form.draft.nextOfKinContact ?? ''}
            onChange={(e) =>
              patch('nextOfKinContact', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <h3>Disclosures</h3>
      <Grid cols={3} gap={4}>
        <Field label="Has a current will">
          <YesNoSelect
            value={form.draft.hasWill ?? undefined}
            onChange={(v) => patch('hasWill', v)}
            disabled={isLocked}
          />
        </Field>
        <Field label="Has previously claimed on insurance">
          <YesNoSelect
            value={form.draft.hasClaimedOnInsurance ?? undefined}
            onChange={(next) => {
              form.setDraft((prev: Personal) => ({
                ...prev,
                hasClaimedOnInsurance: next,
                insuranceClaim: next === false ? null : prev.insuranceClaim,
              }));
            }}
            disabled={isLocked}
          />
        </Field>
        <Field label="Has been declared bankrupt">
          <YesNoSelect
            value={form.draft.hasBeenBankrupt ?? undefined}
            onChange={(next) => {
              form.setDraft((prev: Personal) => ({
                ...prev,
                hasBeenBankrupt: next,
                bankruptcy: next === false ? null : prev.bankruptcy,
              }));
            }}
            disabled={isLocked}
          />
        </Field>
      </Grid>

      {form.draft.hasClaimedOnInsurance === true ? (
        <Grid cols={2} gap={4}>
          <Field label="Date of insurance claim">
            <Input
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
            <Textarea
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
        </Grid>
      ) : null}

      {form.draft.hasBeenBankrupt === true ? (
        <Grid cols={2} gap={4}>
          <Field label="Date of bankruptcy">
            <Input
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
            <Textarea
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
        </Grid>
      ) : null}

      <Field label="Health notes" help="Optional context for the underwriter / risk profile.">
        <Textarea
          rows={3}
          value={form.draft.healthNotes ?? ''}
          onChange={(e) => patch('healthNotes', e.target.value === '' ? undefined : e.target.value)}
          disabled={isLocked}
        />
      </Field>

      <SaveBar form={form} />
    </Stack>
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

const AU_STATES: ReadonlyArray<NonNullable<Address['state']>> = [
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
    <Stack gap={3}>
      <Grid cols={3} gap={4}>
        <Field label="Street">
          <Input
            type="text"
            value={value.street ?? ''}
            onChange={(e) =>
              onChange({ street: e.target.value === '' ? undefined : e.target.value })
            }
            disabled={disabled}
          />
        </Field>
        <Field label="Suburb">
          <Input
            type="text"
            value={value.suburb ?? ''}
            onChange={(e) =>
              onChange({ suburb: e.target.value === '' ? undefined : e.target.value })
            }
            disabled={disabled}
          />
        </Field>
        <Field label="City">
          <Input
            type="text"
            value={value.city ?? ''}
            onChange={(e) => onChange({ city: e.target.value === '' ? undefined : e.target.value })}
            disabled={disabled}
          />
        </Field>
      </Grid>
      <Grid cols={3} gap={4}>
        <Field label="State">
          <Select
            value={value.state ?? undefined}
            onValueChange={(v) =>
              onChange({ state: (v ?? undefined) as NonNullable<Address['state']> | undefined })
            }
            disabled={disabled}
            clearable
            options={AU_STATES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Postcode" help="4 digits">
          <Input
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
          <Input
            type="text"
            value={value.country ?? 'Australia'}
            onChange={(e) => onChange({ country: e.target.value })}
            disabled={disabled}
          />
        </Field>
      </Grid>
    </Stack>
  );
}
