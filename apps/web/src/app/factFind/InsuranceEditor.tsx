import type { ReactElement } from 'react';

import {
  insuranceSchema,
  isIpCover,
  type CoverType,
  type Frequency,
  type Insurance,
  type InsuranceCover,
} from '@advicelink/schemas';

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
    <section>
      <h2>Insurance</h2>
      <p style={{ color: 'var(--text-tertiary, #98A2B3)' }}>
        One row per cover. Sub-fields adapt to the cover type.
      </p>

      <ItemList
        label="Existing covers"
        items={form.draft.covers}
        onChange={setCovers}
        makeNew={makeNewCover}
        max={30}
        disabled={isLocked}
        emptyHint="No insurance covers captured yet."
        summary={
          <div data-totals>
            <span>
              Inside-super premium (annual):{' '}
              <strong>${(form.draft.totalSuperPremium ?? 0).toLocaleString()}</strong>
            </span>
            <span>
              Personal premium (annual):{' '}
              <strong>${(form.draft.totalPersonalPremium ?? 0).toLocaleString()}</strong>
            </span>
          </div>
        }
        renderRow={(cover, index, patch) => {
          const ip = isIpCover(cover.coverType);
          return (
            <>
              <div data-row-grid="3">
                <Field label="Cover type" error={form.errors[`covers.${index}.coverType`]}>
                  <select
                    value={cover.coverType}
                    onChange={(e) => {
                      const next = e.target.value as CoverType;
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
                  >
                    {COVER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Insurer" error={form.errors[`covers.${index}.insurer`]}>
                  <input
                    type="text"
                    value={cover.insurer ?? ''}
                    onChange={(e) =>
                      patch({ insurer: e.target.value === '' ? undefined : e.target.value })
                    }
                    disabled={isLocked}
                  />
                </Field>
                <Field label="Payee" error={form.errors[`covers.${index}.payee`]}>
                  <select
                    value={cover.payee ?? ''}
                    onChange={(e) =>
                      patch({
                        payee:
                          e.target.value === ''
                            ? undefined
                            : (e.target.value as InsuranceCover['payee']),
                      })
                    }
                    disabled={isLocked}
                  >
                    <option value="">—</option>
                    <option value="Self">Self</option>
                    <option value="Super">Super</option>
                  </select>
                </Field>
              </div>

              {ip ? (
                <div data-row-grid="3" style={{ marginTop: '0.5rem' }}>
                  <Field
                    label="Monthly benefit (AUD)"
                    error={form.errors[`covers.${index}.monthlyBenefit`]}
                  >
                    <input
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
                    <input
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
                    <input
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
                </div>
              ) : (
                <div data-row-grid style={{ marginTop: '0.5rem' }}>
                  <Field
                    label="Cover amount (AUD)"
                    error={form.errors[`covers.${index}.coverAmount`]}
                  >
                    <input
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
                </div>
              )}

              {cover.coverType === 'TPD' ? (
                <div data-row-grid style={{ marginTop: '0.5rem' }}>
                  <Field label="TPD definition" error={form.errors[`covers.${index}.definition`]}>
                    <select
                      value={cover.definition ?? ''}
                      onChange={(e) =>
                        patch({
                          definition:
                            e.target.value === ''
                              ? undefined
                              : (e.target.value as InsuranceCover['definition']),
                        })
                      }
                      disabled={isLocked}
                    >
                      <option value="">—</option>
                      <option value="Any Occ">Any Occ</option>
                      <option value="Own Occ">Own Occ</option>
                    </select>
                  </Field>
                  <Field label="TPD structure" error={form.errors[`covers.${index}.structure`]}>
                    <select
                      value={cover.structure ?? ''}
                      onChange={(e) =>
                        patch({
                          structure:
                            e.target.value === ''
                              ? undefined
                              : (e.target.value as InsuranceCover['structure']),
                        })
                      }
                      disabled={isLocked}
                    >
                      <option value="">—</option>
                      <option value="Standalone">Standalone</option>
                      <option value="Linked">Linked</option>
                    </select>
                  </Field>
                </div>
              ) : null}

              <h4 style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>Premium</h4>
              <div data-row-grid="3">
                <Field label="Premium amount" error={form.errors[`covers.${index}.premium`]}>
                  <input
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
                  <select
                    value={cover.premiumFrequency ?? ''}
                    onChange={(e) =>
                      patch({
                        premiumFrequency:
                          e.target.value === '' ? undefined : (e.target.value as Frequency),
                      })
                    }
                    disabled={isLocked}
                  >
                    <option value="">—</option>
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Annual premium (derived)">
                  <input type="number" value={cover.annualPremium ?? ''} disabled readOnly />
                </Field>
              </div>
              <div data-row-grid="3" style={{ marginTop: '0.5rem' }}>
                <Field label="Premium type" error={form.errors[`covers.${index}.premiumType`]}>
                  <select
                    value={cover.premiumType ?? ''}
                    onChange={(e) =>
                      patch({
                        premiumType:
                          e.target.value === ''
                            ? undefined
                            : (e.target.value as InsuranceCover['premiumType']),
                      })
                    }
                    disabled={isLocked}
                  >
                    <option value="">—</option>
                    <option value="Stepped">Stepped</option>
                    <option value="Level">Level</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </Field>
                <Field label="Medically underwritten">
                  <select
                    value={
                      cover.medicallyUnderwritten == null
                        ? ''
                        : cover.medicallyUnderwritten
                          ? 'yes'
                          : 'no'
                    }
                    onChange={(e) =>
                      patch({
                        medicallyUnderwritten:
                          e.target.value === '' ? undefined : e.target.value === 'yes',
                      })
                    }
                    disabled={isLocked}
                  >
                    <option value="">—</option>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>
            </>
          );
        }}
      />

      <SaveBar form={form} />
    </section>
  );
}
