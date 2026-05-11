-- WP-7 follow-up / Fact Find UX consolidation.
--
-- Two Fact Find sections collapse into existing siblings:
--
--   * `clients.partner_employment` is removed. Partner employment is
--     a thin variant of the primary employment shape and was never
--     populated independently in the wizard. The relevant partner
--     fields (employer name, occupation) live on `personal.partner*`
--     when a partner exists; the dedicated section duplicated input
--     for no downstream consumer.
--
--   * `clients.liabilities` is removed. Every asset row already
--     carries `amountOwing` + loan fields, which is sufficient to
--     describe both asset-collateralised debt and standalone debts
--     (a credit card row records assetValue=0, amountOwing>0). The
--     UI previously rendered Assets and Liabilities as separate side-
--     nav entries; they are now a single "Assets and Liabilities"
--     section reading and writing only `clients.assets`.
--
-- Net effect on `@advicelink/schemas`: `FACT_FIND_SECTION_IDS` drops
-- from 12 to 10 entries.

SET ROLE postgres;

ALTER TABLE clients DROP COLUMN IF EXISTS partner_employment;
ALTER TABLE clients DROP COLUMN IF EXISTS liabilities;

RESET ROLE;
