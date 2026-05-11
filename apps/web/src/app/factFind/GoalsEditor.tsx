import { useState, type ReactElement } from 'react';

import { goalsSchema, type Goals } from '@advicelink/schemas';
import type { PromptKey } from '@advicelink/ai';
import { Alert, Button, Cluster, Grid, Input, Stack, Surface, Textarea } from '@advicelink/ui';

import { Field } from '../forms/Field';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';
import { trpc } from '../../lib/trpc';

/**
 * Goals editor with the AI assist surface wired in.
 *
 * Each AI-assistable question pairs a textarea with a "Suggest"
 * button. Clicking the button posts the client display name + a
 * small slice of facts to `factFind.aiAssist`, which redacts PII,
 * calls Anthropic (or the stub adapter), and returns a suggestion
 * string. The user can accept (writes the suggestion into the
 * textarea) or dismiss it.
 *
 * The 5 AI-assistable goals questions map 1:1 to prompt keys in
 * `@advicelink/ai`. The 2 remaining goals questions (super lump
 * sum, previous adviser) have no AI prompt yet — they're plain
 * textareas.
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
    'next12Months' | 'next1To5Years' | 'retirementPlan' | 'superImportance' | 'insuranceImportance'
  >;
  label: string;
  promptKey: PromptKey;
}

const QUESTIONS: readonly GoalQuestion[] = [
  {
    field: 'next12Months',
    label: 'What does the client want to achieve in the next 12 months?',
    promptKey: 'factFindGoalsNext12Months',
  },
  {
    field: 'next1To5Years',
    label: 'What does the client want to achieve in the next 1-5 years?',
    promptKey: 'factFindGoalsNext1To5Years',
  },
  {
    field: 'retirementPlan',
    label: "What is the client's retirement plan?",
    promptKey: 'factFindGoalsRetirementPlan',
  },
  {
    field: 'superImportance',
    label: 'How important is superannuation to the client and why?',
    promptKey: 'factFindGoalsSuperImportance',
  },
  {
    field: 'insuranceImportance',
    label: 'How important is personal insurance to the client and why?',
    promptKey: 'factFindGoalsInsuranceImportance',
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

  function patch<K extends keyof Goals>(key: K, value: Goals[K]): void {
    form.setDraft((prev: Goals) => ({ ...prev, [key]: value }));
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
        <GoalQuestionBlock
          key={q.field}
          question={q}
          value={form.draft[q.field] ?? ''}
          onChange={(v) => patch(q.field, v)}
          disabled={isLocked}
          clientId={clientId}
          clientDisplayName={clientDisplayName}
          factsBullets={factsBullets}
        />
      ))}

      <Field label="Super lump sum strategy notes (no AI suggest)">
        <Textarea
          value={form.draft.superLumpSum ?? ''}
          onChange={(e) => patch('superLumpSum', e.target.value)}
          disabled={isLocked}
          rows={4}
        />
      </Field>

      <Field label="Previous adviser (if any)">
        <Textarea
          value={form.draft.previousAdviser ?? ''}
          onChange={(e) => patch('previousAdviser', e.target.value)}
          disabled={isLocked}
          rows={3}
        />
      </Field>

      <SaveBar form={form} />
    </Stack>
  );
}

interface GoalQuestionBlockProps {
  question: GoalQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  clientId: string;
  clientDisplayName: string;
  factsBullets: string[];
}

function GoalQuestionBlock({
  question,
  value,
  onChange,
  disabled,
  clientId,
  clientDisplayName,
  factsBullets,
}: GoalQuestionBlockProps): ReactElement {
  const assist = trpc.factFind.aiAssist.useMutation();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [costInfo, setCostInfo] = useState<{ costCents: number; latencyMs: number } | null>(null);

  function handleSuggest(): void {
    setSuggestion(null);
    setCostInfo(null);
    assist.mutate(
      {
        clientId,
        promptKey: question.promptKey,
        input: { displayName: clientDisplayName, factsBullets },
      },
      {
        onSuccess: (result) => {
          // The output schema across all goal prompts is `{ suggestion: string }`;
          // the runtime check inside the API route already guarantees the shape.
          const out = result.output as { suggestion: string };
          setSuggestion(out.suggestion);
          setCostInfo({ costCents: result.costCents, latencyMs: result.latencyMs });
        },
      },
    );
  }

  return (
    <Stack gap={3}>
      <Field label={question.label}>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={4}
        />
      </Field>
      <Cluster>
        <Button
          type="button"
          tone="ghost"
          onClick={handleSuggest}
          disabled={disabled || assist.isPending}
        >
          {assist.isPending ? 'Asking AI…' : '✨ Suggest'}
        </Button>
      </Cluster>
      {assist.isError ? (
        <Alert tone="danger">AI assist failed: {assist.error.message}</Alert>
      ) : null}
      {suggestion ? (
        <Surface
          title="Suggested answer"
          description={costInfo ? `${costInfo.costCents}¢ · ${costInfo.latencyMs}ms` : undefined}
          actions={
            <Cluster gap={2}>
              <Button
                type="button"
                onClick={() => {
                  onChange(suggestion);
                  setSuggestion(null);
                }}
              >
                Accept
              </Button>
              <Button
                type="button"
                tone="ghost"
                onClick={() => {
                  setSuggestion(null);
                }}
              >
                Dismiss
              </Button>
            </Cluster>
          }
        >
          {suggestion}
        </Surface>
      ) : null}
    </Stack>
  );
}
