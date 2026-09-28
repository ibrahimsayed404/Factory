// Integration tests TRUNCATE and mutate tables. Refuse to run unless the
// connection points at a local database whose name marks it as a test DB,
// so neither Supabase nor the real local factory_db can ever be targeted.
// Require this AFTER any line that rewrites process.env.DB_NAME.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const host = process.env.DB_HOST || 'localhost';
const dbName = process.env.DB_NAME || 'factory_db';

if (!LOCAL_HOSTS.has(host) || !/test/i.test(dbName)) {
  throw new Error(
    `SAFETY BLOCK: integration tests only run on a local *test* database (got ${host}/${dbName}). ` +
    'Set DB_HOST=localhost and DB_NAME=factory_test.'
  );
}
