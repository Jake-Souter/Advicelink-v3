import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';

import { clientWorkflowMachine } from '../src/clientWorkflow.js';

/**
 * Integration tests for the XState machine. The day-to-day API is
 * `canTransition` (covered exhaustively in `transitions.test.ts`);
 * these tests prove the machine itself accepts / rejects the right
 * events when actually run via `createActor`.
 *
 * The machine does NOT have an internal state for "current actor /
 * reason"; both are passed on the event so guards stay pure.
 */
describe('clientWorkflowMachine', () => {
  it('starts at newLead', () => {
    const actor = createActor(clientWorkflowMachine).start();
    expect(actor.getSnapshot().value).toBe('newLead');
    actor.stop();
  });

  it('walks the marketing-to-handoff slice', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'startFactFind', actor: { role: 'lead_gen' } });
    expect(actor.getSnapshot().value).toBe('factFinding');
    actor.send({ type: 'flagFactFindReady', actor: { role: 'lead_gen' } });
    expect(actor.getSnapshot().value).toBe('factFindReady');
    actor.send({ type: 'handOffToAdvice', actor: { role: 'lead_gen' } });
    expect(actor.getSnapshot().value).toBe('handedOffToAdvice');
    actor.stop();
  });

  it('rejects an event the current state does not accept', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'lockFactFind', actor: { role: 'adviser' } });
    // Still at the initial state — invalid event was a no-op.
    expect(actor.getSnapshot().value).toBe('newLead');
    actor.stop();
  });

  it('refuses a transition when the role is not allowed', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'startFactFind', actor: { role: 'paraplanner' } });
    // Guard returned false; state did not change.
    expect(actor.getSnapshot().value).toBe('newLead');
    actor.stop();
  });

  it('refuses markLost without a reason', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'markLost', actor: { role: 'lead_gen' } });
    expect(actor.getSnapshot().value).toBe('newLead');
    // ...and accepts it with one
    actor.send({ type: 'markLost', actor: { role: 'lead_gen' }, reason: 'unresponsive' });
    expect(actor.getSnapshot().value).toBe('lost');
    actor.stop();
  });

  it('terminal states swallow further events', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'markLost', actor: { role: 'lead_gen' }, reason: 'r' });
    expect(actor.getSnapshot().value).toBe('lost');
    actor.send({ type: 'startFactFind', actor: { role: 'lead_gen' } });
    expect(actor.getSnapshot().value).toBe('lost');
    actor.stop();
  });

  it('accepts firstSectionSaved only when isSystem: true', () => {
    const actor = createActor(clientWorkflowMachine).start();
    // Walk to paraplannerClaimed first.
    actor.send({ type: 'startFactFind', actor: { role: 'lead_gen' } });
    actor.send({ type: 'flagFactFindReady', actor: { role: 'lead_gen' } });
    actor.send({ type: 'handOffToAdvice', actor: { role: 'lead_gen' } });
    actor.send({ type: 'lockFactFind', actor: { role: 'adviser' } });
    actor.send({ type: 'sendToParaplanner', actor: { role: 'adviser' } });
    actor.send({ type: 'claimByParaplanner', actor: { role: 'paraplanner' } });
    expect(actor.getSnapshot().value).toBe('paraplannerClaimed');

    // User send is rejected by the system_only guard.
    actor.send({ type: 'firstSectionSaved', actor: { role: 'paraplanner' } });
    expect(actor.getSnapshot().value).toBe('paraplannerClaimed');

    // System send goes through.
    actor.send({
      type: 'firstSectionSaved',
      actor: { role: 'paraplanner' },
      isSystem: true,
    });
    expect(actor.getSnapshot().value).toBe('draftingSOA');
    actor.stop();
  });
});
