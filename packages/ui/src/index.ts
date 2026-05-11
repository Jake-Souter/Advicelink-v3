export * from './tokens/index.js';
export { BrandThemeProvider } from './theme/BrandThemeProvider.js';
export type { BrandThemeProviderProps } from './theme/BrandThemeProvider.js';
export { Box, Stack, Inline, Cluster, Grid, Spacer, VisuallyHidden } from './primitives/layout.js';
export type {
  BoxProps,
  StackProps,
  InlineProps,
  ClusterProps,
  GridProps,
  SpacerProps,
} from './primitives/layout.js';

/*
 * Layer-4 semantic surfaces. These wrap the shadcn-derived Layer-2 atoms
 * (in `./components/ui/`) and are the only sidebar/breadcrumb entry-points
 * apps should import — see `.cursor/rules/design-system.mdc` for the
 * layering rule.
 */
export { AppShell } from './semantic/AppShell.js';
export type {
  AppShellProps,
  AppShellBrand,
  AppShellUser,
  AppShellNavGroup,
  AppShellNavItem,
  AppShellNavSubItem,
  AppShellLinkComponent,
  AppShellLinkProps,
} from './semantic/AppShell.js';
export { Breadcrumbs } from './semantic/Breadcrumbs.js';
export type { BreadcrumbsProps, BreadcrumbItemData } from './semantic/Breadcrumbs.js';
export { Surface } from './semantic/Surface.js';
export type { SurfaceProps } from './semantic/Surface.js';
export { Button } from './semantic/Button.js';
export type { ButtonProps, ButtonTone } from './semantic/Button.js';
export { StatusBadge } from './semantic/StatusBadge.js';
export type { StatusBadgeProps, StatusTone } from './semantic/StatusBadge.js';
export { EmptyState } from './semantic/EmptyState.js';
export type { EmptyStateProps } from './semantic/EmptyState.js';
export { DataTable } from './semantic/DataTable.js';
export type { DataTableProps, DataTableColumn, DataTableAlignment } from './semantic/DataTable.js';
export { PageHeader } from './semantic/PageHeader.js';
export type { PageHeaderProps } from './semantic/PageHeader.js';
export { Alert } from './semantic/Alert.js';
export type { AlertProps, AlertTone } from './semantic/Alert.js';
export { Field, FieldGroup, FieldSet } from './semantic/Field.js';
export type { FieldProps } from './semantic/Field.js';
export { Input, Textarea, Select, YesNoSelect } from './semantic/Inputs.js';
export type {
  InputProps,
  TextareaProps,
  SelectProps,
  SelectOption,
  YesNoSelectProps,
} from './semantic/Inputs.js';
export { RadioGroup, Checkbox } from './semantic/Choice.js';
export type { RadioGroupProps, RadioOption, CheckboxProps } from './semantic/Choice.js';
export { Bounded } from './primitives/layout.js';
export type { BoundedProps } from './primitives/layout.js';
