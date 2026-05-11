import { useMemo, type ReactElement } from 'react';

import { beneficiariesSchema, type BeneficiaryItem, type Beneficiaries } from '@advicelink/schemas';

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
    <section>
      <h2>Beneficiaries</h2>
      <p style={{ color: 'var(--text-tertiary, #98A2B3)' }}>
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
            <div data-totals style={{ flexWrap: 'wrap' }}>
              {[...totalsByFund.entries()].map(([fund, total]) => {
                const tone = total === 100 ? 'accent' : undefined;
                return (
                  <span key={fund}>
                    {fund}:{' '}
                    <strong data-chip data-tone={tone}>
                      {total.toFixed(2)}%
                    </strong>
                  </span>
                );
              })}
            </div>
          )
        }
        renderRow={(item, index, patch) => (
          <>
            <div data-row-grid>
              <Field
                label="Fund or policy"
                required
                error={form.errors[`items.${index}.fundOrPolicy`]}
              >
                <input
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
                <input
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
            </div>
            <div data-row-grid="3" style={{ marginTop: '0.5rem' }}>
              <Field label="First name" error={form.errors[`items.${index}.firstName`]}>
                <input
                  type="text"
                  value={item.firstName ?? ''}
                  onChange={(e) =>
                    patch({ firstName: e.target.value === '' ? undefined : e.target.value })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field label="Middle name" error={form.errors[`items.${index}.middleName`]}>
                <input
                  type="text"
                  value={item.middleName ?? ''}
                  onChange={(e) =>
                    patch({ middleName: e.target.value === '' ? undefined : e.target.value })
                  }
                  disabled={isLocked}
                />
              </Field>
              <Field label="Surname" error={form.errors[`items.${index}.surname`]}>
                <input
                  type="text"
                  value={item.surname ?? ''}
                  onChange={(e) =>
                    patch({ surname: e.target.value === '' ? undefined : e.target.value })
                  }
                  disabled={isLocked}
                />
              </Field>
            </div>
            <div data-row-grid="3" style={{ marginTop: '0.5rem' }}>
              <Field label="Date of birth" error={form.errors[`items.${index}.dateOfBirth`]}>
                <input
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
                <select
                  value={item.bindingType ?? ''}
                  onChange={(e) =>
                    patch({
                      bindingType:
                        e.target.value === ''
                          ? undefined
                          : (e.target.value as BeneficiaryItem['bindingType']),
                    })
                  }
                  disabled={isLocked}
                >
                  <option value="">—</option>
                  <option value="Binding">Binding</option>
                  <option value="Non-binding">Non-binding</option>
                </select>
              </Field>
              <Field label="Lapsing type" error={form.errors[`items.${index}.lapsingType`]}>
                <select
                  value={item.lapsingType ?? ''}
                  onChange={(e) =>
                    patch({
                      lapsingType:
                        e.target.value === ''
                          ? undefined
                          : (e.target.value as BeneficiaryItem['lapsingType']),
                    })
                  }
                  disabled={isLocked}
                >
                  <option value="">—</option>
                  <option value="Lapsing">Lapsing</option>
                  <option value="Non-lapsing">Non-lapsing</option>
                </select>
              </Field>
            </div>
          </>
        )}
      />

      <SaveBar form={form} />
    </section>
  );
}
