/**
 * Copy all public table data from Neon (source) into the current DB_* target
 * (Supabase Postgres after cutover).
 *
 * Env:
 *   NEON_DB_*  = source
 *   DB_*       = target (Supabase)
 */
require('dotenv').config();
const pg = require('pg');
pg.types.setTypeParser(1082, (val) => val); // DATE
pg.types.setTypeParser(1114, (val) => val); // TIMESTAMP
pg.types.setTypeParser(1184, (val) => val); // TIMESTAMPTZ
const { Client } = pg;

const sourceConfig = {
  host: process.env.NEON_DB_HOST,
  port: parseInt(process.env.NEON_DB_PORT || '5432', 10),
  database: process.env.NEON_DB_NAME,
  user: process.env.NEON_DB_USER,
  password: process.env.NEON_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const targetConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const getSortedTables = async (client) => {
  const { rows: tableRows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name NOT IN ('spatial_ref_sys')`
  );
  const tables = tableRows.map((r) => r.table_name);

  const { rows: depRows } = await client.query(
    `SELECT DISTINCT
       tc.table_name AS child_table,
       ccu.table_name AS parent_table
     FROM information_schema.table_constraints AS tc
     JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'`
  );

  const graph = {};
  const inDegree = {};
  for (const table of tables) {
    graph[table] = [];
    inDegree[table] = 0;
  }

  for (const dep of depRows) {
    const parent = dep.parent_table;
    const child = dep.child_table;
    if (parent === child) continue;
    if (graph[parent] && inDegree[child] !== undefined) {
      graph[parent].push(child);
      inDegree[child]++;
    }
  }

  const queue = [];
  for (const table of tables) {
    if (inDegree[table] === 0) queue.push(table);
  }

  const sorted = [];
  while (queue.length > 0) {
    const u = queue.shift();
    sorted.push(u);
    for (const v of graph[u]) {
      inDegree[v]--;
      if (inDegree[v] === 0) queue.push(v);
    }
  }

  if (sorted.length < tables.length) {
    for (const table of tables) {
      if (!sorted.includes(table)) sorted.push(table);
    }
  }

  return sorted;
};

const getWritableColumns = async (client, tableName) => {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = $1
       AND table_schema = 'public'
       AND is_generated = 'NEVER'`,
    [tableName]
  );
  return rows.map((r) => r.column_name);
};

const main = async () => {
  for (const key of [
    'NEON_DB_HOST',
    'NEON_DB_NAME',
    'NEON_DB_USER',
    'NEON_DB_PASSWORD',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ]) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  console.log('Connecting to Neon (source)...');
  const source = new Client(sourceConfig);
  await source.connect();

  console.log('Connecting to Supabase (target)...');
  const target = new Client(targetConfig);
  await target.connect();

  try {
    console.log('Sorting tables by FK dependency...');
    const tablesInOrder = await getSortedTables(source);
    console.log(`Tables: ${tablesInOrder.join(', ')}`);

    console.log('\nClearing target tables...');
    for (const tableName of [...tablesInOrder].reverse()) {
      console.log(`Truncating ${tableName}...`);
      await target.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
    }

    console.log('\nCopying data...');
    for (const tableName of tablesInOrder) {
      console.log(`Migrating ${tableName}...`);
      const sourceCols = await getWritableColumns(source, tableName);
      const targetCols = await getWritableColumns(target, tableName);
      const writableCols = sourceCols.filter((c) => targetCols.includes(c));
      const skippedCols = sourceCols.filter((c) => !targetCols.includes(c));
      if (skippedCols.length) {
        console.log(`  Skipping columns missing on target: ${skippedCols.join(', ')}`);
      }
      if (writableCols.length === 0) {
        console.log('  No writable columns. Skip.');
        continue;
      }

      const columnsList = writableCols.map((c) => `"${c}"`).join(', ');
      const { rows: dataRows } = await source.query(
        `SELECT ${columnsList} FROM "${tableName}"`
      );
      if (dataRows.length === 0) {
        console.log('  Empty. Skip.');
        continue;
      }

      console.log(`  Copying ${dataRows.length} rows...`);
      for (const row of dataRows) {
        const values = writableCols.map((col) => {
          const val = row[col];
          if (val !== null && typeof val === 'object') {
            return JSON.stringify(val);
          }
          return val;
        });
        const placeholders = writableCols.map((_, i) => `$${i + 1}`).join(', ');
        await target.query(
          `INSERT INTO "${tableName}" (${columnsList}) VALUES (${placeholders})`,
          values
        );
      }
      console.log(`  Done.`);
    }

    console.log('\nResetting sequences...');
    const { rows: seqRows } = await target.query(
      `SELECT
         tc.table_name,
         c.column_name,
         pg_get_serial_sequence(tc.table_name, c.column_name) AS seq_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
       JOIN information_schema.columns c
         ON c.table_name = tc.table_name AND c.column_name = ccu.column_name
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND c.column_default LIKE 'nextval%'
         AND tc.table_schema = 'public'`
    );

    for (const seq of seqRows) {
      if (!seq.seq_name) continue;
      const { rows: maxRows } = await target.query(
        `SELECT COALESCE(MAX("${seq.column_name}"), 0) + 1 AS next_val FROM "${seq.table_name}"`
      );
      const nextVal = maxRows[0].next_val;
      await target.query(`ALTER SEQUENCE ${seq.seq_name} RESTART WITH ${nextVal}`);
      console.log(`  ${seq.seq_name} -> ${nextVal}`);
    }

    console.log('\nNeon -> Supabase migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await source.end();
    await target.end();
  }
};

main();
