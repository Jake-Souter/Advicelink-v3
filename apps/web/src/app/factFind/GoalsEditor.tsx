import { useState, type ReactElement } from 'react';

import { goalsSchema, type Goals } from '@advicelink/schemas';
import type { PromptKey } from '@advicelink/ai';
import {
  Alert,
  Button,
  Cluster,
  Grid,
  Input,
  Stack,
  Textarea,
} from '@advicelink/ui';

import { Field } from '../forms/Field';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';
import { trpc } from '../../lib/trpc';

/**
 * Goals editor with the AI assist surface wired in.
 *
 * Every question is phrased in the second person — the adviser
 * captures the section while sitting next to the client, so the
 * questions read as if the client is being asked directly ("What do
 * you want to achieve…", "How important is super to you…").
 *
 * AI assistance is a single bottom-of-section "Enhance" button
 * rather than a per-question Suggest. Clicking it fans out one
 * `factFind.aiAssist` call per AI-eligible question (the five
 * questions in `QUESTIONS`), then writes each suggestion back into
 * the matching draft field. The non-AI questions ("super lump sum"
 * + "previous adviser") live in the same draft and are saved by the
 * same SaveBar but are deliberately skipped by the bulk Enhance
 * call — Anthropic has no prompt for them yet.
 */

export interface GoalsEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: Goals) => Promise<unknown>;
  isLocked: boolean;
  clientId: string;
  clientDisplayName: string;
  /** Bullet points the AI prompt receives as context. The route
   *  computes this from the loaded fact-find sections. */
  factsBullets: string[];
}

interface GoalQuestion {
  field: keyof Pick<
    Goals,
    | 'next12Months'
    | 'next1To5Years'
    | 'retirementPlan'
    | 'superImportance'
    | 'insuranceImportance'
    | 'superLumpSum'
    | 'previousAdviser'
  >;
  label: string;
  promptKey: PromptKey;
  rows?: number;
}

const QUESTIONS: readonly GoalQuestion[] = [
  {
    field: 'next12Months',
    label: 'What do you want to achieve in the next 12 months?',
    promptKey: 'factFindGoalsNext12Months',
  },
  {
    field: 'next1To5Years',
    label: 'What do you want to achieve in the next 1-5 years?',
    promptKey: 'factFindGoalsNext1To5Years',
  },
  {
    field: 'retirementPlan',
    label: 'What is your retirement plan?',
    promptKey: 'factFindGoalsRetirementPlan',
  },
  {
    field: 'superImportance',
    label: 'How important is superannuation to you and why?',
    promptKey: 'factFindGoalsSuperImportance',
  },
  {
    field: 'insuranceImportance',
    label: 'How important is personal insurance to you and why?',
    promptKey: 'factFindGoalsInsuranceImportance',
  },
  {
    field: 'superLumpSum',
    label: 'How much would you like to have in your super by retirement?',
    promptKey: 'factFindGoalsSuperLumpSum',
  },
  {
    field: 'previousAdviser',
    label: 'Have you ever received financial advice in the past?',
    promptKey: 'factFindGoalsPreviousAdviser',
    rows: 3,
  },
];

export function GoalsEditor({
  serverValue,
  onSaveServer,
  isLocked,
  clientId,
  clientDisplayName,
  factsBullets,
}: GoalsEditorProps): ReactElement {
  const form = useDraftSection<Goals>({
    schema: goalsSchema,
    serverValue,
    onSave: onSaveServer,
  });

  const assist = trpc.factFind.aiAssist.useMutation();
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [lastEnhanceMeta, setLastEnhanceMeta] = useState<{
    costCents: number;
    latencyMs: number;
  } | null>(null);

  function patch<K extends keyof Goals>(key: K, value: Goals[K]): void {
    form.setDraft((prev: Goals) => ({ ...prev, [key]: value }));
  }

  async function handleEnhanceAll(): Promise<void> {
    setEnhancing(true);
    setEnhanceError(null);
    setLastEnhanceMeta(null);
    try {
      // Fan-out: one prompt per AI-eligible goals question. Each
      // call is independent, so Promise.all keeps the wall-clock
      // close to the slowest individual mutation rather than the
      // sum of them.
      const results = await Promise.all(
        QUESTIONS.map((q) =>
          assist
            .mutateAsync({
              clientId,
              promptKey: q.promptKey,
              input: { displayName: clientDisplayName, factsBullets },
            })
            .then((r) => ({
              field: q.field,
              suggestion: (r.output as { suggestion: string }).suggestion,
              costCents: r.costCents,
              latencyMs: r.latencyMs,
            })),
        ),
      );

      form.setDraft((prev: Goals) => {
        const next: Goals = { ...prev };
        for (const r of results) {
          next[r.field] = r.suggestion;
        }
        return next;
      });

      const totalCost = results.reduce((acc, r) => acc + r.costCents, 0);
      const maxLatency = results.reduce((acc, r) => Math.max(acc, r.latencyMs), 0);
      setLastEnhanceMeta({ costCents: totalCost, latencyMs: maxLatency });
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <Stack as="section" gap={6}>
      <h2>Goals</h2>

      <Grid cols={2} gap={4}>
        <Field label="Desired retirement age" error={form.errors['desiredRetirementAge']}>
          <Input
            type="number"
            min={40}
            max={100}
            value={form.draft.desiredRetirementAge ?? ''}
            onChange={(e) =>
              patch(
                'desiredRetirementAge',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
            disabled={isLocked}
          />
        </Field>
        <Field
          label="Desired weekly retirement income (AUD)"
          error={form.errors['desiredRetirementIncomeWeekly']}
        >
          <Input
            type="number"
            min={0}
            value={form.draft.desiredRetirementIncomeWeekly ?? ''}
            onChange={(e) =>
              patch(
                'desiredRetirementIncomeWeekly',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
            disabled={isLocked}
          />
        </Field>
      </Grid>

      {QUESTIONS.map((q) => (
        <Field key={q.field} label={q.label}>
          <Textarea
            value={form.draft[q.field] ?? ''}
            onChange={(e) => patch(q.field, e.target.value)}
            disabled={isLocked}
            rows={q.rows ?? 4}
          />
        </Field>
      ))}

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
            void handleEnhanceAll();
          }}
        >
          {enhancing ? 'Enhancing…' : '✨ Enhance'}
        </Button>
      </Cluster>

      <SaveBar form={form} />
    </Stack>
  );
}
