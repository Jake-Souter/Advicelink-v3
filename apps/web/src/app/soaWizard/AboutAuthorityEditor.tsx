import { useState, type ReactElement } from 'react';

import { soaWizard } from '@advicelink/schemas';
import {
  Alert,
  Button,
  Cluster,
  Grid,
  Select,
  Stack,
  Textarea,
} from '@advicelink/ui';

import { Field } from '../forms/Field';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';
import { trpc } from '../../lib/trpc';

/**
 * SOA Wizard — About Us & Authority editor (REBUILD_PLAN §19.1.2).
 *
 * The boilerplate "About us" / scope-of-advice / authority-to-act
 * block at the front of the SOA. Most of the fixed legalese is
 * templated by the licensee at DOCX render time (REBUILD_PLAN
 * §19.4.2); this section captures the per-client overrides.
 *
 * AI assist is wired against `scopeOfAdvice` only — the rest are
 * either categorical selects or boilerplate the adviser tweaks
 * directly.
 */

const BASIS_OPTIONS: ReadonlyArray<{
  value: soaWizard.BasisOfAdvice;
  label: string;
}> = [
  { value: 'comprehensive', label: 'Comprehensive' },
  { value: 'limited', label: 'Limited / scoped' },
  { value: 'scaled', label: 'Scaled' },
];

const FEE_MODEL_OPTIONS: ReadonlyArray<{
  value: soaWizard.FeeForServiceModel;
  label: string;
}> = [
  { value: 'fixed', label: 'Fixed fee' },
  { value: 'asset-based', label: 'Asset-based' },
  { value: 'hybrid', label: 'Hybrid' },
];

export interface AboutAuthorityEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: soaWizard.AboutAuthority) => Promise<unknown>;
  isLocked: boolean;
  clientId: string;
  clientDisplayName: string;
  /** Bullet list passed to the AI prompt. The route component
   *  computes this from the locked Fact Find sections. */
  factsBullets: string[];
}

export function AboutAuthorityEditor({
  serverValue,
  onSaveServer,
  isLocked,
  clientId,
  clientDisplayName,
  factsBullets,
}: AboutAuthorityEditorProps): ReactElement {
  const form = useDraftSection<soaWizard.AboutAuthority>({
    schema: soaWizard.aboutAuthoritySchema,
    serverValue,
    onSave: onSaveServer,
  });

  const assist = trpc.soaWizard.aiAssist.useMutation();
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [lastEnhanceMeta, setLastEnhanceMeta] = useState<{
    costCents: number;
    latencyMs: number;
  } | null>(null);

  function patch<K extends keyof soaWizard.AboutAuthority>(
    key: K,
    value: soaWizard.AboutAuthority[K],
  ): void {
    form.setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleEnhanceScope(): Promise<void> {
    setEnhancing(true);
    setEnhanceError(null);
    setLastEnhanceMeta(null);
    try {
      const result = await assist.mutateAsync({
        clientId,
        promptKey: 'soaWizardScopeOfAdvice',
        input: { displayName: clientDisplayName, factsBullets },
      });
      const suggestion = (result.output as { suggestion: string }).suggestion;
      patch('scopeOfAdvice', suggestion);
      setLastEnhanceMeta({ costCents: result.costCents, latencyMs: result.latencyMs });
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <Stack as="section" gap={6}>
      <h2>About Us &amp; Authority</h2>
      <p data-fact-find-description>
        Scope and basis of advice, fee model, and the authority statement the client is being
        asked to sign. The licensee's standard wording renders at document time; everything
        captured here overrides or supplements it.
      </p>

      <Grid cols={2} gap={4}>
        <Field label="Basis of advice">
          <Select
            value={form.draft.basisOfAdvice ?? undefined}
            onValueChange={(next) =>
              patch('basisOfAdvice', (next ?? undefined) as soaWizard.BasisOfAdvice | undefined)
            }
            options={BASIS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="Select…"
            clearable
            disabled={isLocked}
          />
        </Field>
        <Field label="Fee for service model">
          <Select
            value={form.draft.feeForServiceModel ?? undefined}
            onValueChange={(next) =>
              patch(
                'feeForServiceModel',
                (next ?? undefined) as soaWizard.FeeForServiceModel | undefined,
              )
            }
            options={FEE_MODEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="Select…"
            clearable
            disabled={isLocked}
          />
        </Field>
      </Grid>

      <Field
        label="Scope of advice"
        help="What this SOA addresses and any limitations the adviser has flagged."
      >
        <Textarea
          value={form.draft.scopeOfAdvice ?? ''}
          onChange={(e) => patch('scopeOfAdvice', e.target.value || undefined)}
          rows={5}
          disabled={isLocked}
        />
      </Field>

      <Field label="Excluded from advice">
        <Textarea
          value={form.draft.excludedFromAdvice ?? ''}
          onChange={(e) => patch('excludedFromAdvice', e.target.value || undefined)}
          rows={3}
          disabled={isLocked}
        />
      </Field>

      <Field label="Authority statement">
        <Textarea
          value={form.draft.authorityStatement ?? ''}
          onChange={(e) => patch('authorityStatement', e.target.value || undefined)}
          rows={6}
          disabled={isLocked}
        />
      </Field>

      <Field label="Acknowledgement of risks">
        <Textarea
          value={form.draft.acknowledgementOfRisks ?? ''}
          onChange={(e) => patch('acknowledgementOfRisks', e.target.value || undefined)}
          rows={4}
          disabled={isLocked}
        />
      </Field>

      {enhanceError ? (
        <Alert tone="danger" title="Enhance failed">
          {enhanceError}
        </Alert>
      ) : null}

      <Cluster justify="end" gap={3}>
        {lastEnhanceMeta ? (
          <span data-fact-find-description>
            Enhanced ({lastEnhanceMeta.costCents}¢ · {lastEnhanceMeta.latencyMs}ms)
          </span>
        ) : null}
        <Button
          type="button"
          tone="secondary"
          disabled={isLocked || enhancing}
          onClick={() => {
            void handleEnhanceScope();
          }}
        >
          {enhancing ? 'Enhancing…' : '✨ Enhance scope of advice'}
        </Button>
      </Cluster>

      <SaveBar form={form} />
    </Stack>
  );
}
