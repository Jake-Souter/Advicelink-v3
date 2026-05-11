import type { ReactElement, ReactNode } from 'react';

/**
 * `Field` — atomic labelled form-field shell. Pairs a label, an
 * optional help string, an optional error message, and the actual
 * input element. The input markup is supplied by the caller so the
 * component stays at Atom level (REBUILD_PLAN §11.6.3 Layer 2):
 * higher layers compose `Field` with the right input type per use.
 *
 * Why an atom and not a Molecule?
 *   - The Fact Find UI has dozens of label-input pairs; a single
 *     reusable shell with `data-form-field` styling means a route
 *     file never reproduces the wiring.
 *   - We don't bind to `useId` here; the caller passes a stable id
 *     when accessibility wiring matters (most pages use the input
 *     name as the id).
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
    <div data-form-field>
      <label>
        {label}
        {required ? ' *' : null}
      </label>
      {children}
      {help ? <span data-help>{help}</span> : null}
      {error ? <span data-error>{error}</span> : null}
    </div>
  );
}
