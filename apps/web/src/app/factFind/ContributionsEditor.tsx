import type { ReactElement } from 'react';

import {
  contributionsSchema,
  type ContributionItem,
  type ContributionType,
  type Contributions,
  type Frequency,
  type Superannuation,
} from '@advicelink/schemas';

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

  return (
    <section>
      <h2>Contributions</h2>
      <p style={{ color: 'var(--text-tertiary, #98A2B3)' }}>
        Super Guarantee destination + any additional contributions.
      </p>

      <h3 style={{ marginTop: '1rem' }}>Super Guarantee (SG)</h3>
      <div data-row-grid="3">
        <Field label="SG total (annual, derived)">
          <input type="number" value={form.draft.totalSgAnnual ?? 0} disabled readOnly />
        </Field>
        <Field label="SG destination fund" error={form.errors['sgDestination']}>
          <select
            value={form.draft.sgDestination ?? ''}
            onChange={(e) =>
              patch('sgDestination', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked || funds.length === 0}
          >
            <option value="">{funds.length === 0 ? 'Add a super fund first' : '—'}</option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.fundName ?? '(unnamed fund)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="SG frequency" error={form.errors['sgFrequency']}>
          <select
            value={form.draft.sgFrequency ?? ''}
            onChange={(e) =>
              patch(
                'sgFrequency',
                e.target.value === '' ? undefined : (e.target.value as Frequency),
              )
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
      </div>
      <div data-row-grid style={{ marginTop: '0.5rem' }}>
        <Field label="SG last received" error={form.errors['sgLastReceived']}>
          <input
            type="date"
            value={form.draft.sgLastReceived ?? ''}
            onChange={(e) =>
              patch('sgLastReceived', e.target.value === '' ? undefined : e.target.value)
            }
            disabled={isLocked}
          />
        </Field>
      </div>

      <ItemList
        label="Additional contributions"
        items={form.draft.items}
        onChange={setItems}
        makeNew={makeNewItem}
        max={20}
        disabled={isLocked}
        emptyHint="No additional contributions captured."
        summary={
          <div data-totals>
            <span>
              Concessional total:{' '}
              <strong>${(form.draft.totalConcessional ?? 0).toLocaleString()}</strong>
            </span>
            <span>
              Non-concessional total:{' '}
              <strong>${(form.draft.totalNonConcessional ?? 0).toLocaleString()}</strong>
            </span>
          </div>
        }
        renderRow={(item, index, rowPatch) => (
          <>
            <div data-row-grid="3">
              <Field label="Type" error={form.errors[`items.${index}.type`]}>
                <select
                  value={item.type}
                  onChange={(e) => {
                    const type = e.target.value as ContributionType;
                    rowPatch({
                      type,
                      noiSubmitted: type === 'Personal Concessional' ? item.noiSubmitted : false,
                    });
                  }}
                  disabled={isLocked}
                >
                  {CONTRIBUTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount (AUD)" error={form.errors[`items.${index}.amount`]}>
                <input
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
                <select
                  value={item.frequency}
                  onChange={(e) => rowPatch({ frequency: e.target.value as Frequency })}
                  disabled={isLocked}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div data-row-grid="3" style={{ marginTop: '0.5rem' }}>
              <Field label="Destination fund" error={form.errors[`items.${index}.destination`]}>
                <select
                  value={item.destination ?? ''}
                  onChange={(e) =>
                    rowPatch({
                      destination: e.target.value === '' ? undefined : e.target.value,
                    })
                  }
                  disabled={isLocked || funds.length === 0}
                >
                  <option value="">{funds.length === 0 ? 'Add a super fund first' : '—'}</option>
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fundName ?? '(unnamed fund)'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Last received" error={form.errors[`items.${index}.lastReceived`]}>
                <input
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
                  <select
                    value={item.noiSubmitted ? 'yes' : 'no'}
                    onChange={(e) => rowPatch({ noiSubmitted: e.target.value === 'yes' })}
                    disabled={isLocked}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              ) : null}
            </div>
          </>
        )}
      />

      <SaveBar form={form} />
    </section>
  );
}
