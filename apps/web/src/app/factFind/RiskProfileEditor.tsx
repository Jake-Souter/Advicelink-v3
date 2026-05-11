import type { ReactElement } from 'react';

import {
  DEFAULT_RISK_PROFILE_SCORING_MAP,
  RISK_PROFILE_QUESTION_KEYS,
  riskProfileSchema,
  type RiskProfile,
  type RiskProfileQuestionKey,
} from '@advicelink/schemas';

import { Field } from '../forms/Field';
import { SaveBar } from '../forms/SaveBar';
import { useDraftSection } from '../forms/useDraftSection';

/**
 * Risk Profile editor (REBUILD_PLAN §7.5.10 + §19.7).
 *
 * Five questions, each with five answer keys mapped to 1–5 points.
 * Total score → one of five profile bands. The score and band are
 * derived server-side; this editor renders the radios + a notes
 * textarea and shows the most recent derived band as a chip so the
 * adviser sees the impact of every change.
 */

const QUESTION_LABELS: Record<RiskProfileQuestionKey, string> = {
  superannuationCashOut: 'If your super dropped 20% over a year, what would you do?',
  investmentExperience: 'How experienced are you with investing?',
  superannuationReaction: 'How would you react to a sharp super decline?',
  riskToleranceStyle: 'Which best describes your risk tolerance?',
  experienceLevel: 'How comfortable do you feel making investment decisions?',
};

const ANSWER_LABELS: Record<string, string> = {
  // superannuationCashOut
  wouldNeverCashOut: 'Stay the course — never cash out',
  wouldStayCourse: 'Stay invested, ride it out',
  wouldReduceRisk: 'Reduce risk to defensive assets',
  wouldCashOutSome: 'Cash out part of the balance',
  wouldCashOutAll: 'Cash out everything',
  // investmentExperience
  extensiveExperience: 'Extensive — I actively manage investments',
  someExperience: 'Some — I have a portfolio I monitor',
  limitedExperience: 'Limited — a couple of investments',
  littleExperience: 'Little — only super',
  noExperience: 'None',
  // superannuationReaction
  seeAsOpportunity: 'See it as a buying opportunity',
  holdAndWait: 'Hold and wait it out',
  concernedButHold: 'Concerned, but hold',
  consultAdviser: 'Call my adviser to discuss options',
  wouldSell: 'Sell to limit further losses',
  // riskToleranceStyle
  seekHighestReturns: 'Highest possible returns, risk acceptable',
  comfortableHigherRisk: 'Comfortable with higher risk for better returns',
  balancedApproach: 'A balanced mix of risk and stability',
  preferStability: 'Prefer stability over growth',
  avoidRiskEntirely: 'Avoid risk entirely',
  // experienceLevel
  veryExperienced: 'Very experienced',
  experienced: 'Experienced',
  moderatelyExperienced: 'Moderately experienced',
  firstTime: 'First time',
};

export interface RiskProfileEditorProps {
  serverValue: unknown;
  onSaveServer: (parsed: RiskProfile) => Promise<unknown>;
  isLocked: boolean;
}

export function RiskProfileEditor({
  serverValue,
  onSaveServer,
  isLocked,
}: RiskProfileEditorProps): ReactElement {
  const form = useDraftSection<RiskProfile>({
    schema: riskProfileSchema,
    serverValue,
    onSave: onSaveServer,
  });

  function patch<K extends keyof RiskProfile>(key: K, value: RiskProfile[K]): void {
    form.setDraft((prev: RiskProfile) => ({ ...prev, [key]: value }));
  }

  return (
    <section>
      <h2>Risk profile</h2>
      <p style={{ color: 'var(--text-tertiary, #98A2B3)' }}>
        Five questions. The score and profile band are computed server-side using the{' '}
        <code>{DEFAULT_RISK_PROFILE_SCORING_MAP.version}</code> scoring map.
      </p>

      {form.draft.riskScore != null || form.draft.riskProfile != null ? (
        <div data-totals style={{ marginBottom: '1rem' }}>
          <span>
            Score: <strong>{form.draft.riskScore ?? '—'} / 25</strong>
          </span>
          <span>
            Band:{' '}
            <strong data-chip data-tone="accent">
              {form.draft.riskProfile ?? '—'}
            </strong>
          </span>
        </div>
      ) : null}

      {RISK_PROFILE_QUESTION_KEYS.map((qKey) => {
        const answers = DEFAULT_RISK_PROFILE_SCORING_MAP.questions[qKey];
        const selected = (form.draft[qKey] as string | undefined) ?? '';
        return (
          <Field key={qKey} label={QUESTION_LABELS[qKey]} error={form.errors[qKey]}>
            <div data-radio-group>
              {Object.entries(answers).map(([answerKey, points]) => (
                <label key={answerKey} data-radio>
                  <input
                    type="radio"
                    name={qKey}
                    value={answerKey}
                    checked={selected === answerKey}
                    onChange={(e) => patch(qKey, e.target.value)}
                    disabled={isLocked}
                  />
                  <span>
                    {ANSWER_LABELS[answerKey] ?? answerKey}{' '}
                    <span data-radio-points>({points} pt)</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
        );
      })}

      <Field label="Adviser notes" error={form.errors['notes']}>
        <textarea
          rows={3}
          value={form.draft.notes ?? ''}
          onChange={(e) => patch('notes', e.target.value === '' ? undefined : e.target.value)}
          disabled={isLocked}
        />
      </Field>

      <SaveBar form={form} />
    </section>
  );
}
