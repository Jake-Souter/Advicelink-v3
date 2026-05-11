import type { ReactElement, ReactNode } from 'react';

/**
 * `ItemList<T>` — repeating-row helper used by every Fact Find
 * section that holds a list of items (incomes, assets, super funds,
 * contributions, insurance covers, beneficiaries, dependants).
 *
 * The component is intentionally dumb: it owns the list chrome
 * (header, add button, per-row remove control, empty state, max
 * cap) and delegates per-row rendering to the caller via `renderRow`.
 * That keeps section-specific schemas, conditional fields, and
 * derivations exactly where they belong — in the per-section editor.
 *
 * Every row needs an `id` field on its row data so React keys are
 * stable across edits; the caller-supplied `makeNew` factory is
 * expected to mint one (`crypto.randomUUID()`).
 */

export interface ItemListProps<T extends { id: string }> {
  label: string;
  items: readonly T[];
  onChange: (next: T[]) => void;
  makeNew: () => T;
  renderRow: (item: T, index: number, patch: (next: Partial<T>) => void) => ReactNode;
  disabled?: boolean;
  /** Hard cap; the schema usually carries the same limit (e.g. 10
   *  super funds, 30 insurance covers). Add button hides at the cap. */
  max?: number;
  /** Copy shown when the list is empty. */
  emptyHint?: string;
  /** Optional summary row rendered above the add button (e.g. totals). */
  summary?: ReactNode;
}

export function ItemList<T extends { id: string }>({
  label,
  items,
  onChange,
  makeNew,
  renderRow,
  disabled,
  max,
  emptyHint,
  summary,
}: ItemListProps<T>): ReactElement {
  const atCap = typeof max === 'number' && items.length >= max;

  function patchRow(index: number, next: Partial<T>): void {
    const updated = items.slice();
    updated[index] = { ...updated[index], ...next } as T;
    onChange(updated);
  }

  function removeRow(index: number): void {
    onChange(items.filter((_, i) => i !== index));
  }

  function addRow(): void {
    if (atCap) return;
    onChange([...items, makeNew()]);
  }

  return (
    <div data-item-list>
      <header data-item-list-header>
        <h3>{label}</h3>
        <span data-chip>
          {items.length}
          {typeof max === 'number' ? ` / ${max}` : ''}
        </span>
      </header>

      {items.length === 0 ? (
        <div data-empty-state>
          <p>{emptyHint ?? 'No items yet.'}</p>
        </div>
      ) : (
        <ul data-item-list-rows>
          {items.map((item, index) => (
            <li key={item.id} data-item-list-row>
              <div data-item-list-row-body>
                {renderRow(item, index, (next) => patchRow(index, next))}
              </div>
              {!disabled ? (
                <button
                  type="button"
                  data-button="ghost"
                  onClick={() => removeRow(index)}
                  data-remove-row
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {summary}

      {!disabled ? (
        <div data-item-list-actions>
          <button type="button" data-button="secondary" onClick={addRow} disabled={atCap}>
            {atCap ? `Maximum ${max} reached` : '+ Add'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
