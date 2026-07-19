# Workspace Guidelines & Safety Rules

## Data Protection & Testing Rules
- **NEVER** run full `npm test` or integration tests against the production/live Supabase database (`DB_HOST` in `.env`).
- Integration tests contain destructive SQL hooks (`TRUNCATE`, `DELETE`, drop schema) that alter database state.
- **ALWAYS** use `npm test` (which executes unit tests in `tests/unit`) or run specific unit test paths like `npx jest tests/unit/loanUtils.test.js`.
- All integration tests are protected with hard fail-safes that block execution when connected to Supabase endpoints.
