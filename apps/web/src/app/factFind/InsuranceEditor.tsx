import type { ReactElement } from 'react';

import {
  insuranceSchema,
  isIpCover,
  type CoverType,
  type Frequency,
  type Insurance,
  type InsuranceCover,
} from '@advicelink/schemas';
import { Cluster, Grid, Input, Select, Stack, YesNoSelect } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { ItemList } from '../forms/ItemList';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Insurance editor (REBUILD_PLAN §7.5.7).
 *
 * Each cover row is one of five cover types. The render switches
 * sub-fields based on `isIpCover(coverType)`:
 *
 *   - Life / TPD / Trauma → coverAmount, payee, premium…
 *   - IP / Income Protection → monthlyBenefit, waitingPeriod, benefitPeriod
 *   - TPD additionally exposes definition (Any/Own Occ) and structure
 *
 * Section totals (`totalSuperPremium`, `totalPersonalPremium`) and
 * per-cover `annualPremium` are derived server-side on save.
 */

const COVER_TYPES: readonly CoverType[] = ['Life', 'TPD', 'Trauma', 'IP'];
const FREQUENCIES: readonly Frequency[] = [
  'Weekly',
  'Fortnightly',
  'Monthly',
  'Quarterly',
  'Annual',
];
const PAYEE_OPTIONS: ReadonlyArray<{ value: NonNullable<InsuranceCover['payee']>; label: string }> =
  [
    { value: 'Self', label: 'Self' },
    { value: 'Super', label: 'Super' },
  ];
const TPD_DEFINITION_OPTIONS: ReadonlyArray<{
  value: NonNullable<InsuranceCover['definition']>;
  label: string;
}> = [
  { value: 'Any Occ', label: 'Any Occ' },
  { value: 'Own Occ', label: 'Own Occ' },
];
const TPD_STRUCTURE_OPTIONS: ReadonlyArray<{
  value: NonNullable<InsuranceCover['structure']>;
  label: string;
}> = [
  { value: 'Standalone', label: 'Standalone' },
  { value: 'Linked', label: 'Linked' },
];
const PREMIUM_TYPE_OPTIONS: ReadonlyArray<{
  value: NonNullable<InsuranceCover['premiumType']>;
  label: string;
}> = [
  { value: 'Stepped', label: 'Stepped' },
  { value: 'Level', label: 'Level' },
  { value: 'Hybrid', label: 'Hybrid' },
];

export interface InsuranceEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: Insurance) => Promise<unknown>;
  isLocked: boolean;
}

