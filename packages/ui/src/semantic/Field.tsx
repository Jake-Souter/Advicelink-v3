import * as React from 'react';

import {
  Field as ShadcnField,
  FieldDescription,
  FieldError,
  FieldGroup as ShadcnFieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet as ShadcnFieldSet,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * Layer-4 form field. Wraps shadcn `Field` + `FieldLabel` +
 * `FieldDescription` + `FieldError` behind a flat-prop API so feature
 * pages can declare a labelled control in one element:
 *
 *   <Field label="First name" required>
 *     <Input value={...} onChange={...} />
 *   </Field>
 *
 * Validation follows the shadcn skill rule: `data-invalid` is set on
 * the Field when an `error` prop is supplied, and the rendered control
 * also gets `aria-invalid` automatically via the `data-invalid` style.
 */

export interface FieldProps {
  label?: React.ReactNode;
  /** Optional id forwarded to the label `htmlFor`. Auto-generated if omitted. */
  htmlFor?: string;
  /** Help text displayed under the control. Suppressed when `error` is set. */
  help?: React.ReactNode;
  /** Validation message — renders below the control in destructive tone. */
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  help,
  error,
  required,
  className,
  children,
}: FieldProps): React.ReactElement {
  const fallbackId = React.useId();
  const fieldId = htmlFor ?? fallbackId;
  const child = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{ id?: string; 'aria-invalid'?: boolean }>,
        {
          id: (children as React.ReactElement<{ id?: string }>).props.id ?? fieldId,
          'aria-invalid':
            error != null
              ? true
              : (children as React.ReactElement<{ 'aria-invalid'?: boolean }>).props[
                  'aria-invalid'
                ],
        },
      )
    : children;
  return (
    <ShadcnField className={className} data-invalid={error != null ? true : undefined}>
      {label != null ? (
        <FieldLabel htmlFor={fieldId}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </FieldLabel>
      ) : null}
      {child}
      {error != null ? (
        <FieldError>{error}</FieldError>
      ) : help != null ? (
        <FieldDescription>{help}</FieldDescription>
      ) : null}
    </ShadcnField>
  );
}

/**
 * Wrap multiple `<Field>`s. Required by the shadcn skill rule —
 * forms never use a raw `div` with `space-y-*` for layout.
 */
export function FieldGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return <ShadcnFieldGroup className={className}>{children}</ShadcnFieldGroup>;
}

/**
 * Group related controls under a legend (e.g. "Personal details",
 * "Address"). Wraps shadcn `FieldSet` + `FieldLegend`.
 */
export function FieldSet({
  legend,
  description,
  className,
  children,
}: {
  legend?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ShadcnFieldSet className={cn(className)}>
      {legend != null ? <FieldLegend>{legend}</FieldLegend> : null}
      {description != null ? <FieldDescription>{description}</FieldDescription> : null}
      {children}
    </ShadcnFieldSet>
  );
}
