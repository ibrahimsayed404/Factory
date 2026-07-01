# Database and Automation

## Database Design

The schema is a single PostgreSQL database that contains operational tables, finance tables, and workflow tables.

### Core Tables

- Users and refresh tokens
- Audit logs
- App settings
- Departments
- Employees
- Attendance
- Payroll
- Inventory transactions and inventory balances
- Materials and products
- Customers and sales documents
- Purchase requests, purchase orders, and supplier payments
- BOMs, routings, stages, production orders, work orders
- QC inspections and defect categories
- Accounting accounts, journals, and expenses

### Accounting Tables

- `chart_of_accounts`
- `cash_accounts`
- `bank_accounts`
- `accounting_expenses`
- `accounting_journal_entries`
- `accounting_journal_lines`

### Sales Tables

- `customers`
- `quotations`
- `quotation_items`
- `sales_orders`
- `sales_order_items`
- `invoices`
- `invoice_items`
- `delivery_notes`
- `delivery_note_items`
- `sales_returns`
- `sales_return_items`
- `credit_notes`
- `credit_note_items`
- `customer_payments`
- `customer_payment_allocations`

### Production Tables

- `production_orders`
- `production_phases`
- `production_materials`
- `work_orders`
- `work_order_materials`

### Manufacturing Tables

- `boms`
- `bom_materials`
- `production_stages`
- `routings`
- `routing_steps`

### Purchasing Tables

- `suppliers`
- `purchase_requests`
- `purchase_request_items`
- `purchase_orders`
- `purchase_order_items`
- `supplier_payments`
- `purchase_returns`
- `purchase_return_items`

## Inventory Logic

Inventory is tracked through transaction rows and balance rows.

- `in` increases on-hand quantity
- `out` decreases on-hand quantity
- `reserve` increases reserved quantity without reducing on-hand again
- `transfer` uses paired out/in transactions
- `adjustment`, `damage`, and `audit` support correction flows

### Inventory Triggers

- The inventory balance trigger updates `inventory_balances`
- The product quantity trigger ignores reservation rows so reservations do not double-deduct stock
- Materials table quantities are kept in sync with material inventory movements

## Accounting Automation

The accounting service posts double-entry journal entries from operational events.

### From Sales

- Invoices debit Accounts Receivable and credit Sales Revenue
- Taxes can credit Sales Tax Payable
- Customer payments debit Cash or Bank and credit Accounts Receivable
- Sales returns and credit notes debit Sales Returns and credit Accounts Receivable

### From Purchasing

- Purchase receipts debit Inventory and credit Accounts Payable
- Supplier payments debit Accounts Payable and credit Bank

### From Payroll

- Payroll accruals debit Payroll Expense and credit Payroll Payable
- Payroll payments debit Payroll Payable and credit Bank

### From Inventory

- Inventory transactions can post inventory, COGS, WIP, or adjustment entries depending on reference type

### From Production

- Production completion debits Inventory and credits Work in Process

## Sales and Stock Rules

- Stocked products are checked against available quantity before sales order creation or shipment
- Sales reservations are stored separately from on-hand stock
- Shipping issues inventory only once
- Free-text or make-to-order items can still generate production work orders

## Production Rules

There are two supported production patterns:

1. Legacy order creation from product name plus materials
2. BOM and routing driven production orders

The production status flow supports:

- pending
- in_progress
- done
- shipped

## Reporting Derivations

- Trial balance aggregates posted journal lines by account
- Profit and loss uses revenue and expense accounts
- Balance sheet uses asset, liability, equity, revenue, and expense accounts with retained earnings derived from P&L style activity
