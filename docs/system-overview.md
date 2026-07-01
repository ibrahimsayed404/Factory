# System Overview

Factory is a full-stack factory management system for clothes manufacturing.
It combines operations, finance, HR, inventory, production, purchasing, QC, and reporting into one application.

## Architecture

- Backend: Node.js, Express, PostgreSQL
- Frontend: React, React Router, Vite
- Desktop shell: Electron-based wrapper in `factory-desktop`
- Shared communication: JSON REST API under `/api`
- Authentication: JWT access tokens plus refresh tokens and `httpOnly` cookie support

## Primary Modules

### Core Operations

- Dashboard summaries and alert cards
- Inventory materials and product stock
- Employees, attendance, and payroll
- Sales orders, customers, and customer payments
- Production order tracking and manufacturing flow
- Purchasing from request through receipt and payment
- Quality control inspections and defect reporting

### Finance

- Chart of Accounts
- Journal Entries
- General Ledger
- Cash Accounts
- Bank Accounts
- Trial Balance
- Profit and Loss
- Balance Sheet
- Expense posting

### Automation

- Sales events generate accounting entries and production orders when needed
- Purchases generate inventory and AP entries
- Payroll accruals and payments generate journal entries
- Inventory transactions post accounting entries where appropriate
- Production completion posts WIP and finished goods accounting entries
- Auto payroll scheduler can generate weekly payroll on Saturdays
- Device punch ingestion can upsert attendance records

## Runtime Entry Points

- Backend app: `factory-api/src/index.js`
- Express app: `factory-api/src/app.js`
- Frontend app: `factory-client/src/App.jsx`
- Desktop launcher: `factory-desktop/main.js`

## Role Model

- `admin`: full access
- `manager`: operational approvals and purchasing flows
- `staff`: limited operational access
- `hr`: HR-scoped access where the route allows it
- `finance`: finance-scoped access where the route allows it

## Important Design Notes

- Stock can be reserved without reducing on-hand stock twice.
- Sales blocks overselling of stocked products.
- Free-text or make-to-order sales items can still generate production work.
- Accounting uses a single journal as the source of truth.
- Financial statements are derived from posted journal lines, not from duplicated summary tables.
