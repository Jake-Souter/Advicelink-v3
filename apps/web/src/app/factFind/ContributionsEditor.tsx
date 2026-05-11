import type { ReactElement } from 'react';

import {
  contributionsSchema,
  type ContributionItem,
  type ContributionType,
  type Contributions,
  type Frequency,
  type Superannuation,
} from '@advicelink/schemas';
import { Cluster, Grid, Input, Select, Stack, YesNoSelect } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { ItemList } from '../forms/ItemList';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Contributions editor (REBUILD_PLAN §7.5.6).
 *
 * Top of the section: Super-Guarantee landing details (destination
 * fund, frequency, last received). The SG dollar total is mirrored
 * from `financial.totalSgAnnual` server-side and shown read-only.
 *
 * Below: a repeating list of additional contributions. NOI (notice
 * of intent) is a `Personal Concessional`-only flag — the schema's
 * `superRefine` rejects setting it on other types.
 */

const CONTRIBUTION_TYPES: readonly ContributionType[] = [
  'Salary Sacrifice',
  'Personal Concessional',
  'Non-concessional',
  'Spouse',
  'Government Co-contribution',
];

const FREQUENCIES: readonly Frequency[] = [
  'Weekly',
  'Fortnightly',
  'Monthly',
  'Quarterly',
  'Annual',
];

export interface ContributionsEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: Contributions) => Promise<unknown>;
  isLocked: boolean;
  /** Used to render the destination dropdown by fund name. */
  superannuation: Superannuation | undefined;
}

export function ContributionsEditor({
  serverValue,
  onSaveServer,
  isLocked,
  superannuation,
}: ContributionsEditorProps): ReactElement {
  const form = useDraftSection<Contributions>({
    schema: contributionsSchema,
    serverValue,
    onSave: onSaveServer,
  });

  function patch<K extends keyof Contributions>(key: K, value: Contributions[K]): void {
    form.setDraft((prev: Contributions) => ({ ...prev, [key]: value }));
  }
  function setItems(next: ContributionItem[]): void {
    form.setDraft((prev: Contributions) => ({ ...prev, items: next }));
  }
  function makeNewItem(): ContributionItem {
    return {
      id: crypto.randomUUID(),
      type: 'Salary Sacrifice',
      amount: 0,
      frequency: 'Monthly',
      noiSubmitted: false,
    };
  }

  const funds = superannuation?.currentFunds ?? [];
  const fundOptions = funds.map((f) => ({
    value: f.id,
    label: f.fundName ?? '(unnamed fund)',
  }));

  return (
    <Stack as="section" gap={6}>
      <h2>Contributions</h2>
      <p data-fact-find-description>Super Guarantee destination + any additional contributions.</p>

      <h3>Super Guarantee (SG)</h3>
      <Grid cols={3} gap={4}>
        <Field label="SG total (annual, derived)">
          <Input type="number" value={form.draft.totalSgAnnual ?? 0} disabled readOnly />
        </Field>
        <Field label="SG destination fund" error={form.errors['sgDestination']}>
          <Select
            value={form.draft.sgDestination ?? undefined}
            onValueChange={(v) => patch('sgDestination', v)}
            disabled={isLocked || funds.length === 0}
            clearable
            placeholder={funds.length === 0 ? 'Add a super fund first' : '—'}
            options={fundOptions}
          />
        </Field>
        <Field label="SG frequency" error={form.errors['sgFrequency']}>
          <Select
            value={form.draft.sgFrequency ?? undefined}
            onValueChange={(v) => patch('sgFrequency', (v ?? undefined) as Frequency | undefined)}
            disabled={isLocked}
            clearable
            options={FREQUENCIES.map((f) => ({ value: f, label: f }))}
          />
        </Field>
      </Grid>
      <Grid cols={2} gap={4}>
        <Field label="SG last received" error={form.errors['sgLastReceived']}>
          <Input
            type="date"
            value={form.draft.sgLastReceived ?? ''}
            onChange={(e) =>
              patch('sgLastReceived', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <ItemList
        label="Additional contributions"
        items={form.draft.items}
        onChange={setItems}
        makeNew={makeNewItem}
        max={20}
        disabled={isLocked}
        emptyHint="No additional contributions captured."
        summary={
          <Cluster gap={6} data-fact-find-totals>
            <span>
              Concessional total:{' '}
              <strong>${(form.draft.totalConcessional ?? 0).toLocaleString()}</strong>
            </span>
            <span>
              Non-concessional total:{' '}
              <strong>${(form.draft.totalNonConcessional ?? 0).toLocaleString()}</strong>
            </span>
          </Cluster>
        }
        renderRow={(item, index, rowPatch) => (
          <Stack gap={3}>
            <Grid cols={3} gap={4}>
              <Field label="Type" error={form.errors[`items.${index}.type`]}>
                <Select
                  value={item.type}
                  onValueChange={(v) => {
                    const type = v as ContributionType;
                    rowPatch({
                      type,
                      noiSubmitted: type === 'Personal Concessional' ? item.noiSubmitted : false,
                    });
                  }}
                  disabled={isLocked}
                  options={CONTRIBUTION_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </Field>
              <Field label="Amount (AUD)" error={form.errors[`items.${index}.amount`]}>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={item.amount}
                  onChange={(e) =>
                    rowPatch({ amount: e.target.value === '' ? 0 : Number(e.target.value) })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field label="Frequency" error={form.errors[`items.${index}.frequency`]}>
                <Select
                  value={item.frequency}
                  onValueChange={(v) => rowPatch({ frequency: v as Frequency })}
                  disabled={isLocked}
                  options={FREQUENCIES.map((f) => ({ value: f, label: f }))}
                />
              </Field>
            </Grid>
            <Grid cols={3} gap={4}>
              <Field label="Destination fund" error={form.errors[`items.${index}.destination`]}>
                <Select
                  value={item.destination ?? undefined}
                  onValueChange={(v) => rowPatch({ destination: v })}
                  disabled={isLocked || funds.length === 0}
                  clearable
                  placeholder={funds.length === 0 ? 'Add a super fund first' : '—'}
                  options={fundOptions}
                />
              </Field>
              <Field label="Last received" error={form.errors[`items.${index}.lastReceived`]}>
                <Input
                  type="date"
                  value={item.lastReceived ?? ''}
                  onChange={(e) =>
                    rowPatch({
                      lastReceived: e.target.value === '' ? undefined : e.target.value,
                    })
                  }
                  disabled={isLocked}
                />
              </Field>
              {item.type === 'Personal Concessional' ? (
                <Field
                  label="Notice of intent submitted"
                  error={form.errors[`items.${index}.noiSubmitted`]}
                >
                  <YesNoSelect
                    value={item.noiSubmitted}
                    onChange={(v) => rowPatch({ noiSubmitted: v ?? false })}
                    disabled={isLocked}
                    clearable={false}
                  />
                </Field>
              ) : null}
            </Grid>
          </Stack>
        )}
      />

      <SaveBar form={form} />
    </Stack>
  );
}