export function InsuranceEditor({
  serverValue,
  onSaveServer,
  isLocked,
}: InsuranceEditorProps): ReactElement {
  const form = useDraftSection<Insurance>({
    schema: insuranceSchema,
    serverValue,
    onSave: onSaveServer,
  });

  function setCovers(next: InsuranceCover[]): void {
    form.setDraft((prev: Insurance) => ({ ...prev, covers: next }));
  }

  function makeNewCover(): InsuranceCover {
    return {
      id: crypto.randomUUID(),
      coverType: 'Life',
      coverAmount: 0,
      payee: 'Self',
    };
  }

  return (
    <Stack as="section" gap={6}>
      <h2>Insurance</h2>
      <p data-fact-find-description>One row per cover. Sub-fields adapt to the cover type.</p>

      <ItemList
        label="Existing covers"
        items={form.draft.covers}
        onChange={setCovers}
        makeNew={makeNewCover}
        max={30}
        disabled={isLocked}
        emptyHint="No insurance covers captured yet."
        summary={
          <Cluster gap={6} data-fact-find-totals>
            <span>
              Inside-super premium (annual):{' '}
              <strong>${(form.draft.totalSuperPremium ?? 0).toLocaleString()}</strong>
            </span>
            <span>
              Personal premium (annual):{' '}
              <strong>${(form.draft.totalPersonalPremium ?? 0).toLocaleString()}</strong>
            </span>
          </Cluster>
        }
        renderRow={(cover, index, patch) => {
          const ip = isIpCover(cover.coverType);
          return (
            <Stack gap={3}>
              <Grid cols={3} gap={4}>
                <Field label="Cover type" error={form.errors[`covers.${index}.coverType`]}>
                  <Select
                    value={cover.coverType}
                    onValueChange={(v) => {
                      const next = v as CoverType;
                      const nextIp = isIpCover(next);
                      patch({
                        coverType: next,
                        coverAmount: nextIp ? undefined : (cover.coverAmount ?? 0),
                        monthlyBenefit: nextIp ? (cover.monthlyBenefit ?? 0) : undefined,
                        waitingPeriod: nextIp ? cover.waitingPeriod : undefined,
                        benefitPeriod: nextIp ? cover.benefitPeriod : undefined,
                        definition: next === 'TPD' ? cover.definition : undefined,
                        structure: next === 'TPD' ? cover.structure : undefined,
                      });
                    }}
                    disabled={isLocked}
                    options={COVER_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </Field>
                <Field label="Insurer" error={form.errors[`covers.${index}.insurer`]}>
                  <Input
                    type="text"
                    value={cover.insurer ?? ''}
                    onChange={(e) =>
                      patch({ insurer: e.target.value === '' ? undefined : e.target.value })
                    }
                    disabled={isLocked}
                  />
                </Field>
                <Field label="Payee" error={form.errors[`covers.${index}.payee`]}>
                  <Select
                    value={cover.payee ?? undefined}
                    onValueChange={(v) =>
                      patch({ payee: (v ?? undefined) as InsuranceCover['payee'] })
                    }
                    disabled={isLocked}
                    clearable
                    options={PAYEE_OPTIONS}
                  />
                </Field>
              </Grid>

              {ip ? (
                <Grid cols={3} gap={4}>
                  <Field
                    label="Monthly benefit (AUD)"
                    error={form.errors[`covers.${index}.monthlyBenefit`]}
                  >
                    <Input
                      type="number"
                      min={0}
                      step={50}
                      value={cover.monthlyBenefit ?? ''}
                      onChange={(e) =>
                        patch({
                          monthlyBenefit:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      disabled={isLocked}
                    />
                  </Field>
                  <Field
                    label="Waiting period"
                    help='e.g. "30 days"'
                    error={form.errors[`covers.${index}.waitingPeriod`]}
                  >
                    <Input
                      type="text"
                      value={cover.waitingPeriod ?? ''}
                      onChange={(e) =>
                        patch({
                          waitingPeriod: e.target.value === '' ? undefined : e.target.value,
                        })
                      }
                      disabled={isLocked}
                    />
                  </Field>
                  <Field
                    label="Benefit period"
                    help='e.g. "2 years" or "to age 65"'
                    error={form.errors[`covers.${index}.benefitPeriod`]}
                  >
                    <Input
                      type="text"
                      value={cover.benefitPeriod ?? ''}
                      onChange={(e) =>
                        patch({
                          benefitPeriod: e.target.value === '' ? undefined : e.target.value,
                        })
                      }
                      disabled={isLocked}
                    />
                  </Field>
                </Grid>
              ) : (
                <Grid cols={2} gap={4}>
                  <Field
                    label="Cover amount (AUD)"
                    error={form.errors[`covers.${index}.coverAmount`]}
                  >
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={cover.coverAmount ?? 0}
                      onChange={(e) =>
                        patch({
                          coverAmount: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                      disabled={isLocked}
                    />
                  </Field>
                </Grid>
              )}

              {cover.coverType === 'TPD' ? (
                <Grid cols={2} gap={4}>
                  <Field label="TPD definition" error={form.errors[`covers.${index}.definition`]}>
                    <Select
                      value={cover.definition ?? undefined}
                      onValueChange={(v) =>
                        patch({ definition: (v ?? undefined) as InsuranceCover['definition'] })
                      }
                      disabled={isLocked}
                      clearable
                      options={TPD_DEFINITION_OPTIONS}
                    />
                  </Field>
                  <Field label="TPD structure" error={form.errors[`covers.${index}.structure`]}>
                    <Select
                      value={cover.structure ?? undefined}
                      onValueChange={(v) =>
                        patch({ structure: (v ?? undefined) as InsuranceCover['structure'] })
                      }
                      disabled={isLocked}
                      clearable
                      options={TPD_STRUCTURE_OPTIONS}
                    />
                  </Field>
                </Grid>
              ) : null}

              <h4 data-fact-find-subheading>Premium</h4>
              <Grid cols={3} gap={4}>
                <Field label="Premium amount" error={form.errors[`covers.${index}.premium`]}>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={cover.premium ?? ''}
                    onChange={(e) =>
                      patch({
                        premium: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    disabled={isLocked}
                  />
                </Field>
                <Field
                  label="Premium frequency"
                  error={form.errors[`covers.${index}.premiumFrequency`]}
                >
                  <Select
                    value={cover.premiumFrequency ?? undefined}
                    onValueChange={(v) =>
                      patch({
                        premiumFrequency: (v ?? undefined) as Frequency | undefined,
                      })
                    }
                    disabled={isLocked}
                    clearable
                    options={FREQUENCIES.map((f) => ({ value: f, label: f }))}
                  />
                </Field>
                <Field label="Annual premium (derived)">
                  <Input type="number" value={cover.annualPremium ?? ''} disabled readOnly />
                </Field>
              </Grid>
              <Grid cols={2} gap={4}>
                <Field label="Premium type" error={form.errors[`covers.${index}.premiumType`]}>
                  <Select
                    value={cover.premiumType ?? undefined}
                    onValueChange={(v) =>
                      patch({
                        premiumType: (v ?? undefined) as InsuranceCover['premiumType'],
                      })
                    }
                    disabled={isLocked}
                    clearable
                    options={PREMIUM_TYPE_OPTIONS}
                  />
                </Field>
                <Field label="Medically underwritten">
                  <YesNoSelect
                    value={cover.medicallyUnderwritten ?? undefined}
                    onChange={(v) => patch({ medicallyUnderwritten: v })}
                    disabled={isLocked}
                  />
                </Field>
              </Grid>
            </Stack>
          );
        }}
      />

      <SaveBar form={form} />
    </Stack>
  );
}
