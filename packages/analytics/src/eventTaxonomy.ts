/**
 * Canonical PostHog event taxonomy for Advicelink v3.
 *
 * Per REBUILD_PLAN.md §17 (Definition of done) and §13.6, every canonical user
 * action emits a PostHog event from this list. New events must be added here
 * (and reviewed) before being captured anywhere in the codebase.
 *
 * Naming convention: `<area>.<verb>` in lowerCamelCase, past tense for
 * outcomes, present tense for intents.
 */
export const EVENT = {
  // Auth
  authSignedIn: 'auth.signedIn',
  authSignedOut: 'auth.signedOut',

  // Workflow transitions (mirrors REBUILD_PLAN §5.4)
  workflowTransitioned: 'workflow.transitioned',

  // Portals
  portalViewed: 'portal.viewed',
  portalCardOpened: 'portal.cardOpened',

  // Fact Find
  factFindOpened: 'factFind.opened',
  factFindSectionSaved: 'factFind.sectionSaved',
  factFindLocked: 'factFind.locked',

  // SOA Wizard
  soaWizardOpened: 'soaWizard.opened',
  soaWizardSectionSaved: 'soaWizard.sectionSaved',
  soaWizardAiAssistInvoked: 'soaWizard.aiAssistInvoked',
  soaWizardSentForReview: 'soaWizard.sentForReview',

  // ROA / EO Wizard
  roaEoWizardRunStarted: 'roaEoWizard.runStarted',
  roaEoWizardRunFinalised: 'roaEoWizard.runFinalised',

  // AR Wizard
  arWizardRunStarted: 'arWizard.runStarted',
  arWizardRunCompleted: 'arWizard.runCompleted',

  // Documents
  documentRenderQueued: 'document.renderQueued',
  documentRenderCompleted: 'document.renderCompleted',
  documentRenderFailed: 'document.renderFailed',
  documentDownloaded: 'document.downloaded',

  // E-sign
  envelopeCreated: 'envelope.created',
  envelopeCompleted: 'envelope.completed',
  envelopeDeclined: 'envelope.declined',

  // Implementation
  implementationItemStatusChanged: 'implementation.itemStatusChanged',

  // Paraplanner queue
  paraplannerClaimed: 'paraplanner.claimed',
  paraplannerReleased: 'paraplanner.released',

  // AI
  aiCallSucceeded: 'ai.callSucceeded',
  aiCallFailed: 'ai.callFailed',
  aiBudgetExceeded: 'ai.budgetExceeded',

  // Errors
  errorSurfacedToUser: 'error.surfacedToUser',
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];
