import { describe, expect, it } from 'vitest';

import {
  STATE_TO_PHASE,
  WORKFLOW_PHASES,
  WORKFLOW_STATES,
  isInPhase,
  isInState,
  isWorkflowPhase,
  isWorkflowState,
  phaseOf,
} from '../src/states.js';

describe('states + phase mapping', () => {
  it('every state maps to exactly one phase', () => {
    for (const state of WORKFLOW_STATES) {
      const phase = STATE_TO_PHASE[state];
      expect(WORKFLOW_PHASES, `state '${state}' maps to invalid phase '${phase}'`).toContain(phase);
    }
  });

  it('every phase has at least one state', () => {
    for (const phase of WORKFLOW_PHASES) {
      const states = WORKFLOW_STATES.filter((s) => STATE_TO_PHASE[s] === phase);
      expect(states.length, `phase '${phase}' has no states`).toBeGreaterThan(0);
    }
  });

  it('isInState matches camelCase and snake_case subjects', () => {
    expect(isInState('newLead', { workflowState: 'newLead' })).toBe(true);
    expect(isInState('newLead', { workflow_state: 'newLead' })).toBe(true);
    expect(isInState('factFinding', { workflowState: 'newLead' })).toBe(false);
  });

  it('isInPhase resolves the macro phase correctly', () => {
    expect(isInPhase('capture', { workflowState: 'newLead' })).toBe(true);
    expect(isInPhase('capture', { workflowState: 'draftingSOA' })).toBe(false);
    expect(isInPhase('drafting', { workflowState: 'paraplannerClaimed' })).toBe(true);
    expect(isInPhase('servicing', { workflowState: 'arDue' })).toBe(true);
    expect(isInPhase('closed', { workflowState: 'lost' })).toBe(true);
  });

  it('isInState throws when the subject has no workflowState', () => {
    expect(() => isInState('newLead', {})).toThrow(/missing/);
  });

  it('phaseOf is total over WORKFLOW_STATES', () => {
    for (const state of WORKFLOW_STATES) {
      expect(typeof phaseOf(state)).toBe('string');
    }
  });

  it('type guards reject foreign strings', () => {
    expect(isWorkflowState('newLead')).toBe(true);
    expect(isWorkflowState('not-a-real-state')).toBe(false);
    expect(isWorkflowState(42)).toBe(false);

    expect(isWorkflowPhase('capture')).toBe(true);
    expect(isWorkflowPhase('not-a-phase')).toBe(false);
    expect(isWorkflowPhase(undefined)).toBe(false);
  });

  it('REBUILD_PLAN §5.2 phase grouping holds (sanity check)', () => {
    expect(STATE_TO_PHASE.newLead).toBe('capture');
    expect(STATE_TO_PHASE.factFindLocked).toBe('onboarding');
    expect(STATE_TO_PHASE.draftingSOA).toBe('drafting');
    expect(STATE_TO_PHASE.soaPresented).toBe('presenting');
    expect(STATE_TO_PHASE.implementing).toBe('implementing');
    expect(STATE_TO_PHASE.servicing).toBe('servicing');
    expect(STATE_TO_PHASE.lost).toBe('closed');
    expect(STATE_TO_PHASE.notProceeding).toBe('closed');
    expect(STATE_TO_PHASE.offboarded).toBe('closed');
  });
});
