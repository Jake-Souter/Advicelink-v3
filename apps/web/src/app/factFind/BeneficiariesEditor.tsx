import { useMemo, type ReactElement } from 'react';

import { beneficiariesSchema, type BeneficiaryItem, type Beneficiaries } from '@advicelink/schemas';
import { Cluster, Grid, Input, Select, Stack, StatusBadge } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { ItemList } from '../forms/ItemList';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Beneficiaries editor (REBUILD_PLAN §7.5.8).
 *
 * Beneficiaries are nominated against a fund or policy. The schema
 * accepts < 100% sums during edit (the user might be mid-rebalance
 * between two beneficiaries) but the lock-fact-find check will
 * insist on == 100% per fund. The editor surfaces a per-fund total
 * chip so the adviser can see the gap immediately.
 */

const BINDING_TYPE_OPTIONS: ReadonlyArray<{
  value: NonNullable<BeneficiaryItem['bindingType']>;
  label: string;
}> = [
  { value: 'Binding', label: 'Binding' },
  { value: 'Non-binding', label: 'Non-binding' },
];

const LAPSING_TYPE_OPTIONS: ReadonlyArray<{
  value: NonNullable<BeneficiaryItem['lapsingType']>;
  label: string;
}> = [
  { value: 'Lapsing', label: 'Lapsing' },
  { value: 'Non-lapsing', label: 'Non-lapsing' },
];

export interface BeneficiariesEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: Beneficiaries) => Promise<unknown>;
  isLocked: boolean;
}

export function BeneficiariesEditor({
  serverValue,
  onSaveServer,
  isLocked,
}: BeneficiariesEditorProps): ReactElement {
  const form = useDraftSection<Beneficiaries>({
    schema: beneficiariesSchema,
    serverValue,
    onSave: onSaveServer,
  });

  function setItems(next: BeneficiaryItem[]): void {
    form.setDraft((prev: Beneficiaries) => ({ ...prev, items: next }));
  }

  function makeNew(): BeneficiaryItem {
    return {
      id: crypto.randomUUID(),
      fundOrPolicy: '',
      percentage: 0,
    };
  }

  // Per-fund/policy percentage totals for the summary row.
  const totalsByFund = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of form.draft.items) {
      const key = item.fundOrPolicy.trim() || '(unspecified)';
      map.set(key, (map.get(key) ?? 0) + item.percentage);
    }
    return map;
  }, [form.draft.items]);

  return (
    <Stack as="section" gap={6}>
      <h2>Beneficiaries</h2>
      <p data-fact-find-description>
        Nominees per fund or policy. Per-fund allocations must sum to 100% before the Fact Find can
        be locked.
      </p>

      <ItemList
        label="Beneficiary nominations"
        items={form.draft.items}
        onChange={setItems}
        makeNew={makeNew}
        max={50}
        disabled={isLocked}
        emptyHint="No beneficiaries captured yet."
        summary={
          totalsByFund.size === 0 ? null : (
            <Cluster gap={3} data-fact-find-totals>
              {[...totalsByFund.entries()].map(([fund, total]) => (
                <Cluster key={fund} gap={2}>
                  <span>{fund}:</span>
                  <StatusBadge tone={total === 100 ? 'success' : 'warning'}>
                    {total.toFixed(2)}%
                  </StatusBadge>
                </Cluster>
              ))}
            </Cluster>
          )
        }
        renderRow={(item, index, patch) => (
          <Stack gap={3}>
            <Grid cols={2} gap={4}>
              <Field
                label="Fund or policy"
                required
                error={form.errors[`items.${index}.fundOrPolicy`]}
              >
                <Input
                  type="text"
                  value={item.fundOrPolicy}
                  onChange={(e) => patch({ fundOrPolicy: e.target.value })}
                  disabled={isLocked}
                />
              </Field>
              <Field
                label="Percentage (0–100)"
                required
                error={form.errors[`items.${index}.percentage`]}
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={item.percentage}
                  onChange={(e) =>
                    patch({ percentage: e.target.value === '' ? 0 : Number(e.target.value) })
                  }
                  disabled={isLocked}
                />
              </Field>
            </Grid>
            <Grid cols={3} gap={4}>
              <Field label="First name" error={form.errors[`items.${index}.firstName`]}>
                <Input
                  type="text"
                  value={item.firstName ?? ''}
                  onChange={(e) =>
                    patch({ firstName: e.target.value === '' ? undefined : e.target.value })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field label="Middle name" error={form.errors[`items.${index}.middleName`]}>
                <Input
                  type="text"
                  value={item.middleName ?? ''}
                  onChange={(e) =>
                    patch({ middleName: e.target.value === '' ? undefined : e.target.value })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field label="Surname" error={form.errors[`items.${index}.surname`]}>
                <Input
                  type="text"
                  value={item.surname ?? ''}
                  onChange={(e) =>
                    patch({ surname: e.target.value === '' ? undefined : e.target.value })
                  }
                  disabled={isLocked}
                />
              </Field>
            </Grid>
            <Grid cols={3} gap={4}>
              <Field label="Date of birth" error={form.errors[`items.${index}.dateOfBirth`]}>
                <Input
                  type="date"
                  value={item.dateOfBirth ?? ''}
                  onChange={(e) =>
                    patch({
                      dateOfBirth: e.target.value === '' ? undefined : e.target.value,
                    })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field label="Binding type" error={form.errors[`items.${index}.bindingType`]}>
                <Select
                  value={item.bindingType ?? undefined}
                  onValueChange={(v) =>
                    patch({ bindingType: (v ?? undefined) as BeneficiaryItem['bindingType'] })
                  }
                  disabled={isLocked}
                  clearable
                  options={BINDING_TYPE_OPTIONS}
                />
              </Field>
              <Field label="Lapsing type" error={form.errors[`items.${index}.lapsingType`]}>
                <Select
                  value={item.lapsingType ?? undefined}
                  onValueChange={(v) =>
                    patch({ lapsingType: (v ?? undefined) as BeneficiaryItem['lapsingType'] })
                  }
                  disabled={isLocked}
                  clearable
                  options={LAPSING_TYPE_OPTIONS}
                />
              </Field>
            </Grid>
          </Stack>
        )}
      />

      <SaveBar form={form} />
    </Stack>
  );
}
