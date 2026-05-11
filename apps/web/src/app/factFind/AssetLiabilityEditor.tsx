import type { ReactElement } from 'react';
import type { ZodType, ZodTypeDef } from 'zod';

import type { AssetItem, Frequency } from '@advicelink/schemas';
import { Cluster, Grid, Input, Select, Stack, YesNoSelect } from '@advicelink/ui';

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
    <Stack as="section" gap={6}>
      <h2>{heading}</h2>
      <p data-fact-find-description>{description}</p>

      <ItemList
        label={itemListLabel}
        items={form.draft.items}
        onChange={setItems}
        makeNew={makeNew}
        max={rowMax}
        disabled={isLocked}
        emptyHint="No items yet."
        summary={
          <Cluster gap={6} data-fact-find-totals>
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
          </Cluster>
        }
        renderRow={(item, index, patch) => {
          const hasLoan = (item.amountOwing ?? 0) > 0;
          return (
            <Stack gap={3}>
              <Grid cols={3} gap={4}>
                <Field label="Name" error={form.errors[`items.${index}.name`]}>
                  <Input
                    type="text"
                    value={item.name ?? ''}
                    onChange={(e) =>
                      patch({ name: e.target.value === '' ? undefined : e.target.value })
                    }
                    disabled={isLocked}
                  />
                </Field>
                <Field label="Asset value (AUD)" error={form.errors[`items.${index}.assetValue`]}>
                  <Input
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
                  <Input
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
              </Grid>
              <Grid cols={3} gap={4}>
                <Field label="Principal place of residence">
                  <YesNoSelect
                    value={item.isPpor}
                    onChange={(v) => patch({ isPpor: v ?? false })}
                    disabled={isLocked}
                    clearable={false}
                  />
                </Field>
              </Grid>

              {hasLoan ? (
                <>
                  <Grid cols={3} gap={4}>
                    <Field label="Lender" error={form.errors[`items.${index}.lender`]}>
                      <Input
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
                      <Input
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
                      <Input
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
                  </Grid>
                  <Grid cols={3} gap={4}>
                    <Field
                      label="Repayment amount"
                      error={form.errors[`items.${index}.repaymentAmount`]}
                    >
                      <Input
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
                      <Select
                        value={item.repaymentFrequency ?? undefined}
                        onValueChange={(v) =>
                          patch({
                            repaymentFrequency: (v ?? undefined) as Frequency | undefined,
                          })
                        }
                        disabled={isLocked}
                        clearable
                        options={FREQUENCIES.map((f) => ({ value: f, label: f }))}
                      />
                    </Field>
                    <Field label="Loan start date" error={form.errors[`items.${index}.startDate`]}>
                      <Input
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
                  </Grid>
                </>
              ) : null}
            </Stack>
          );
        }}
      />

      <SaveBar form={form} />
    </Stack>
  );
}
