-- WP-7 prep / Fact Find correction.
--
-- `clients.recommendations` was originally provisioned as a Fact Find
-- JSONB section, but recommendations are an SOA Production output, not
-- a Fact Find input. The `clients.soa_wizard_data` JSONB is the
-- correct home for the rollover items, recommended insurance covers,
-- and platform-portfolio choices that previously lived in this column.
--
-- This migration drops the column outright. Nothing in production
-- has been written to it (this work-stream just shipped); if a future
-- environment needs the SOA Wizard data, it lives on
-- `clients.soa_wizard_data`. The corresponding shape will be defined
-- in WP-8 alongside the SOA Wizard schemas.

SET ROLE postgres;

ALTER TABLE clients DROP COLUMN IF EXISTS recommendations;

RESET ROLE;
