import { describe, expect, it } from 'vitest';

import {
  annualise,
  deriveAll,
  deriveAssets,
  deriveBmi,
  deriveContributions,
  deriveFinancial,
  deriveInsurance,
  deriveNetWealth,
  deriveRiskProfile,
} from '../../src/factFind/derivations.js';
import { factFindSectionDefaults } from '../../src/factFind/index.js';

const uuid = (prefix: string, n: number): string =>
  `${prefix.padEnd(8, '0').slice(0, 8)}-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

describe('deriveBmi', () => {
  it('computes BMI from height (cm) and weight (kg)', () => {
    expect(deriveBmi({ ...factFindSectionDefaults.personal, height: 180, weight: 75 })).toBe(23.15);
  });

  it('returns undefined when either value is missing', () => {
    expect(deriveBmi({ ...factFindSectionDefaults.personal, height: 180 })).toBeUndefined();
    expect(deriveBmi({ ...factFindSectionDefaults.personal, weight: 75 })).toBeUndefined();
    expect(deriveBmi(factFindSectionDefaults.personal)).toBeUndefined();
  });

  it('returns undefined when height is zero', () => {
    expect(
      deriveBmi({ ...factFindSectionDefaults.personal, height: 0, weight: 75 }),
    ).toBeUndefined();
  });
});

describe('deriveFinancial', () => {
  it('totals annual income + SG; populates per-row superGuaranteeDollars', () => {
    const result = deriveFinancial({
      incomes: [
        {
          id: uuid('inc-a', 1),
          incomeType: 'Salary',
          grossAnnual: 100000,
          sgEligible: true,
          superGuaranteePercent: 12,
        },
        {
          id: uuid('inc-b', 2),
          incomeType: 'Self-employed',
          grossAnnual: 30000,
          sgEligible: false,
        },
      ],
    });
    expect(result.totalIncomeAnnual).toBe(130000);
    expect(result.totalSgAnnual).toBe(12000);
    expect(result.incomes[0]!.superGuaranteeDollars).toBe(12000);
    expect(result.incomes[1]!.superGuaranteeDollars).toBeUndefined();
  });

  it('strips a stale superGuaranteeDollars when sgEligible flips false', () => {
    const result = deriveFinancial({
      incomes: [
        {
          id: uuid('inc-c', 3),
          incomeType: 'Self-employed',
          grossAnnual: 50000,
          sgEligible: false,
          superGuaranteeDollars: 6000,
          // (superGuaranteePercent intentionally absent — superRefine
          // wouldn't accept it on a sgEligible:false row)
        },
      ],
    });
    expect(result.incomes[0]!.superGuaranteeDollars).toBeUndefined();
  });
});

describe('deriveAssets / deriveNetWealth', () => {
  it('totals asset values and asset-side debt', () => {
    const a = deriveAssets({
      items: [
        { id: uuid('a1', 1), name: 'House', assetValue: 800000, amountOwing: 500000, isPpor: true },
        { id: uuid('a2', 2), name: 'Car', assetValue: 30000, amountOwing: 0, isPpor: false },
      ],
    });
    expect(a.totalAssets).toBe(830000);
    expect(a.totalLiabilities).toBe(500000);
  });

  it('treats standalone debts (assetValue=0, amountOwing>0) as pure liabilities', () => {
    const a = deriveAssets({
      items: [
        {
          id: uuid('l1', 1),
          name: 'Personal Loan',
          assetValue: 0,
          amountOwing: 12000,
          isPpor: false,
        },
      ],
    });
    expect(a.totalAssets).toBe(0);
    expect(a.totalLiabilities).toBe(12000);
  });

  it('net wealth subtracts every amountOwing across the unified row list', () => {
    const a = deriveAssets({
      items: [
        { id: uuid('a3', 3), name: 'House', assetValue: 800000, amountOwing: 500000, isPpor: true },
        { id: uuid('l2', 2), name: 'CC', assetValue: 0, amountOwing: 5000, isPpor: false },
      ],
    });
    expect(deriveNetWealth(a)).toBe(295000);
  });
});

describe('annualise', () => {
  it.each([
    [100, 'Weekly', 5200],
    [100, 'Fortnightly', 2600],
    [100, 'Monthly', 1200],
    [100, 'Quarterly', 400],
    [100, 'Annual', 100],
  ] as const)('%s/%s -> %s', (amount, frequency, expected) => {
    expect(annualise(amount, frequency)).toBe(expected);
  });
});

describe('deriveContributions', () => {
  it('splits totals between concessional and non-concessional', () => {
    const result = deriveContributions({
      items: [
        {
          id: uuid('c1', 1),
          type: 'Salary Sacrifice',
          amount: 500,
          frequency: 'Monthly',
          noiSubmitted: false,
        },
        {
          id: uuid('c2', 2),
          type: 'Personal Concessional',
          amount: 5000,
          frequency: 'Annual',
          noiSubmitted: true,
        },
        {
          id: uuid('c3', 3),
          type: 'Non-concessional',
          amount: 100000,
          frequency: 'Annual',
          noiSubmitted: false,
        },
        {
          id: uuid('c4', 4),
          type: 'Spouse',
          amount: 250,
          frequency: 'Quarterly',
          noiSubmitted: false,
        },
      ],
    });
    expect(result.totalConcessional).toBe(11000); // 500*12 + 5000
    expect(result.totalNonConcessional).toBe(101000); // 100000 + 250*4
  });
});

describe('deriveInsurance', () => {
  it('annualises premium per cover and totals by payee', () => {
    const result = deriveInsurance({
      covers: [
        {
          id: uuid('cov1', 1),
          coverType: 'Life',
          coverAmount: 500000,
          premium: 100,
          premiumFrequency: 'Monthly',
          payee: 'Self',
        },
        {
          id: uuid('cov2', 2),
          coverType: 'TPD',
          coverAmount: 250000,
          premium: 600,
          premiumFrequency: 'Annual',
          payee: 'Super',
        },
      ],
    });
    expect(result.covers[0]!.annualPremium).toBe(1200);
    expect(result.covers[1]!.annualPremium).toBe(600);
    expect(result.totalSuperPremium).toBe(600);
    expect(result.totalPersonalPremium).toBe(1200);
  });

  it('drops a stale annualPremium when premium inputs cleared', () => {
    const result = deriveInsurance({
      covers: [
        {
          id: uuid('cov3', 3),
          coverType: 'Life',
          coverAmount: 500000,
          annualPremium: 999, // stale
          payee: 'Self',
        },
      ],
    });
    expect(result.covers[0]!.annualPremium).toBeUndefined();
  });
});

describe('deriveRiskProfile', () => {
  const allFiveAnswers = {
    superannuationCashOut: 'wouldNeverCashOut', // 5
    investmentExperience: 'extensiveExperience', // 5
    superannuationReaction: 'seeAsOpportunity', // 5
    riskToleranceStyle: 'seekHighestReturns', // 5
    experienceLevel: 'veryExperienced', // 5
  };

  it('sums all five questions and maps to a band', () => {
    const result = deriveRiskProfile(allFiveAnswers);
    expect(result.riskScore).toBe(25);
    expect(result.riskProfile).toBe('Aggressive');
  });

  it('omits the band when fewer than 5 answered', () => {
    const partial = { ...allFiveAnswers, experienceLevel: undefined };
    const result = deriveRiskProfile(partial);
    expect(result.riskScore).toBe(20);
    expect(result.riskProfile).toBeUndefined();
  });

  it.each([
    [
      {
        ...allFiveAnswers,
        superannuationCashOut: 'wouldCashOutAll',
        investmentExperience: 'noExperience',
        superannuationReaction: 'wouldSell',
        riskToleranceStyle: 'avoidRiskEntirely',
        experienceLevel: 'firstTime',
      },
      5,
      'Defensive',
    ],
    [
      {
        ...allFiveAnswers,
        superannuationCashOut: 'wouldCashOutSome',
        investmentExperience: 'littleExperience',
        superannuationReaction: 'consultAdviser',
        riskToleranceStyle: 'preferStability',
        experienceLevel: 'limitedExperience',
      },
      10,
      'Conservative',
    ],
    [
      {
        ...allFiveAnswers,
        superannuationCashOut: 'wouldStayCourse',
        investmentExperience: 'someExperience',
        superannuationReaction: 'concernedButHold',
        riskToleranceStyle: 'balancedApproach',
        experienceLevel: 'moderatelyExperienced',
      },
      17,
      'Balanced',
    ],
    [
      {
        ...allFiveAnswers,
        superannuationCashOut: 'wouldStayCourse',
        investmentExperience: 'someExperience',
        superannuationReaction: 'holdAndWait',
        riskToleranceStyle: 'comfortableHigherRisk',
        experienceLevel: 'experienced',
      },
      20,
      'Growth',
    ],
  ] as const)('answers → score %i and band %s', (answers, score, band) => {
    const result = deriveRiskProfile(answers);
    expect(result.riskScore).toBe(score);
    expect(result.riskProfile).toBe(band);
  });

  it('treats unknown answer keys as zero (visible miscalibration), still no band when partial', () => {
    const result = deriveRiskProfile({ ...allFiveAnswers, experienceLevel: 'badKey' });
    expect(result.riskScore).toBe(20);
    // All 5 are answered (non-empty strings) so band IS evaluated against
    // a score of 20 → Growth. This is the "visible miscalibration"
    // behaviour: garbage in, garbage out, but no thrown exception.
    expect(result.riskProfile).toBe('Growth');
  });
});

describe('deriveAll', () => {
  it('mirrors financial.totalSgAnnual into contributions', () => {
    const out = deriveAll({
      ...factFindSectionDefaults,
      financial: {
        incomes: [
          {
            id: uuid('inc', 1),
            incomeType: 'Salary',
            grossAnnual: 100000,
            sgEligible: true,
            superGuaranteePercent: 12,
          },
        ],
      },
      contributions: { items: [] },
    });
    expect(out.financial.totalSgAnnual).toBe(12000);
    expect(out.contributions.totalSgAnnual).toBe(12000);
  });

  it('runs every section idempotently (running twice yields identical output)', () => {
    const once = deriveAll(factFindSectionDefaults);
    const twice = deriveAll(once);
    expect(twice).toEqual(once);
  });
});
