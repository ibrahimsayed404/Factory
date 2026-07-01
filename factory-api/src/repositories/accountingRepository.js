const pool = require('../db/pool');

const normalizeDateFilters = ({ date_from, date_to } = {}) => {
  const filters = [];
  const params = [];
  if (date_from) {
    params.push(date_from);
    filters.push(`je.entry_date >= $${params.length}`);
  }
  if (date_to) {
    params.push(date_to);
    filters.push(`je.entry_date <= $${params.length}`);
  }
  return { filters, params };
};

const getAccountByCode = async (code, client = pool) => {
  const result = await client.query('SELECT * FROM chart_of_accounts WHERE code = $1', [code]);
  return result.rows[0] || null;
};

const getAccountById = async (id, client = pool) => {
  const result = await client.query('SELECT * FROM chart_of_accounts WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const listAccounts = async ({ account_type, active } = {}) => {
  const params = [];
  let query = `
    SELECT coa.*, parent.code AS parent_code, parent.name AS parent_name
    FROM chart_of_accounts coa
    LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_id
    WHERE 1=1
  `;
  if (account_type) {
    params.push(account_type);
    query += ` AND coa.account_type = $${params.length}`;
  }
  if (active !== undefined && active !== null && active !== '') {
    params.push(active === true || active === 'true');
    query += ` AND coa.is_active = $${params.length}`;
  }
  query += ' ORDER BY coa.code ASC';
  const result = await pool.query(query, params);
  return result.rows;
};

const createAccount = async (data, client = pool) => {
  const result = await client.query(
    `INSERT INTO chart_of_accounts (
      code, name, account_type, parent_id, is_cash, is_bank, is_system, is_active, opening_balance
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      data.code,
      data.name,
      data.account_type,
      data.parent_id || null,
      data.is_cash || false,
      data.is_bank || false,
      data.is_system || false,
      data.is_active !== false,
      data.opening_balance || 0,
    ]
  );
  return result.rows[0];
};

const updateAccount = async (id, data, client = pool) => {
  const result = await client.query(
    `UPDATE chart_of_accounts
     SET name = COALESCE($1, name),
         account_type = COALESCE($2, account_type),
         parent_id = COALESCE($3, parent_id),
         is_cash = COALESCE($4, is_cash),
         is_bank = COALESCE($5, is_bank),
         is_active = COALESCE($6, is_active),
         opening_balance = COALESCE($7, opening_balance),
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [
      data.name ?? null,
      data.account_type ?? null,
      data.parent_id ?? null,
      data.is_cash ?? null,
      data.is_bank ?? null,
      data.is_active ?? null,
      data.opening_balance ?? null,
      id,
    ]
  );
  return result.rows[0] || null;
};

const listCashAccounts = async () => {
  const result = await pool.query(
    `SELECT ca.*, coa.code, coa.name AS account_name,
            (COALESCE(coa.opening_balance, 0) + COALESCE(SUM(jl.debit - jl.credit), 0))::float AS balance
     FROM cash_accounts ca
     JOIN chart_of_accounts coa ON coa.id = ca.account_id
     LEFT JOIN accounting_journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
     GROUP BY ca.id, coa.id
     ORDER BY ca.name ASC`
  );
  return result.rows;
};

const listBankAccounts = async () => {
  const result = await pool.query(
    `SELECT ba.*, coa.code, coa.name AS account_name,
            (COALESCE(coa.opening_balance, 0) + COALESCE(SUM(jl.debit - jl.credit), 0))::float AS balance
     FROM bank_accounts ba
     JOIN chart_of_accounts coa ON coa.id = ba.account_id
     LEFT JOIN accounting_journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
     GROUP BY ba.id, coa.id
     ORDER BY ba.bank_name ASC`
  );
  return result.rows;
};

const createCashAccount = async (data, client = pool) => {
  const result = await client.query(
    `INSERT INTO cash_accounts (account_id, name, currency, custodian, is_active)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [data.account_id, data.name, data.currency || 'USD', data.custodian || null, data.is_active !== false]
  );
  return result.rows[0];
};

const createBankAccount = async (data, client = pool) => {
  const result = await client.query(
    `INSERT INTO bank_accounts (account_id, bank_name, account_number, iban, currency, is_active)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.account_id,
      data.bank_name,
      data.account_number || null,
      data.iban || null,
      data.currency || 'USD',
      data.is_active !== false,
    ]
  );
  return result.rows[0];
};

