-- OPERATOR ARTIFACT ONLY. Not a migration, not executed by this application.
-- Run only after the deployment runbook's effective-privilege audit is approved.
-- psql --set=api_role=gotx_public_reader --set=db_name=YOUR_DATABASE --set=api_schema=public ...
-- Use a NEW dedicated role. CREATE ROLE intentionally fails if it already exists.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE :"api_role" LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD NULL;
GRANT CONNECT ON DATABASE :"db_name" TO :"api_role";
GRANT USAGE ON SCHEMA :"api_schema" TO :"api_role";
GRANT SELECT ON TABLE :"api_schema".games, :"api_schema".users,
  :"api_schema".themes, :"api_schema".nominations, :"api_schema".completions
  TO :"api_role";
ALTER ROLE :"api_role" SET default_transaction_read_only = on;
ALTER ROLE :"api_role" IN DATABASE :"db_name" SET search_path = pg_catalog, :"api_schema";
COMMIT;
-- No password is stored in source, shell arguments or SQL logs by this artifact.
-- Operator provisions credentials separately (e.g. interactive psql \password).
-- No ALL TABLES, future default privileges, sequence or function grants.
-- This DOES NOT revoke existing PUBLIC permissions; audit/decisions are mandatory.
