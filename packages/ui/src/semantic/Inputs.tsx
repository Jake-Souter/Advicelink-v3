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
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  /** Forwarded to the underlying trigger so callers can wire `aria-invalid`. */
  'aria-invalid'?: boolean;
  className?: string;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  disabled,
  id,
  name,
  className,
  ...rest
}: SelectProps): React.ReactElement {
  return (
    <ShadcnSelect
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} className={className} aria-invalid={rest['aria-invalid']}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
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
