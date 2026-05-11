import type { ReactElement } from 'react';
import type { ZodType, ZodTypeDef } from 'zod';

import type { AssetItem, Frequency } from '@advicelink/schemas';

import { Field } from '../forms/Field';
import { ItemList } from '../forms/ItemList';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Editor for the unified Assets and Liabilities section. Every row
 * carries `assetValue`, `amountOwing`, and an optional loan block
 * (REBUILD_PLAN §7.5.4). Standalone debts are captured as rows with
 * `assetValue=0` and `amountOwing>0`.
 *
 * Loan-related fields render conditionally when `amountOwing > 0`
 * — keeps the row compact for unencumbered assets.
 */

const FREQUENCIES: readonly Frequency[] = [
  'Weekly',
  'Fortnightly',
  'Monthly',
  'Quarterly',
  'Annual',
];

interface AssetsLikeShape {
  items: readonly AssetItem[];
  totalAssets?: number;
  totalLiabilities?: number;
}

export interface AssetLiabilityEditorProps<T extends AssetsLikeShape> {
  heading: string;
  description: string;
  schema: ZodType<T, ZodTypeDef, unknown>;
  serverValue: unknown;
  onSaveServer: (parsed: T) => Promise<unknown>;
  isLocked: boolean;
  /** Defaults for a freshly-added row, e.g. { isPpor: false }. */
  newRowDefaults?: Partial<AssetItem>;
  /** Label string passed through unused; kept for API stability with the
   *  dispatcher. */
  totalsLabel?: string;
  itemListLabel: string;
  rowMax?: number;
}

export function AssetLiabilityEditor<T extends AssetsLikeShape>({
  heading,
  description,
  schema,
  serverValue,
  onSaveServer,
  isLocked,
  newRowDefaults,
  itemListLabel,
  rowMax = 50,
}: AssetLiabilityEditorProps<T>): ReactElement {
  const form = useDraftSection<T>({ schema, serverValue, onSave: onSaveServer });

  function setItems(next: AssetItem[]): void {
    form.setDraft((prev: T) => ({ ...prev, items: next }));
  }

  function makeNew(): AssetItem {
    return {
      id: crypto.randomUUID(),
      name: undefined,
      assetValue: 0,
      amountOwing: 0,
      isPpor: false,
      ...newRowDefaults,
    };
  }

  return (
    <section>
      <h2>{heading}</h2>
      <p style={{ color: 'var(--text-tertiary, #98A2B3)' }}>{description}</p>

      <ItemList
        label={itemListLabel}
        items={form.draft.items}
        onChange={setItems}
        makeNew={makeNew}
        max={rowMax}
        disabled={isLocked}
        emptyHint="No items yet."
        summary={
          <div data-totals>
            <span>
              Total assets: <strong>${(form.draft.totalAssets ?? 0).toLocaleString()}</strong>
            </span>
            <span>
              Total liabilities:{' '}
              <strong>${(form.draft.totalLiabilities ?? 0).toLocaleString()}</strong>
            </span>
            <span>
              Net wealth:{' '}
              <strong>
                $
                {(
                  (form.draft.totalAssets ?? 0) - (form.draft.totalLiabilities ?? 0)
                ).toLocaleString()}
              </strong>
            </span>
          </div>
        }
        renderRow={(item, index, patch) => {
          const hasLoan = (item.amountOwing ?? 0) > 0;
          return (
            <>
              <div data-row-grid="3">
                <Field label="Name" error={form.errors[`items.${index}.name`]}>
                  <input
                    type="text"
                    value={item.name ?? ''}
                    onChange={(e) =>
                      patch({ name: e.target.value === '' ? undefined : e.target.value })
                    }
                    disabled={isLocked}
                  />
                </Field>
                <Field label="Asset value (AUD)" error={form.errors[`items.${index}.assetValue`]}>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={item.assetValue}
                    onChange={(e) =>
                      patch({
                        assetValue: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    disabled={isLocked}
                  />
                </Field>
                <Field label="Amount owing (AUD)" error={form.errors[`items.${index}.amountOwing`]}>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={item.amountOwing}
                    onChange={(e) =>
                      patch({
                        amountOwing: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    disabled={isLocked}
                  />
                </Field>
              </div>
              <div data-row-grid="3" style={{ marginTop: '0.5rem' }}>
                <Field label="Principal place of residence">
                  <select
                    value={item.isPpor ? 'yes' : 'no'}
                    onChange={(e) => patch({ isPpor: e.target.value === 'yes' })}
                    disabled={isLocked}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>

              {hasLoan ? (
                <>
                  <div data-row-grid="3" style={{ marginTop: '0.75rem' }}>
                    <Field label="Lender" error={form.errors[`items.${index}.lender`]}>
                      <input
                        type="text"
                        value={item.lender ?? ''}
                        onChange={(e) =>
                          patch({ lender: e.target.value === '' ? undefined : e.target.value })
                        }
                        disabled={isLocked}
                      />
                    </Field>
                    <Field
                      label="Interest rate (%)"
                      error={form.errors[`items.${index}.interestRate`]}
                    >
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={item.interestRate ?? ''}
                        onChange={(e) =>
                          patch({
                            interestRate:
                              e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        disabled={isLocked}
                      />
                    </Field>
                    <Field
                      label="Loan term (years)"
                      error={form.errors[`items.${index}.loanTermYears`]}
                    >
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={item.loanTermYears ?? ''}
                        onChange={(e) =>
                          patch({
                            loanTermYears:
                              e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        disabled={isLocked}
                      />
                    </Field>
                  </div>
                  <div data-row-grid="3" style={{ marginTop: '0.5rem' }}>
                    <Field
                      label="Repayment amount"
                      error={form.errors[`items.${index}.repaymentAmount`]}
                    >
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={item.repaymentAmount ?? ''}
                        onChange={(e) =>
                          patch({
                            repaymentAmount:
                              e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        disabled={isLocked}
                      />
                    </Field>
                    <Field
                      label="Repayment frequency"
                      error={form.errors[`items.${index}.repaymentFrequency`]}
                    >
                      <select
                        value={item.repaymentFrequency ?? ''}
                        onChange={(e) =>
                          patch({
                            repaymentFrequency:
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
                    <Field label="Loan start date" error={form.errors[`items.${index}.startDate`]}>
                      <input
                        type="date"
                        value={item.startDate ?? ''}
                        onChange={(e) =>
                          patch({
                            startDate: e.target.value === '' ? undefined : e.target.value,
                          })
                        }
                        disabled={isLocked}
                      />
                    </Field>
                  </div>
                </>
              ) : null}
            </>
          );
        }}
      />

      <SaveBar form={form} />
    </section>
  );
}
