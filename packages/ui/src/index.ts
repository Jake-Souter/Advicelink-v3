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
