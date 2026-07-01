# Frontend Reference

## Frontend Stack

- React with React Router
- Vite build pipeline
- Recharts for charts
- Shared UI system in `src/components/ui`
- Global auth, theme, and language providers

## Application Shell

- `src/App.jsx` wires all routes behind a protected layout
- `src/components/layout/Layout.jsx` renders the sidebar, top area, and user footer
- `src/context/AuthContext` manages login state and token refresh
- `src/context/ThemeContext` manages the visual theme
- `src/context/LanguageContext` manages i18n labels

## Routes and Pages

### Primary Routes

- `/login` - login screen
- `/` - dashboard
- `/inventory` - materials and stock management
- `/purchasing` - purchase request and order workflows
- `/products` - product catalog
- `/employees` - employee management
- `/payroll` - payroll generation and payment
- `/sales` - sales orders and sales workflow
- `/customers` - customer ledger and payments
- `/accounting` - finance workspace
- `/production` - production operations workspace
- `/production-pipeline` - kanban pipeline
- `/production-orders/create` - production order creation
- `/production-orders/sorting` - sorting phase board
- `/production-orders/final` - final phase board
- `/production-orders/report` - production tracking report
- `/manufacturing/boms` - bill of materials
- `/manufacturing/routings` - routings editor
- `/attendance` - attendance logs and punches
- `/qc/inspections` - QC inspection list
- `/qc/inspections/:id` - QC inspection detail
- `/qc/reports` - QC reports
- `/reports` - sales, production, HR, inventory reports

### Page Inventory

- `Login.jsx` - authentication form
- `Dashboard.jsx` - summary cards and charts
- `Inventory.jsx` - materials list, CRUD, low stock view
- `Products.jsx` - products list and editing
- `Employees.jsx` - employees list and CRUD
- `Attendance.jsx` - attendance review and logging
- `Payroll.jsx` - payroll list, generation, and pay action
- `Sales.jsx` - orders, item editor, status control
- `Customers.jsx` - customer CRUD, ledger, and payment entry
- `Accounting.jsx` - chart of accounts, journals, ledger, trial balance, P&L, balance sheet
- `Purchasing.jsx` - supplier and procure-to-pay workspace
- `Production.jsx` - production order execution view
- `ProductionPipeline.jsx` - kanban-style workflow pipeline
- `ProductionOrderCreate.jsx` - production order wizard
- `ProductionSorting.jsx` - sorting phase actions
- `ProductionFinal.jsx` - final phase actions
- `ProductionTrackingReport.jsx` - production progress report
- `BOM.jsx` - bill of materials management
- `Routings.jsx` - routing configuration
- `QCInspections.jsx` - inspection list
- `QCInspectionDetail.jsx` - inspection drill-down
- `QCReports.jsx` - defect and inspection reports
- `Reports.jsx` - aggregate reporting dashboard
- `AttendancePayrollSettings.jsx` - attendance/payroll policy settings

## UI System

The shared UI layer exports the common primitives used across the app:

- Cards
- Tables
- Buttons
- Inputs
- Selects
- Modals
- Spinners
- Alerts and error messages
- Page headers

## Client API Groups

The frontend API client groups backend calls into these domains:

- `authApi`
- `dashboardApi`
- `inventoryApi`
- `productApi`
- `employeeApi`
- `payrollApi`
- `salesApi`
- `reportsApi`
- `settingsApi`
- `accountingApi`
- `productionApi`
- `manufacturingApi`
- `productionTrackingApi`
- `qcApi`

### Important Sales API Methods

- customer CRUD
- customer ledger
- customer payments
- sales order CRUD and status changes
- quotations and quotation conversion
- invoices
- delivery notes
- returns
- credit notes
- outstanding balances
- customer analytics

### Important Accounting API Methods

- accounts CRUD
- cash and bank account CRUD
- journal entry CRUD
- general ledger
- trial balance
- profit and loss
- balance sheet
- expense creation

### Important Production API Methods

- production order list and detail
- production order creation
- production status updates
- work-order completion

### Important Manufacturing API Methods

- BOMs
- production stages
- routings

## Navigation Structure

The sidebar groups the app into:

- Main: Dashboard
- Operations: Production, BOMs, Routings, pipeline, order creation, sorting, final, reports, products, inventory, purchasing, QC
- People: Employees, Attendance, Payroll
- Business: Sales, Customers, Accounting, Reports
