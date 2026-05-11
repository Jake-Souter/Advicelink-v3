// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Base ESLint config for Advicelink v3 packages and apps.
 *
 * Custom Advicelink rules (no-stringly-typed-status, no-feature-styling,
 * no-cross-feature-imports, no-process-env-outside-config) will be added
 * as a local plugin in `packages/eslint-plugin-advicelink/` once the first
 * feature package is in flight. They are tracked in REBUILD_PLAN.md §11.5
 * and §11.6.3.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/*.config.{js,ts,mjs,cjs}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Two structural bans, enforced via no-restricted-syntax until the
      // local `eslint-plugin-advicelink` lands:
      //   1. No env reads outside per-app config/env.ts (REBUILD_PLAN §11.5).
      //   2. No stringly-typed workflow-state comparisons outside
      //      `@advicelink/workflow` (REBUILD_PLAN §5 + the workflow-machine
      //      Cursor rule). The selector matches any string Literal whose
      //      value is a known WORKFLOW_STATES name appearing inside a
      //      BinaryExpression (`x === 'draftingSOA'`) OR an ArrayExpression
      //      (`['arDue', 'arWizardActive'].includes(...)`). Keep this
      //      regex in lockstep with `packages/workflow/src/states.ts`.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message: "Read env vars only from your app's `config/env.ts` (REBUILD_PLAN §11.5).",
        },
        {
          selector:
            'BinaryExpression > Literal[value=/^(newLead|factFinding|factFindReady|handedOffToAdvice|factFindLocked|awaitingParaplanner|paraplannerClaimed|draftingSOA|reviewingSOA|amendingSOA|soaPresented|soaAccepted|implementing|implemented|servicing|arDue|arWizardActive|draftingROAEO|reviewingROAEO|draftingAR|reviewingAR|arPresented|lost|notProceeding|offboarded)$/]',
          message:
            "Don't compare workflow states as strings — use isInState/isInPhase/canTransition from @advicelink/workflow (REBUILD_PLAN §5).",
        },
        {
          selector:
            'ArrayExpression > Literal[value=/^(newLead|factFinding|factFindReady|handedOffToAdvice|factFindLocked|awaitingParaplanner|paraplannerClaimed|draftingSOA|reviewingSOA|amendingSOA|soaPresented|soaAccepted|implementing|implemented|servicing|arDue|arWizardActive|draftingROAEO|reviewingROAEO|draftingAR|reviewingAR|arPresented|lost|notProceeding|offboarded)$/]',
          message:
            "Don't list workflow states as string arrays — use isInPhase/transitionsAvailable from @advicelink/workflow (REBUILD_PLAN §5).",
        },
      ],
    },
  },
  // The workflow package itself is the single place allowed to refer to
  // workflow-state names as raw strings (the canonical WORKFLOW_STATES
  // tuple lives there).
  {
    files: ['packages/workflow/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // The documented exception to the env-read ban: env loaders themselves.
  {
    files: ['**/config/env.ts', '**/config/env.*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // CLI scripts (migrate, seed, ad-hoc ops) and the boot file print
  // human-readable progress; structured Pino logs aren't appropriate there.
  {
    files: ['**/cli/**/*.{ts,js}', '**/scripts/**/*.{ts,js}', '**/src/index.{ts,js}'],
    rules: {
      'no-console': 'off',
    },
  },
  // Test files are allowed to read `process.env` for skip-conditions and
  // can use console for diagnostic output.
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-console': 'off',
    },
  },
);
