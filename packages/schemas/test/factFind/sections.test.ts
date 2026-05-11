import { describe, expect, it } from 'vitest';

import {
  FACT_FIND_SECTION_IDS,
  factFindSectionDefaults,
  factFindSectionSchemas,
} from '../../src/factFind/index.js';

/**
 * Cross-section sanity. The 13 entries in `FACT_FIND_SECTION_IDS`
 * (12 sections + `partnerEmployment`) must:
 *   - have a registered schema in `factFindSectionSchemas`
 *   - have a default value in `factFindSectionDefaults`
 *   - the default value must round-trip through its own schema
 *
 * This guards against drift the next time someone adds a section
 * (mostly during WP-7 wizards) without updating the lookups.
 */
describe('Fact Find section registry', () => {
  it('every id has a schema and a default', () => {
    for (const id of FACT_FIND_SECTION_IDS) {
      expect(factFindSectionSchemas[id], `${id} schema`).toBeDefined();
      expect(factFindSectionDefaults[id], `${id} default`).toBeDefined();
    }
  });

  it('every default round-trips through its schema', () => {
    for (const id of FACT_FIND_SECTION_IDS) {
      const schema = factFindSectionSchemas[id];
      const defaultValue = factFindSectionDefaults[id];
      const parsed = schema.safeParse(defaultValue);
      expect(
        parsed.success,
        `${id}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`,
      ).toBe(true);
    }
  });

  it('FACT_FIND_SECTION_IDS contains exactly the 12 expected names', () => {
    expect([...FACT_FIND_SECTION_IDS]).toEqual([
      'personal',
      'employment',
      'partnerEmployment',
      'financial',
      'assets',
      'liabilities',
      'superannuation',
      'contributions',
      'insurance',
      'beneficiaries',
      'goals',
      'riskProfile',
    ]);
  });
});
