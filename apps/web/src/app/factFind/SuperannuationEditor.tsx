import type { ReactElement } from 'react';

import { superannuationSchema, type Superannuation, type SuperFund } from '@advicelink/schemas';
import { Grid, Input, Stack, Textarea } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { ItemList } from '../forms/ItemList';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Superannuation editor (REBUILD_PLAN §7.5.5).
 *
 * v3 deliberately keeps only the five fields the live UI captures:
 * fundName, memberNumber, investmentOption, currentBalance, notes.
 * Max 10 funds enforced server-side; the ItemList caps the add
 * button at 10 too.
 */

export interface SuperannuationEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: Superannuation) => Promise<unknown>;
  isLocked: boolean;
}

export function SuperannuationEditor({
  serverValue,
  onSaveServer,
  isLocked,
}: SuperannuationEditorProps): ReactElement {
  const form = useDraftSection<Superannuation>({
    schema: superannuationSchema,
    serverValue,
    onSave: onSaveServer,
  });

  function setFunds(next: SuperFund[]): void {
    form.setDraft((prev: Superannuation) => ({ ...prev, currentFunds: next }));
  }

  function makeNewFund(): SuperFund {
    return { id: crypto.randomUUID(), currentBalance: 0 };
  }

  return (
    <Stack as="section" gap={6}>
      <h2>Superannuation</h2>
      <p data-fact-find-description>
        One row per current fund. Max 10. Richer fund metadata (USI, ABN, fees) is sourced from the
        recommended-portfolio configuration, not this section.
      </p>

      <ItemList
        label="Current super funds"
        items={form.draft.currentFunds}
        onChange={setFunds}
        makeNew={makeNewFund}
        max={10}
        disabled={isLocked}
        emptyHint="No super funds captured yet."
        renderRow={(fund, index, patch) => (
          <Stack gap={3}>
            <Grid cols={3} gap={4}>
              <Field label="Fund name" error={form.errors[`currentFunds.${index}.fundName`]}>
                <Input
                  type="text"
                  value={fund.fundName ?? ''}
                  onChange={(e) =>
                    patch({ fundName: e.target.value === '' ? undefined : e.target.value })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field
                label="Member number"
                error={form.errors[`currentFunds.${index}.memberNumber`]}
              >
                <Input
                  type="text"
                  value={fund.memberNumber ?? ''}
                  onChange={(e) =>
                    patch({
                      memberNumber: e.target.value === '' ? undefined : e.target.value,
                    })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field
                label="Investment option"
                error={form.errors[`currentFunds.${index}.investmentOption`]}
              >
                <Input
                  type="text"
                  value={fund.investmentOption ?? ''}
                  onChange={(e) =>
                    patch({
                      investmentOption: e.target.value === '' ? undefined : e.target.value,
                    })
                  }
                  disabled={isLocked}
                />
              </Field>
            </Grid>
            <Grid cols={2} gap={4}>
              <Field
                label="Current balance (AUD)"
                error={form.errors[`currentFunds.${index}.currentBalance`]}
              >
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={fund.currentBalance}
                  onChange={(e) =>
                    patch({
                      currentBalance: e.target.value === '' ? 0 : Number(e.target.value),
                    })
                  }
                  disabled={isLocked}
                />
              </Field>
            </Grid>
            <Field label="Notes" error={form.errors[`currentFunds.${index}.notes`]}>
              <Textarea
                rows={2}
                value={fund.notes ?? ''}
                onChange={(e) =>
                  patch({ notes: e.target.value === '' ? undefined : e.target.value })
                }
                disabled={isLocked}
              />
            </Field>
          </Stack>
        )}
      />

      <SaveBar form={form} />
    </Stack>
  );
}
