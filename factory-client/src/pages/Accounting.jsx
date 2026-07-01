import React, { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../api';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, MetricCard, Spinner, ErrorMsg } from '../components/ui';

const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const tabs = [
  ['overview', 'Overview'],
  ['accounts', 'Chart of Accounts'],
  ['journals', 'Journal Entries'],
  ['ledger', 'General Ledger'],
  ['statements', 'Statements'],
  ['cash', 'Cash and Bank'],
];

const emptyJournalLine = () => ({ account_code: '', debit: '', credit: '', line_memo: '' });

export default function Accounting() {
  const [activeTab, setActiveTab] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [journals, setJournals] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [trialBalance, setTrialBalance] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [ledgerAccount, setLedgerAccount] = useState('');
  const [ledgerRows, setLedgerRows] = useState([]);
  const [showExpense, setShowExpense] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ expense_date: '', account_code: '6000', paid_from_account_code: '1010', amount: '', vendor: '', notes: '' });
  const [journalForm, setJournalForm] = useState({ entry_date: '', description: '', lines: [emptyJournalLine(), emptyJournalLine()] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [accountRows, journalRows, cashRows, bankRows, tb, pl, bs] = await Promise.all([
        accountingApi.accounts(),
        accountingApi.journalEntries('?limit=100'),
        accountingApi.cashAccounts(),
        accountingApi.bankAccounts(),
        accountingApi.trialBalance(),
        accountingApi.profitLoss(),
        accountingApi.balanceSheet(),
      ]);
      setAccounts(accountRows || []);
      setJournals(journalRows || []);
      setCashAccounts(cashRows || []);
      setBankAccounts(bankRows || []);
      setTrialBalance(tb);
      setProfitLoss(pl);
      setBalanceSheet(bs);
      const firstAccount = accountRows?.[0]?.code || '';
      setLedgerAccount((prev) => prev || firstAccount);
    } catch (err) {
      setError(err.message || 'Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!ledgerAccount) return;
    accountingApi.generalLedger(`?account_code=${encodeURIComponent(ledgerAccount)}`)
      .then(setLedgerRows)
      .catch((err) => setError(err.message || 'Failed to load ledger'));
  }, [ledgerAccount]);

  const expenseAccounts = useMemo(() => accounts.filter((account) => account.account_type === 'expense'), [accounts]);
  const paymentAccounts = useMemo(() => accounts.filter((account) => account.account_type === 'asset' && (account.is_cash || account.is_bank)), [accounts]);

  const submitExpense = async () => {
    await accountingApi.createExpense(expenseForm);
    setShowExpense(false);
    setExpenseForm({ expense_date: '', account_code: '6000', paid_from_account_code: '1010', amount: '', vendor: '', notes: '' });
    await load();
  };

  const updateJournalLine = (index, field, value) => {
    setJournalForm((current) => ({
      ...current,
      lines: current.lines.map((line, i) => i === index ? { ...line, [field]: value } : line),
    }));
  };

  const submitJournal = async () => {
    await accountingApi.createJournalEntry({
      ...journalForm,
      lines: journalForm.lines.map((line) => ({
        ...line,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
      })),
    });
    setShowJournal(false);
    setJournalForm({ entry_date: '', description: '', lines: [emptyJournalLine(), emptyJournalLine()] });
    await load();
  };

  const accountColumns = [
    { key: 'code', label: 'Code', render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span> },
    { key: 'name', label: 'Account' },
    { key: 'account_type', label: 'Type', render: (v) => <Badge variant={v === 'asset' ? 'info' : v === 'expense' ? 'warning' : 'default'}>{v}</Badge> },
    { key: 'opening_balance', label: 'Opening', render: money },
    { key: 'is_active', label: 'Status', render: (v) => <Badge variant={v ? 'success' : 'default'}>{v ? 'active' : 'inactive'}</Badge> },
  ];

  const journalColumns = [
    { key: 'entry_number', label: 'Entry #', render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span> },
    { key: 'entry_date', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'description', label: 'Description', render: (v, row) => v || row.memo || row.source_type },
    { key: 'source_type', label: 'Source' },
    { key: 'total_debit', label: 'Debit', render: money },
    { key: 'total_credit', label: 'Credit', render: money },
  ];

  const ledgerColumns = [
    { key: 'entry_date', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'entry_number', label: 'Entry #' },
    { key: 'description', label: 'Description' },
    { key: 'debit', label: 'Debit', render: money },
    { key: 'credit', label: 'Credit', render: money },
    { key: 'running_balance', label: 'Running', render: money },
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title="Accounting"
        subtitle="Double-entry finance, automated postings, and financial statements"
        action={(
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setShowExpense(true)}>+ Expense</Btn>
            <Btn variant="primary" onClick={() => setShowJournal(true)}>+ Journal</Btn>
          </div>
        )}
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {tabs.map(([key, label]) => (
              <Btn key={key} variant={activeTab === key ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab(key)}>
                {label}
              </Btn>
            ))}
          </div>

          {activeTab === 'overview' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 16 }}>
                <MetricCard label="Assets" value={money(balanceSheet?.total_assets)} />
                <MetricCard label="Liabilities" value={money(balanceSheet?.total_liabilities)} color="var(--warn)" />
                <MetricCard label="Equity" value={money(balanceSheet?.total_equity)} color="var(--info)" />
                <MetricCard label="Net Income" value={money(profitLoss?.net_income)} color={Number(profitLoss?.net_income || 0) >= 0 ? 'var(--accent)' : 'var(--danger)'} />
              </div>
              <Card padding="0"><Table columns={journalColumns} data={journals.slice(0, 8)} emptyMsg="No journal entries yet" /></Card>
            </>
          )}

          {activeTab === 'accounts' && <Card padding="0"><Table columns={accountColumns} data={accounts} /></Card>}

          {activeTab === 'journals' && <Card padding="0"><Table columns={journalColumns} data={journals} /></Card>}

          {activeTab === 'ledger' && (
            <>
              <div style={{ maxWidth: 320, marginBottom: 12 }}>
                <Select label="Account" value={ledgerAccount} onChange={(e) => setLedgerAccount(e.target.value)}>
                  {accounts.map((account) => <option key={account.id} value={account.code}>{account.code} - {account.name}</option>)}
                </Select>
              </div>
              <Card padding="0"><Table columns={ledgerColumns} data={ledgerRows} emptyMsg="No ledger activity for this account" /></Card>
            </>
          )}

          {activeTab === 'statements' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              <Card>
                <h2 style={{ fontSize: 15, marginBottom: 12 }}>Trial Balance</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Total debit</span><b>{money(trialBalance?.total_debit)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Total credit</span><b>{money(trialBalance?.total_credit)}</b></div>
                <div style={{ marginTop: 10 }}><Badge variant={trialBalance?.balanced ? 'success' : 'danger'}>{trialBalance?.balanced ? 'balanced' : 'out of balance'}</Badge></div>
              </Card>
              <Card>
                <h2 style={{ fontSize: 15, marginBottom: 12 }}>Profit and Loss</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Revenue</span><b>{money(profitLoss?.total_revenue)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Expenses</span><b>{money(profitLoss?.total_expenses)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}><span>Net income</span><b>{money(profitLoss?.net_income)}</b></div>
              </Card>
              <Card>
                <h2 style={{ fontSize: 15, marginBottom: 12 }}>Balance Sheet</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Assets</span><b>{money(balanceSheet?.total_assets)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Liabilities + equity</span><b>{money(balanceSheet?.total_liabilities_and_equity)}</b></div>
                <div style={{ marginTop: 10 }}><Badge variant={balanceSheet?.balanced ? 'success' : 'danger'}>{balanceSheet?.balanced ? 'balanced' : 'out of balance'}</Badge></div>
              </Card>
            </div>
          )}

          {activeTab === 'cash' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <Card padding="0"><Table columns={[
                { key: 'name', label: 'Cash Account' },
                { key: 'code', label: 'Code' },
                { key: 'currency', label: 'Currency' },
                { key: 'balance', label: 'Balance', render: money },
              ]} data={cashAccounts} /></Card>
              <Card padding="0"><Table columns={[
                { key: 'bank_name', label: 'Bank' },
                { key: 'code', label: 'Code' },
                { key: 'account_number', label: 'Account #' },
                { key: 'balance', label: 'Balance', render: money },
              ]} data={bankAccounts} /></Card>
            </div>
          )}
        </>
      )}

      {showExpense && (
        <Modal title="Record expense" onClose={() => setShowExpense(false)} width={520}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Input label="Date" type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
            <Select label="Expense account" value={expenseForm.account_code} onChange={(e) => setExpenseForm({ ...expenseForm, account_code: e.target.value })}>
              {expenseAccounts.map((account) => <option key={account.id} value={account.code}>{account.code} - {account.name}</option>)}
            </Select>
            <Select label="Paid from" value={expenseForm.paid_from_account_code} onChange={(e) => setExpenseForm({ ...expenseForm, paid_from_account_code: e.target.value })}>
              {paymentAccounts.map((account) => <option key={account.id} value={account.code}>{account.code} - {account.name}</option>)}
            </Select>
            <Input label="Amount" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
            <Input label="Vendor" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} />
            <Input label="Notes" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={() => setShowExpense(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={submitExpense}>Post expense</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showJournal && (
        <Modal title="Manual journal entry" onClose={() => setShowJournal(false)} width={760}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Input label="Date" type="date" value={journalForm.entry_date} onChange={(e) => setJournalForm({ ...journalForm, entry_date: e.target.value })} />
            <Input label="Description" value={journalForm.description} onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })} />
            {journalForm.lines.map((line, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr', gap: 8 }}>
                <Select value={line.account_code} onChange={(e) => updateJournalLine(index, 'account_code', e.target.value)}>
                  <option value="">Account</option>
                  {accounts.map((account) => <option key={account.id} value={account.code}>{account.code} - {account.name}</option>)}
                </Select>
                <Input placeholder="Debit" type="number" value={line.debit} onChange={(e) => updateJournalLine(index, 'debit', e.target.value)} />
                <Input placeholder="Credit" type="number" value={line.credit} onChange={(e) => updateJournalLine(index, 'credit', e.target.value)} />
                <Input placeholder="Memo" value={line.line_memo} onChange={(e) => updateJournalLine(index, 'line_memo', e.target.value)} />
              </div>
            ))}
            <Btn size="sm" onClick={() => setJournalForm({ ...journalForm, lines: [...journalForm.lines, emptyJournalLine()] })}>+ Add line</Btn>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={() => setShowJournal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={submitJournal}>Post journal</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
