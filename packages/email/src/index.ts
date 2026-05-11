/**
 * SendGrid client + dynamic-template index.
 *
 * Templates managed in SendGrid; the API references templates by ID. Required
 * template registry lives in `./templates/index.ts` and lists the IDs from
 * REBUILD_PLAN.md §19.12.8 (welcome, mfa-prompt, paraplanner-claim-request,
 * soa-review-request, ar-due, envelope-completed, envelope-declined,
 * password-reset). Bounce/spam handling via the SendGrid Event Webhook with
 * HMAC verification → `email_events` table.
 */
export {};
