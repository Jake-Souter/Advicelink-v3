/**
 * Client workflow machine and helpers.
 *
 * The actual XState v5 machine and the `isInPhase` / `canTransition` /
 * `isInState` helpers ship in Work Package 5. This file currently exposes the
 * macro phase + state name unions so other packages can refer to workflow
 * shapes without importing the machine itself.
 *
 * See REBUILD_PLAN.md §5.
 */

export type WorkflowPhase =
  | 'capture'
  | 'onboarding'
  | 'drafting'
  | 'presenting'
  | 'implementing'
  | 'servicing'
  | 'closed';

export type WorkflowState =
  // capture
  | 'newLead'
  | 'factFinding'
  | 'factFindReady'
  // onboarding
  | 'handedOffToAdvice'
  | 'factFindLocked'
  // drafting
  | 'awaitingParaplanner'
  | 'paraplannerClaimed'
  | 'draftingSOA'
  | 'reviewingSOA'
  | 'amendingSOA'
  // presenting
  | 'soaPresented'
  | 'soaAccepted'
  // implementing
  | 'implementing'
  | 'implemented'
  // servicing
  | 'servicing'
  | 'arDue'
  | 'arWizardActive'
  | 'draftingROAEO'
  | 'reviewingROAEO'
  | 'draftingAR'
  | 'reviewingAR'
  | 'arPresented'
  // closed
  | 'lost'
  | 'notProceeding'
  | 'offboarded';
