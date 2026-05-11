import * as React from 'react';

import { RadioGroup as ShadcnRadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox as ShadcnCheckbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Layer-4 choice controls. The Fact Find editors and risk-profile
 * questionnaires answer two recurring shapes:
 *
 *   - "pick exactly one of N" → `<RadioGroup options={...} value={...}>`
 *   - "yes / no toggle"      → `<Checkbox label="..." checked={...}>`
 *
 * Wrapping the shadcn atoms here means the questionnaires never
 * touch raw `<RadioGroupPrimitive.Item>` / `<CheckboxPrimitive.Root>`
 * markup and the layout (label-on-the-right, gap, hover affordance)
 * stays consistent across every editor.
 */

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
  options: ReadonlyArray<RadioOption>;
  /** Layout — vertical (default) stacks each option, horizontal lays them inline. */
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  name?: string;
  id?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

export function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  options,
  orientation = 'vertical',
  disabled,
  name,
  id,
  className,
  ...rest
}: RadioGroupProps): React.ReactElement {
  return (
    <ShadcnRadioGroup
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
      id={id}
      aria-invalid={rest['aria-invalid']}
      className={cn(
        orientation === 'horizontal' ? 'grid-flow-col auto-cols-max gap-x-6' : undefined,
        className,
      )}
    >
      {options.map((opt) => {
        const itemId = `${id ?? name ?? 'radio'}-${opt.value}`;
        return (
          <div key={opt.value} className="flex items-start gap-2">
            <RadioGroupItem id={itemId} value={opt.value} disabled={opt.disabled} />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={itemId} className="cursor-pointer leading-none font-normal">
                {opt.label}
              </Label>
              {opt.description != null ? (
                <p className="text-muted-foreground text-xs">{opt.description}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </ShadcnRadioGroup>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
  name,
  className,
  ...rest
}: CheckboxProps): React.ReactElement {
  const reactId = React.useId();
  const checkboxId = id ?? reactId;
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <ShadcnCheckbox
        id={checkboxId}
        name={name}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        aria-invalid={rest['aria-invalid']}
      />
      {label != null || description != null ? (
        <div className="flex flex-col gap-0.5">
          {label != null ? (
            <Label htmlFor={checkboxId} className="cursor-pointer leading-none font-normal">
              {label}
            </Label>
          ) : null}
          {description != null ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