const getExistingJournalEntry = async (sourceType, sourceId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM accounting_journal_entries
     WHERE source_type = $1 AND source_id = $2
     ORDER BY id DESC
     LIMIT 1`,
    [sourceType, sourceId]
  );
  return result.rows[0] || null;
};

const insertJournalEntry = async (client, data) => {
  const result = await client.query(
    `INSERT INTO accounting_journal_entries (
      entry_number, entry_date, description, source_type, source_id, memo, status, posted_at, created_by
    )
     VALUES (
       $1::varchar,
       $2::date,
       $3::text,
       $4::varchar,
       $5::int,
       $6::text,
       $7::varchar,
       CASE WHEN $7::varchar = 'posted' THEN NOW() ELSE NULL END,
       $8::int
     )
     RETURNING *`,
    [
      data.entry_number,
      data.entry_date || new Date().toISOString().slice(0, 10),
      data.description || null,
      data.source_type,
      data.source_id,
      data.memo || null,
      data.status || 'posted',
      data.created_by || null,
    ]
  );
  return result.rows[0];
};

const insertJournalLine = async (client, line) => {
  const result = await client.query(
    `INSERT INTO accounting_journal_lines (
      journal_entry_id, account_id, account_code, account_name, debit, credit, customer_id, line_memo
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      line.journal_entry_id,
      line.account_id,
      line.account_code,
      line.account_name,
      line.debit || 0,
      line.credit || 0,
      line.customer_id || null,
      line.line_memo || null,
    ]
  );
  return result.rows[0];
};

