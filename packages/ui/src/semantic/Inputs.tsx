import * as React from 'react';

import { Input as ShadcnInput } from '@/components/ui/input';
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea as ShadcnTextarea } from '@/components/ui/textarea';

/*
 * Layer-4 form control wrappers. Pages compose these instead of the
 * raw shadcn atoms — the wrappers establish our preferred defaults
 * (full width, controlled value/onChange/onValueChange) and keep the
 * `<Select>` compound API behind a flat `options` prop so the Clients
 * "destination firm" dropdown and similar simple selects don't pull
 * the entire shadcn group/item tree into a route file.
 */

export interface InputProps extends React.ComponentProps<typeof ShadcnInput> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return <ShadcnInput ref={ref} {...props} />;
});

export interface TextareaProps extends React.ComponentProps<typeof ShadcnTextarea> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(props, ref) {
    return <ShadcnTextarea ref={ref} {...props} />;
  },
);

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  /**
   * Current value. `undefined` (or empty string) renders the placeholder.
   * Pass `clearable` if the user must be able to return to "unset" once
   * they've picked something — the wrapper renders a "—" entry that
   * resolves back to `undefined` when chosen.
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
  /** Add a leading "—" entry that clears the selection. */
  clearable?: boolean;
  /** Custom label for the clear entry. Defaults to "—". */
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  /** Forwarded to the underlying trigger so callers can wire `aria-invalid`. */
  'aria-invalid'?: boolean;
  className?: string;
}

const CLEAR_SENTINEL = '__advicelink_clear__';

export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  clearable = false,
  clearLabel = '—',
  disabled,
  id,
  name,
  className,
  ...rest
}: SelectProps): React.ReactElement {
  const handleChange = (next: string): void => {
    if (next === CLEAR_SENTINEL) {
      onValueChange?.(undefined);
      return;
    }
    onValueChange?.(next);
  };
  // shadcn Select doesn't accept '' as a value; surface undefined for both.
  const normalised = value === '' ? undefined : value;
  return (
    <ShadcnSelect
      value={normalised}
      defaultValue={defaultValue}
      onValueChange={handleChange}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} className={className} aria-invalid={rest['aria-invalid']}>
        <SelectValue placeholder={placeholder ?? '—'} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {clearable ? <SelectItem value={CLEAR_SENTINEL}>{clearLabel}</SelectItem> : null}
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </ShadcnSelect>
  );
}

/**
 * Tristate Yes / No / unset selector. Wraps `Select` with the
 * boolean-or-undefined shape every Fact Find editor uses for
 * disclosure-style questions ("Has a current will", "Works with
 * hazardous materials"). Pass `clearable={false}` if the value is
 * required and you want to suppress the leading "—" entry.
 */
export interface YesNoSelectProps {
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
  disabled?: boolean;
  clearable?: boolean;
  /** Override the displayed labels (e.g. "True" / "False"). */
  yesLabel?: string;
  noLabel?: string;
  id?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

export function YesNoSelect({
  value,
  onChange,
  disabled,
  clearable = true,
  yesLabel = 'Yes',
  noLabel = 'No',
  id,
  className,
  ...rest
}: YesNoSelectProps): React.ReactElement {
  return (
    <Select
      id={id}
      className={className}
      aria-invalid={rest['aria-invalid']}
      value={value === undefined ? undefined : value ? 'yes' : 'no'}
      onValueChange={(next) => {
        if (next === undefined) {
          onChange(undefined);
        } else {
          onChange(next === 'yes');
        }
      }}
      clearable={clearable}
      disabled={disabled}
      options={[
        { value: 'yes', label: yesLabel },
        { value: 'no', label: noLabel },
      ]}
    />
  );
}
