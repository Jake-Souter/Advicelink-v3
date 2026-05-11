/**
 * SendGrid template ID registry. Populate with real IDs once SendGrid is
 * provisioned. Per REBUILD_PLAN §19.12.8 the v1 templates are:
 */
export const SENDGRID_TEMPLATE_IDS = {
  welcome: 'TODO',
  mfaPrompt: 'TODO',
  paraplannerClaimRequest: 'TODO',
  soaReviewRequest: 'TODO',
  arDue: 'TODO',
  envelopeCompleted: 'TODO',
  envelopeDeclined: 'TODO',
  passwordReset: 'TODO',
} as const;

export type SendgridTemplateKey = keyof typeof SENDGRID_TEMPLATE_IDS;
