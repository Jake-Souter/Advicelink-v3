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
  it('starts at factFinding', () => {
    const actor = createActor(clientWorkflowMachine).start();
    expect(actor.getSnapshot().value).toBe('factFinding');
    actor.stop();
  });

  it('walks the factFind → SOA Production slice', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'lockFactFind', actor: { role: 'paraplanner' } });
    expect(actor.getSnapshot().value).toBe('draftingSOA');
    actor.send({ type: 'sendSOAForReview', actor: { role: 'paraplanner' } });
    expect(actor.getSnapshot().value).toBe('reviewingSOA');
    actor.send({ type: 'requestSOAChanges', actor: { role: 'adviser' } });
    expect(actor.getSnapshot().value).toBe('amendingSOA');
    actor.send({ type: 'resubmitSOA', actor: { role: 'paraplanner' } });
    expect(actor.getSnapshot().value).toBe('reviewingSOA');
    actor.stop();
  });

  it('rejects an event the current state does not accept', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'approveSOA', actor: { role: 'adviser' } });
    expect(actor.getSnapshot().value).toBe('factFinding');
    actor.stop();
  });

  it('refuses a transition when the role is not allowed', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'lockFactFind', actor: { role: 'lead_gen' } });
    expect(actor.getSnapshot().value).toBe('factFinding');
    actor.stop();
  });

  it('refuses markLost without a reason and accepts it with one', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'markLost', actor: { role: 'lead_gen' } });
    expect(actor.getSnapshot().value).toBe('factFinding');
    actor.send({ type: 'markLost', actor: { role: 'lead_gen' }, reason: 'unresponsive' });
    expect(actor.getSnapshot().value).toBe('lost');
    actor.stop();
  });

  it('refuses markLost from welcomeCallScheduled (post-flip)', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'lockFactFind', actor: { role: 'paraplanner' } });
    actor.send({ type: 'sendSOAForReview', actor: { role: 'paraplanner' } });
    actor.send({ type: 'approveSOA', actor: { role: 'adviser' } });
    actor.send({ type: 'recordClientSigned', actor: { role: 'lead_gen' }, isSystem: true });
    expect(actor.getSnapshot().value).toBe('welcomeCallScheduled');
    actor.send({ type: 'markLost', actor: { role: 'lead_gen' }, reason: 'too late' });
    expect(actor.getSnapshot().value).toBe('welcomeCallScheduled');
    actor.stop();
  });

  it('terminal states swallow further events', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'markLost', actor: { role: 'lead_gen' }, reason: 'r' });
    expect(actor.getSnapshot().value).toBe('lost');
    actor.send({ type: 'lockFactFind', actor: { role: 'paraplanner' } });
    expect(actor.getSnapshot().value).toBe('lost');
    actor.stop();
  });

  it('accepts recordClientSigned only when isSystem: true (DocuSign webhook)', () => {
    const actor = createActor(clientWorkflowMachine).start();
    actor.send({ type: 'lockFactFind', actor: { role: 'paraplanner' } });
    actor.send({ type: 'sendSOAForReview', actor: { role: 'paraplanner' } });
    actor.send({ type: 'approveSOA', actor: { role: 'adviser' } });
    expect(actor.getSnapshot().value).toBe('presentingSOA');

    // User send is rejected by the system_only guard.
    actor.send({ type: 'recordClientSigned', actor: { role: 'lead_gen' } });
    expect(actor.getSnapshot().value).toBe('presentingSOA');

    // Webhook send goes through.
    actor.send({
      type: 'recordClientSigned',
      actor: { role: 'lead_gen' },
      isSystem: true,
    });
    expect(actor.getSnapshot().value).toBe('welcomeCallScheduled');
    actor.stop();
  });

  it('AR cycle: bookAR → requestARDocument → sendARForReview → approveAR → recordARPackSigned (cycle restart)', () => {
    const actor = createActor(clientWorkflowMachine).start();
    // Walk to waitingForAR.
    actor.send({ type: 'lockFactFind', actor: { role: 'paraplanner' } });
    actor.send({ type: 'sendSOAForReview', actor: { role: 'paraplanner' } });
    actor.send({ type: 'approveSOA', actor: { role: 'adviser' } });
    actor.send({ type: 'recordClientSigned', actor: { role: 'lead_gen' }, isSystem: true });
    actor.send({ type: 'startImplementation', actor: { role: 'adviser' } });
    actor.send({ type: 'confirmImplementation', actor: { role: 'adviser' } });
    expect(actor.getSnapshot().value).toBe('waitingForAR');

    // Cron fires.
    actor.send({ type: 'autoFlagARDue', actor: { role: 'ar_support' }, isSystem: true });
    expect(actor.getSnapshot().value).toBe('dueForAR');

    actor.send({ type: 'bookAR', actor: { role: 'ar_support' } });
    actor.send({ type: 'requestARDocument', actor: { role: 'ar_adviser' } });
    actor.send({ type: 'sendARForReview', actor: { role: 'paraplanner' } });
    actor.send({ type: 'approveAR', actor: { role: 'ar_adviser' } });
    expect(actor.getSnapshot().value).toBe('arComplete');

    // DocuSign on the new CSA fires the cycle restart.
    actor.send({ type: 'recordARPackSigned', actor: { role: 'ar_adviser' }, isSystem: true });
    expect(actor.getSnapshot().value).toBe('implementingAdvice');
    actor.stop();
  });

  it('self-serve AR bypass goes arBooked → arComplete', () => {
    const actor = createActor(clientWorkflowMachine).start();
    // Fast-forward to arBooked.
    actor.send({ type: 'lockFactFind', actor: { role: 'paraplanner' } });
    actor.send({ type: 'sendSOAForReview', actor: { role: 'paraplanner' } });
    actor.send({ type: 'approveSOA', actor: { role: 'adviser' } });
    actor.send({ type: 'recordClientSigned', actor: { role: 'lead_gen' }, isSystem: true });
    actor.send({ type: 'startImplementation', actor: { role: 'adviser' } });
    actor.send({ type: 'confirmImplementation', actor: { role: 'adviser' } });
    actor.send({ type: 'autoFlagARDue', actor: { role: 'ar_support' }, isSystem: true });
    actor.send({ type: 'bookAR', actor: { role: 'ar_support' } });
    expect(actor.getSnapshot().value).toBe('arBooked');

    actor.send({ type: 'selfServeARComplete', actor: { role: 'ar_adviser' } });
    expect(actor.getSnapshot().value).toBe('arComplete');
    actor.stop();
  });
});
