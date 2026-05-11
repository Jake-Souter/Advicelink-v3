import { describe, expect, it } from 'vitest';

import {
  STATE_TO_PHASE,
  TERMINAL_STATES,
  WORKFLOW_PHASES,
  WORKFLOW_STATES,
  isInPhase,
  isInState,
  isTerminalState,
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
    expect(isInState('factFinding', { workflowState: 'factFinding' })).toBe(true);
    expect(isInState('factFinding', { workflow_state: 'factFinding' })).toBe(true);
    expect(isInState('draftingSOA', { workflowState: 'factFinding' })).toBe(false);
  });

  it('isInPhase resolves the macro phase correctly', () => {
    expect(isInPhase('factFind', { workflowState: 'factFinding' })).toBe(true);
    expect(isInPhase('soaProduction', { workflowState: 'draftingSOA' })).toBe(true);
    expect(isInPhase('soaProduction', { workflowState: 'amendingSOA' })).toBe(true);
    expect(isInPhase('presentation', { workflowState: 'presentingSOA' })).toBe(true);
    expect(isInPhase('presentation', { workflowState: 'welcomeCallScheduled' })).toBe(true);
    expect(isInPhase('postAdvice', { workflowState: 'draftingROAEO' })).toBe(true);
    expect(isInPhase('complete', { workflowState: 'implementingAdvice' })).toBe(true);
    expect(isInPhase('complete', { workflowState: 'insuranceAmendment' })).toBe(true);
    expect(isInPhase('waiting', { workflowState: 'waitingForAR' })).toBe(true);
    expect(isInPhase('annualReview', { workflowState: 'dueForAR' })).toBe(true);
    expect(isInPhase('annualReview', { workflowState: 'arComplete' })).toBe(true);
    expect(isInPhase('closed', { workflowState: 'lost' })).toBe(true);

    expect(isInPhase('factFind', { workflowState: 'draftingSOA' })).toBe(false);
  });

  it('isInState throws when the subject has no workflowState', () => {
    expect(() => isInState('factFinding', {})).toThrow(/missing/);
  });

  it('phaseOf is total over WORKFLOW_STATES', () => {
    for (const state of WORKFLOW_STATES) {
      expect(typeof phaseOf(state)).toBe('string');
    }
  });

  it('type guards reject foreign strings', () => {
    expect(isWorkflowState('factFinding')).toBe(true);
    expect(isWorkflowState('newLead')).toBe(false); // legacy name from pre-WP-5.5
    expect(isWorkflowState('not-a-real-state')).toBe(false);
    expect(isWorkflowState(42)).toBe(false);

    expect(isWorkflowPhase('factFind')).toBe(true);
    expect(isWorkflowPhase('capture')).toBe(false); // legacy phase name from pre-WP-5.5
    expect(isWorkflowPhase('not-a-phase')).toBe(false);
    expect(isWorkflowPhase(undefined)).toBe(false);
  });

  it('production WORKFLOW_NODES — full grouping (sanity check)', () => {
    expect(STATE_TO_PHASE.factFinding).toBe('factFind');

    expect(STATE_TO_PHASE.draftingSOA).toBe('soaProduction');
    expect(STATE_TO_PHASE.reviewingSOA).toBe('soaProduction');
    expect(STATE_TO_PHASE.amendingSOA).toBe('soaProduction');

    expect(STATE_TO_PHASE.presentingSOA).toBe('presentation');
    expect(STATE_TO_PHASE.welcomeCallScheduled).toBe('presentation');

    expect(STATE_TO_PHASE.draftingROAEO).toBe('postAdvice');
    expect(STATE_TO_PHASE.reviewingROAEO).toBe('postAdvice');

    expect(STATE_TO_PHASE.implementingAdvice).toBe('complete');
    expect(STATE_TO_PHASE.insuranceAmendment).toBe('complete');

    expect(STATE_TO_PHASE.waitingForAR).toBe('waiting');

    expect(STATE_TO_PHASE.dueForAR).toBe('annualReview');
    expect(STATE_TO_PHASE.arBooked).toBe('annualReview');
    expect(STATE_TO_PHASE.draftingAR).toBe('annualReview');
    expect(STATE_TO_PHASE.reviewingAR).toBe('annualReview');
    expect(STATE_TO_PHASE.arComplete).toBe('annualReview');

    expect(STATE_TO_PHASE.lost).toBe('closed');
  });

  it('TERMINAL_STATES contains exactly the closed states', () => {
    expect([...TERMINAL_STATES].sort()).toEqual(['lost']);
    expect(isTerminalState('lost')).toBe(true);
    expect(isTerminalState('factFinding')).toBe(false);
    expect(isTerminalState('arComplete')).toBe(false);
  });

  it('shape totals match the production spec (16 active + 1 closed; 8 phases)', () => {
    expect(WORKFLOW_STATES.length).toBe(17);
    expect(WORKFLOW_PHASES.length).toBe(8);
    const active = WORKFLOW_STATES.filter((s) => !TERMINAL_STATES.includes(s));
    expect(active.length).toBe(16);
  });
});
