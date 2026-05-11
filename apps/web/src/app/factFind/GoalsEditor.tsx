import { useState, type ReactElement } from 'react';

import { goalsSchema, type Goals } from '@advicelink/schemas';
import type { PromptKey } from '@advicelink/ai';

import { Field } from '../forms/Field';
import { useDraftSection } from '../forms/useDraftSection';
import { trpc } from '../../lib/trpc';

/**
 * Goals editor with the AI assist surface wired in.
 *
 * Each AI-assistable question is wrapped in a [data-question-block]
 * with a "Suggest" button next to it. Clicking the button posts the
 * client display name + a small slice of facts to
 * `factFind.aiAssist`, which redacts PII, calls Anthropic (or the
 * stub adapter), and returns a suggestion string. The user can
 * accept (writes the suggestion into the textarea) or dismiss it.
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
    <section>
      <h2>Goals</h2>

      <div data-row-grid style={{ marginBottom: '1.5rem' }}>
        <Field label="Desired retirement age" error={form.errors['desiredRetirementAge']}>
          <input
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
          <input
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
      </div>

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

      <div data-question-block style={{ marginTop: '1rem' }}>
        <Field label="Super lump sum strategy notes (no AI suggest)">
          <textarea
            value={form.draft.superLumpSum ?? ''}
            onChange={(e) => patch('superLumpSum', e.target.value)}
            disabled={isLocked}
            rows={4}
          />
        </Field>
      </div>

      <div data-question-block style={{ marginTop: '1rem' }}>
        <Field label="Previous adviser (if any)">
          <textarea
            value={form.draft.previousAdviser ?? ''}
            onChange={(e) => patch('previousAdviser', e.target.value)}
            disabled={isLocked}
            rows={3}
          />
        </Field>
      </div>

      {form.saveError ? (
        <p data-banner data-tone="danger" role="alert" style={{ marginTop: '1rem' }}>
          {form.saveError}
        </p>
      ) : null}
      {form.saveSuccessAt && !form.isDirty ? (
        <p data-banner data-tone="success" style={{ marginTop: '1rem' }}>
          Saved.
        </p>
      ) : null}
      <div data-form-actions>
        <button
          type="button"
          data-button="secondary"
          onClick={form.reset}
          disabled={!form.isDirty || form.isSaving}
        >
          Reset
        </button>
        <button
          type="button"
          data-button="primary"
          onClick={() => {
            void form.save();
          }}
          disabled={!form.isDirty || form.isSaving}
        >
          {form.isSaving ? 'Saving…' : 'Save section'}
        </button>
      </div>
    </section>
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
    <div data-question-block style={{ marginTop: '1rem' }}>
      <Field label={question.label}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={4}
        />
      </Field>
      <div data-question-actions>
        <button
          type="button"
          data-button="ghost"
          onClick={handleSuggest}
          disabled={disabled || assist.isPending}
        >
          {assist.isPending ? 'Asking AI…' : '✨ Suggest'}
        </button>
      </div>
      {assist.isError ? (
        <p data-banner data-tone="danger" role="alert">
          AI assist failed: {assist.error.message}
        </p>
      ) : null}
      {suggestion ? (
        <div data-ai-suggestion>
          <div>{suggestion}</div>
          {costInfo ? (
            <div data-ai-suggestion-meta>
              {costInfo.costCents}¢ · {costInfo.latencyMs}ms
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              data-button="primary"
              onClick={() => {
                onChange(suggestion);
                setSuggestion(null);
              }}
            >
              Accept
            </button>
            <button
              type="button"
              data-button="ghost"
              onClick={() => {
                setSuggestion(null);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
