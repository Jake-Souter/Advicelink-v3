import type { ReactElement, ReactNode } from 'react';

import { Field as UiField } from '@advicelink/ui';

/**
 * Local `Field` shim — preserves the old API (label/help/error/required
 * /children) every Fact Find editor uses, and forwards to the
 * shadcn-backed `Field` semantic in `@advicelink/ui`. Once every editor
 * imports the new component directly we can delete this file; for now
 * keeping the shim lets the WP-6.5 editors carry on rendering with the
 * new visuals without each one having to be touched.
 *
 * The shadcn Field handles its own label, error, and description
 * styling — we just translate the legacy `help` prop to the semantic
 * `help` slot and `error` to `error`.
 */
export interface FieldProps {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, help, error, required, children }: FieldProps): ReactElement {
  return (
    <UiField label={label} help={help} error={error} required={required}>
      {children}
    </UiField>
  );
}
