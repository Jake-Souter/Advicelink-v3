import type { ReactElement, ReactNode } from 'react';

import { Button, Cluster, EmptyState, Stack, StatusBadge } from '@advicelink/ui';

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
 *
 * The chrome is built from the Layer-4 semantics + Layer-1 layout
 * primitives in `@advicelink/ui` — no raw Tailwind utilities, no
 * `[data-button]` / `[data-chip]` legacy markup. The list itself
 * uses an ordinary `<ul>` with row `<li>`s so screen readers still
 * announce a list; the visual chrome (border, hover, remove button)
 * is owned by `[data-fact-find-row]` rules in `tokens.css`.
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
    <Stack gap={3} data-fact-find-list>
      <Cluster justify="between" gap={2}>
        <h3 data-fact-find-list-label>{label}</h3>
        <StatusBadge tone="neutral">
          {items.length}
          {typeof max === 'number' ? ` / ${max}` : ''}
        </StatusBadge>
      </Cluster>

      {items.length === 0 ? (
        <EmptyState title={emptyHint ?? 'No items yet.'} />
      ) : (
        <Stack as="ul" gap={3}>
          {items.map((item, index) => (
            <li key={item.id} data-fact-find-row>
              <Stack gap={3}>
                {renderRow(item, index, (next) => patchRow(index, next))}
                {!disabled ? (
                  <Cluster justify="end">
                    <Button type="button" tone="ghost" onClick={() => removeRow(index)}>
                      Remove
                    </Button>
                  </Cluster>
                ) : null}
              </Stack>
            </li>
          ))}
        </Stack>
      )}

      {summary}

      {!disabled ? (
        <Cluster>
          <Button type="button" tone="secondary" onClick={addRow} disabled={atCap}>
            {atCap ? `Maximum ${max} reached` : '+ Add'}
          </Button>
        </Cluster>
      ) : null}
    </Stack>
  );
}
