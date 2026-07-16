require('dotenv').config();
delete process.env.PGSSLMODE; // Prevent local client from using SSL. Cloud client uses explicit config.
const pg = require('pg');
// Keep dates and timestamps as raw strings to prevent timezone shifting bugs
pg.types.setTypeParser(1082, (val) => val); // DATE
pg.types.setTypeParser(1114, (val) => val); // TIMESTAMP
pg.types.setTypeParser(1184, (val) => val); // TIMESTAMPTZ
const { Client } = pg;

const localConfig = {
  host: 'localhost',
  port: 5432,
  database: 'factory_db',
  user: 'postgres',
  password: 'salma136',
};

const cloudConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const getSortedTables = async (client) => {
  // Get all user-defined tables
  const { rows: tableRows } = await client.query(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
       AND table_type = 'BASE TABLE'
       AND table_name NOT IN ('spatial_ref_sys')`
  );
  const tables = tableRows.map(r => r.table_name);

  // Get foreign key dependencies (child_table depends on parent_table)
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

  // Build dependency graph (parent_table -> child_table)
  const graph = {};
  const inDegree = {};
  for (const table of tables) {
    graph[table] = [];
    inDegree[table] = 0;
  }

  for (const dep of depRows) {
    const parent = dep.parent_table;
    const child = dep.child_table;
    if (parent === child) continue; // Skip self-references (e.g. chart_of_accounts parent_id)
    
    if (graph[parent] && inDegree[child] !== undefined) {
      graph[parent].push(child);
      inDegree[child]++;
    }
  }

  // Kahn's algorithm for topological sorting
  const queue = [];
  for (const table of tables) {
    if (inDegree[table] === 0) {
      queue.push(table);
    }
  }

  const sorted = [];
  while (queue.length > 0) {
    const u = queue.shift();
    sorted.push(u);

    for (const v of graph[u]) {
      inDegree[v]--;
      if (inDegree[v] === 0) {
        queue.push(v);
      }
    }
  }

  // Catch any remaining tables (cycles or edge cases)
  if (sorted.length < tables.length) {
    for (const table of tables) {
      if (!sorted.includes(table)) {
        sorted.push(table);
      }
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
  return rows.map(r => r.column_name);
};

const main = async () => {
  console.log('Connecting to local database...');
  const localClient = new Client(localConfig);
  await localClient.connect();

  console.log('Connecting to cloud Neon database...');
  const cloudClient = new Client(cloudConfig);
  await cloudClient.connect();

  try {
    // 1. Compute topological sorting
    console.log('Analyzing database schema and sorting tables by dependency...');
    const tablesInOrder = await getSortedTables(localClient);
    console.log(`Sorted tables: ${tablesInOrder.join(', ')}`);

    // 2. Truncate cloud tables in reverse order (child-first)
    console.log('\nClearing existing data in cloud database...');
    const truncateOrder = [...tablesInOrder].reverse();
    for (const tableName of truncateOrder) {
      console.log(`Truncating ${tableName}...`);
      await cloudClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
    }

    // 3. Migrate each table in correct order (parent-first)
    console.log('\nCopying data from local database...');
    for (const tableName of tablesInOrder) {
      console.log(`Migrating table: ${tableName}...`);

      // Get writable columns
      const writableCols = await getWritableColumns(localClient, tableName);
      if (writableCols.length === 0) {
        console.log(`No writable columns found for ${tableName}. Skipping.`);
        continue;
      }

      const columnsList = writableCols.map(c => `"${c}"`).join(', ');

      // Fetch local data
      const { rows: dataRows } = await localClient.query(`SELECT ${columnsList} FROM "${tableName}"`);
      if (dataRows.length === 0) {
        console.log(`Table ${tableName} is empty locally. Skipping copy.`);
        continue;
      }

      // Insert rows in batches
      console.log(`Copying ${dataRows.length} rows...`);
      for (const row of dataRows) {
        const values = writableCols.map(col => {
          const val = row[col];
          if (val !== null && typeof val === 'object') {
            return JSON.stringify(val);
          }
          return val;
        });
        const placeholders = writableCols.map((_, i) => `$${i + 1}`).join(', ');
        await cloudClient.query(
          `INSERT INTO "${tableName}" (${columnsList}) VALUES (${placeholders})`,
          values
        );
      }
      console.log(`Successfully migrated ${tableName}.`);
    }

    // 4. Reset sequences on cloud database
    console.log('\nResetting serial sequences on cloud database...');
    const { rows: seqRows } = await cloudClient.query(
      `SELECT 
         tc.table_name, 
         c.column_name, 
         pg_get_serial_sequence(tc.table_name, c.column_name) AS seq_name
       FROM information_schema.table_constraints tc 
       JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name 
       JOIN information_schema.columns c ON c.table_name = tc.table_name AND c.column_name = ccu.column_name
       WHERE tc.constraint_type = 'PRIMARY KEY' 
         AND c.column_default LIKE 'nextval%'
         AND tc.table_schema = 'public'`
    );

    for (const seq of seqRows) {
      if (!seq.seq_name) continue;
      const { rows: maxRows } = await cloudClient.query(
        `SELECT COALESCE(MAX("${seq.column_name}"), 0) + 1 AS next_val FROM "${seq.table_name}"`
      );
      const nextVal = maxRows[0].next_val;
      await cloudClient.query(`ALTER SEQUENCE ${seq.seq_name} RESTART WITH ${nextVal}`);
      console.log(`Reset sequence ${seq.seq_name} for ${seq.table_name} to start with ${nextVal}.`);
    }

    console.log('\nData migration completed successfully!');

  } catch (error) {
    console.error('Migration failed with error:', error);
  } finally {
    await localClient.end();
    await cloudClient.end();
  }
};

main();
