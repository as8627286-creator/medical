-- Applied only when the PostgreSQL volume is created for the first time.
--
-- The database, the role and the extensions the application expects are
-- created here so that the first `docker compose up` works without manual
-- steps. The passwords come from the environment; this file only sets the
-- defaults that the official image already applies.

-- The application uses the "public" schema and the pg_trgm extension for the
-- catalogue search. The extension has to be created by a superuser, which the
-- init scripts run as.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