const listJournalEntries = async ({ source_type, date_from, date_to, limit = 100, offset = 0 } = {}) => {
  const { filters, params } = normalizeDateFilters({ date_from, date_to });
  let query = `
    SELECT je.*,
           COALESCE(SUM(jl.debit), 0)::float AS total_debit,
           COALESCE(SUM(jl.credit), 0)::float AS total_credit
    FROM accounting_journal_entries je
    LEFT JOIN accounting_journal_lines jl ON jl.journal_entry_id = je.id
    WHERE 1=1
  `;
  if (source_type) {
    params.push(source_type);
    query += ` AND je.source_type = $${params.length}`;
  }
  if (filters.length) query += ` AND ${filters.join(' AND ')}`;
  params.push(limit, offset);
  query += ` GROUP BY je.id ORDER BY je.entry_date DESC, je.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const result = await pool.query(query, params);
  return result.rows;
};

const getJournalEntryById = async (id) => {
  const entry = await pool.query('SELECT * FROM accounting_journal_entries WHERE id = $1', [id]);
  if (!entry.rows.length) return null;
  const lines = await pool.query(
    `SELECT jl.*, coa.account_type
     FROM accounting_journal_lines jl
     LEFT JOIN chart_of_accounts coa ON coa.id = jl.account_id
     WHERE jl.journal_entry_id = $1
     ORDER BY jl.id ASC`,
    [id]
  );
  return { ...entry.rows[0], lines: lines.rows };
};

const getLedgerRows = async ({ account_id, account_code, date_from, date_to } = {}) => {
  const params = [];
  let query = `
    SELECT je.entry_date, je.entry_number, je.description, je.source_type, je.source_id,
           jl.account_id, jl.account_code, jl.account_name, jl.debit, jl.credit, jl.line_memo
    FROM accounting_journal_lines jl
    JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.status = 'posted'
  `;
  if (account_id) {
    params.push(account_id);
    query += ` AND jl.account_id = $${params.length}`;
  }
  if (account_code) {
    params.push(account_code);
    query += ` AND jl.account_code = $${params.length}`;
  }
  if (date_from) {
    params.push(date_from);
    query += ` AND je.entry_date >= $${params.length}`;
  }
  if (date_to) {
    params.push(date_to);
    query += ` AND je.entry_date <= $${params.length}`;
  }
  query += ' ORDER BY je.entry_date ASC, je.id ASC, jl.id ASC';
  const result = await pool.query(query, params);
  return result.rows;
};

const getTrialBalanceRows = async ({ date_to } = {}) => {
  const params = [];
  let dateFilter = '';
  if (date_to) {
    params.push(date_to);
    dateFilter = ` AND je.entry_date <= $${params.length}`;
  }
  const result = await pool.query(
    `SELECT coa.id, coa.code, coa.name, coa.account_type, coa.opening_balance,
            COALESCE(SUM(jl.debit), 0)::float AS debit,
            COALESCE(SUM(jl.credit), 0)::float AS credit
     FROM chart_of_accounts coa
     LEFT JOIN accounting_journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
       AND je.status = 'posted'
       ${dateFilter}
     WHERE coa.is_active = true
     GROUP BY coa.id
     ORDER BY coa.code ASC`,
    params
  );
  return result.rows;
};

const getProfitLossRows = async ({ date_from, date_to } = {}) => {
  const { filters, params } = normalizeDateFilters({ date_from, date_to });
  const dateSql = filters.length ? ` AND ${filters.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT coa.id, coa.code, coa.name, coa.account_type,
            COALESCE(SUM(jl.debit), 0)::float AS debit,
            COALESCE(SUM(jl.credit), 0)::float AS credit
     FROM chart_of_accounts coa
     LEFT JOIN accounting_journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
       AND je.status = 'posted'
       ${dateSql}
     WHERE coa.account_type IN ('revenue', 'expense')
     GROUP BY coa.id
     ORDER BY coa.code ASC`,
    params
  );
  return result.rows;
};

const getBalanceSheetRows = async ({ date_to } = {}) => {
  const params = [];
  let dateFilter = '';
  if (date_to) {
    params.push(date_to);
    dateFilter = ` AND je.entry_date <= $${params.length}`;
  }
  const result = await pool.query(
    `SELECT coa.id, coa.code, coa.name, coa.account_type, coa.opening_balance,
            COALESCE(SUM(jl.debit), 0)::float AS debit,
            COALESCE(SUM(jl.credit), 0)::float AS credit
     FROM chart_of_accounts coa
     LEFT JOIN accounting_journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
       AND je.status = 'posted'
       ${dateFilter}
     WHERE coa.account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')
     GROUP BY coa.id
     ORDER BY coa.code ASC`,
    params
  );
  return result.rows;
};

const createExpenseRecord = async (client, data) => {
  const result = await client.query(
    `INSERT INTO accounting_expenses (
      expense_number, expense_date, account_id, paid_from_account_id,
      amount, vendor, reference_number, notes, created_by
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      data.expense_number,
      data.expense_date || new Date().toISOString().slice(0, 10),
      data.account_id,
      data.paid_from_account_id || null,
      data.amount,
      data.vendor || null,
      data.reference_number || null,
      data.notes || null,
      data.created_by || null,
    ]
  );
  return result.rows[0];
};

module.exports = {
  getAccountByCode,
  getAccountById,
  listAccounts,
  createAccount,
  updateAccount,
  listCashAccounts,
  listBankAccounts,
  createCashAccount,
  createBankAccount,
  getExistingJournalEntry,
  insertJournalEntry,
  insertJournalLine,
  listJournalEntries,
  getJournalEntryById,
  getLedgerRows,
  getTrialBalanceRows,
  getProfitLossRows,
  getBalanceSheetRows,
  createExpenseRecord,
};
