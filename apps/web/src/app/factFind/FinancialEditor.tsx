import type { ReactElement } from 'react';

import {
  financialSchema,
  type Financial,
  type IncomeItem,
  type IncomeType,
} from '@advicelink/schemas';
import { Cluster, Grid, Input, Select, Stack, YesNoSelect } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { ItemList } from '../forms/ItemList';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Financial / Income editor (REBUILD_PLAN §7.5.3).
 *
 * One row per income source. The `sgEligible` checkbox toggles
 * whether the SG percent / dollars columns apply — Salary and Bonus
 * carry SG by default, contractors and pension income don't.
 *
 * Section-level totals (`totalIncomeAnnual`, `totalSgAnnual`) are
 * derived server-side by `deriveAll` on every save (see
 * `apps/api/src/services/factFind/upsertSection.ts`); this editor
 * deliberately does NOT compute them client-side so the screen and
 * the persisted shape can never disagree.
 */

const INCOME_TYPES: readonly IncomeType[] = [
  'Salary',
  'Bonus',
  'Self-employed',
  'Investment',
  'Pension',
  'Centrelink',
  'Rental',
  'Other',
];

export interface FinancialEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: Financial) => Promise<unknown>;
  isLocked: boolean;
}

export function FinancialEditor({
  serverValue,
  onSaveServer,
  isLocked,
}: FinancialEditorProps): ReactElement {
  const form = useDraftSection<Financial>({
    schema: financialSchema,
    serverValue,
    onSave: onSaveServer,
  });

  function setIncomes(next: IncomeItem[]): void {
    form.setDraft((prev: Financial) => ({ ...prev, incomes: next }));
  }

  function makeNewIncome(): IncomeItem {
    return {
      id: crypto.randomUUID(),
      incomeType: 'Salary',
      grossAnnual: 0,
      sgEligible: true,
      superGuaranteePercent: 12,
    };
  }

  return (
    <Stack as="section" gap={6}>
      <h2>Income</h2>
      <p data-fact-find-description>
        One row per income source. SG fields apply to salary-style income only.
      </p>

      <ItemList
        label="Income sources"
        items={form.draft.incomes}
        onChange={setIncomes}
        makeNew={makeNewIncome}
        max={20}
        disabled={isLocked}
        emptyHint="No income sources yet. Add one to start."
        summary={
          <Cluster gap={6} data-fact-find-totals>
            <span>
              Total income (annual):{' '}
              <strong>${(form.draft.totalIncomeAnnual ?? 0).toLocaleString()}</strong>
            </span>
            <span>
              Total SG (annual):{' '}
              <strong>${(form.draft.totalSgAnnual ?? 0).toLocaleString()}</strong>
            </span>
          </Cluster>
        }
        renderRow={(item, index, patch) => (
          <Stack gap={3}>
            <Grid cols={3} gap={4}>
              <Field label="Type" error={form.errors[`incomes.${index}.incomeType`]}>
                <Select
                  value={item.incomeType}
                  onValueChange={(v) => patch({ incomeType: v as IncomeType })}
                  disabled={isLocked}
                  options={INCOME_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </Field>
              <Field label="Gross annual (AUD)" error={form.errors[`incomes.${index}.grossAnnual`]}>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={item.grossAnnual}
                  onChange={(e) =>
                    patch({ grossAnnual: e.target.value === '' ? 0 : Number(e.target.value) })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field label="SG eligible">
                <YesNoSelect
                  value={item.sgEligible}
                  clearable={false}
                  onChange={(next) => {
                    const isSg = next ?? false;
                    patch({
                      sgEligible: isSg,
                      superGuaranteePercent: isSg ? (item.superGuaranteePercent ?? 12) : undefined,
                      superGuaranteeDollars: isSg ? item.superGuaranteeDollars : undefined,
                    });
                  }}
                  disabled={isLocked}
                />
              </Field>
            </Grid>
            {item.sgEligible ? (
              <Grid cols={2} gap={4}>
                <Field
                  label="SG %"
                  help="Default 12% (FY2025-26)"
                  error={form.errors[`incomes.${index}.superGuaranteePercent`]}
                >
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={item.superGuaranteePercent ?? ''}
                    onChange={(e) =>
                      patch({
                        superGuaranteePercent:
                          e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    disabled={isLocked}
                  />
                </Field>
                <Field label="SG $ (derived)">
                  <Input type="number" value={item.superGuaranteeDollars ?? ''} disabled readOnly />
                </Field>
              </Grid>
            ) : null}
          </Stack>
        )}
      />

      <SaveBar form={form} />
    </Stack>
  );
}
