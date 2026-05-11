import { describe, expect, it } from 'vitest';

import {
  SOA_WIZARD_SECTION_IDS,
  soaWizardSectionDefaults,
  soaWizardSectionSchemas,
} from '../../src/soaWizard/index.js';

/**
 * Cross-section sanity. Mirrors the Fact Find registry test: every id
 * in `SOA_WIZARD_SECTION_IDS` must have both a registered schema and
 * a default, and every default must round-trip through its own
 * schema. This is the regression net we lean on when someone adds a
 * 16th section without updating the lookups.
 */
describe('SOA Wizard section registry', () => {
  it('every id has a schema and a default', () => {
    for (const id of SOA_WIZARD_SECTION_IDS) {
      expect(soaWizardSectionSchemas[id], `${id} schema`).toBeDefined();
      expect(soaWizardSectionDefaults[id], `${id} default`).toBeDefined();
    }
  });

  it('every default round-trips through its schema', () => {
    for (const id of SOA_WIZARD_SECTION_IDS) {
      const schema = soaWizardSectionSchemas[id];
      const defaultValue = soaWizardSectionDefaults[id];
      const parsed = schema.safeParse(defaultValue);
      expect(
        parsed.success,
        `${id}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`,
      ).toBe(true);
    }
  });

  it('SOA_WIZARD_SECTION_IDS contains exactly the 15 expected names in display order', () => {
    expect([...SOA_WIZARD_SECTION_IDS]).toEqual([
      'cover',
      'aboutAuthority',
      'goals',
      'position',
      'riskProfile',
      'strategyRecommendations',
      'insuranceRecommendations',
      'superRecommendations',
      'investmentRecommendations',
      'cashflowModelling',
      'projections',
      'feesCosts',
      'implementationPlan',
      'authorityToProceed',
      'appendices',
    ]);
  });

  it('every schema rejects unknown top-level keys (strict)', () => {
    for (const id of SOA_WIZARD_SECTION_IDS) {
      const schema = soaWizardSectionSchemas[id];
      const result = schema.safeParse({ ...soaWizardSectionDefaults[id], _unexpected: true });
      expect(result.success, `${id} should reject _unexpected`).toBe(false);
    }
  });
});
