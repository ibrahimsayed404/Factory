# Backend Reference

This is the authoritative backend reference for routes, controllers, and exported service functions.

## Route Mounts

The route index mounts the following groups:

- Root routes: auth, dashboard, employees, sales, products, production, production tracking, payroll, QC, reports, settings, inventory
- `/purchasing`: purchasing routes
- `/manufacturing`: manufacturing routes
- `/hr`: HR routes
- `/accounting`: accounting routes

## API Routes by Module

### Auth and Device Ingestion

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/device/punch-events`

### Dashboard

- `GET /api/dashboard/stats`

### Inventory

- `GET /api/inventory`
- `GET /api/inventory/:id`
- `POST /api/inventory`
- `PUT /api/inventory/:id`
- `DELETE /api/inventory/:id`
- `POST /api/inventory/warehouses`
- `GET /api/inventory/warehouses`
- `POST /api/inventory/locations`
- `GET /api/inventory/locations`
- `POST /api/inventory/receive`
- `POST /api/inventory/issue`
- `POST /api/inventory/transfer`
- `POST /api/inventory/adjust`
- `GET /api/inventory-ledger/balances`
- `GET /api/inventory-ledger/history`

### Products

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

### Employees and Attendance

- `GET /api/departments`
- `GET /api/employees`
- `GET /api/employees/:id`
- `POST /api/employees`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `POST /api/employees/:id/attendance`
- `GET /api/employees/:id/attendance`

### Payroll

- `GET /api/payroll`
- `POST /api/payroll`
- `POST /api/payroll/monthly`
- `PUT /api/payroll/:id/pay`

### Sales and Customers

- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id/ledger`
- `POST /api/customers/:id/payments`
- `GET /api/sales/analytics`
- `GET /api/sales/outstanding-balances`
- `GET /api/sales`
- `GET /api/sales/:id`
- `POST /api/sales`
- `PUT /api/sales/:id/status`
- `DELETE /api/sales/:id`
- `GET /api/sales-quotations`
- `POST /api/sales-quotations`
- `POST /api/sales-quotations/:id/convert`
- `GET /api/sales-invoices`
- `POST /api/sales-invoices`
- `GET /api/delivery-notes`
- `POST /api/delivery-notes`
- `GET /api/sales-returns`
- `POST /api/sales-returns`
- `GET /api/credit-notes`
- `POST /api/credit-notes`

### Production

- `GET /api/production`
- `GET /api/production/:id`
- `POST /api/production`
- `PUT /api/production/:id/status`
- `PUT /api/production/work-orders/:workOrderId/complete`

### Production Tracking

- `GET /api/production-orders`
- `GET /api/production-orders/machines`
- `GET /api/production-orders/:id/report`
- `POST /api/production-orders`
- `POST /api/production-orders/:id/sorting`
- `POST /api/production-orders/:id/final`
- `DELETE /api/production-orders/:id`

### Manufacturing

- `GET /api/manufacturing/boms`
- `GET /api/manufacturing/boms/:id`
- `POST /api/manufacturing/boms`
- `GET /api/manufacturing/stages`
- `POST /api/manufacturing/stages`
- `GET /api/manufacturing/routings`
- `GET /api/manufacturing/routings/:id`
- `POST /api/manufacturing/routings`

### Purchasing

- `GET /api/purchasing/suppliers`
- `POST /api/purchasing/suppliers`
- `GET /api/purchasing/suppliers/:id/ledger`
- `GET /api/purchasing/suppliers/:id/performance`
- `GET /api/purchasing/requests`
- `POST /api/purchasing/requests`
- `GET /api/purchasing/requests/:id`
- `POST /api/purchasing/requests/:id/approve`
- `GET /api/purchasing/orders`
- `POST /api/purchasing/orders`
- `GET /api/purchasing/orders/:id`
- `POST /api/purchasing/orders/:id/approve`
- `POST /api/purchasing/orders/:id/order`
- `POST /api/purchasing/orders/:id/receive`
- `POST /api/purchasing/payments`

### HR

- `GET /api/hr/positions`
- `POST /api/hr/positions`
- `GET /api/hr/shifts`
- `POST /api/hr/shifts`
- `GET /api/hr/leaves`
- `POST /api/hr/leaves`
- `PUT /api/hr/leaves/:id/status`
- `GET /api/hr/transactions`
- `POST /api/hr/transactions`
- `DELETE /api/hr/transactions/:id`
- `GET /api/hr/loans`
- `POST /api/hr/loans`
- `GET /api/hr/employees/:employeeId/documents`
- `POST /api/hr/employees/:employeeId/documents`

### Reports

- `GET /api/reports/sales`
- `POST /api/reports/sales/expenses`
- `GET /api/reports/production`
- `GET /api/reports/hr`
- `GET /api/reports/inventory`

### Settings

- `GET /api/settings/attendance-payroll`
- `PUT /api/settings/attendance-payroll`

### Quality Control

- `GET /api/qc/defect-categories`
- `GET /api/qc/inspections`
- `GET /api/qc/inspections/:id`
- `POST /api/qc/inspections`
- `PUT /api/qc/inspections/:id/results`
- `POST /api/qc/inspections/:id/photos`
- `GET /api/qc/reports`

### Accounting

- `GET /api/accounting/accounts`
- `POST /api/accounting/accounts`
- `PUT /api/accounting/accounts/:id`
- `GET /api/accounting/cash-accounts`
- `POST /api/accounting/cash-accounts`
- `GET /api/accounting/bank-accounts`
- `POST /api/accounting/bank-accounts`
- `GET /api/accounting/journal-entries`
- `GET /api/accounting/journal-entries/:id`
- `POST /api/accounting/journal-entries`
- `GET /api/accounting/general-ledger`
- `GET /api/accounting/trial-balance`
- `GET /api/accounting/profit-loss`
- `GET /api/accounting/balance-sheet`
- `POST /api/accounting/expenses`

## Controller Export Catalog

### Auth Controller

- `register`
- `login`
- `refresh`
- `me`
- `logout`

### Dashboard Controller

- `getStats`

### Inventory Controller

- `getAll`
- `getOne`
- `create`
- `update`
- `remove`
- `createWarehouse`
- `getWarehouses`
- `createLocation`
- `getLocations`
- `receiveStock`
- `issueStock`
- `transferStock`
- `adjustStock`
- `getBalances`
- `getLedger`

### Employee Controller

- `getAll`
- `getOne`
- `create`
- `update`
- `remove`
- `logAttendance`
- `getAttendance`
- `getDepartments`

### Payroll Controller

- `getAll`
- `create`
- `markPaid`
- `generateMonthly`

### Sales Controller

- `getCustomers`
- `createCustomer`
- `getCustomerLedger`
- `createCustomerPayment`
- `getOrders`
- `getOrder`
- `createOrder`
- `updateStatus`
- `deleteOrder`
- `getQuotations`
- `createQuotation`
- `convertQuotation`
- `getInvoices`
- `createInvoice`
- `getDeliveryNotes`
- `createDeliveryNote`
- `getReturns`
- `createReturn`
- `getCreditNotes`
- `createCreditNote`
- `getOutstandingBalances`
- `getAnalytics`

### Production Controller

- `getAll`
- `getOne`
- `create`
- `updateStatus`
- `completeWorkOrder`

### Production Tracking Controller

- `list`
- `listMachines`
- `getReport`
- `createOrder`
- `addSortingPhase`
- `addFinalPhase`
- `deleteOrder`

### Purchasing Controller

- `createSupplier`
- `getSuppliers`
- `getSupplierLedger`
- `getSupplierPerformance`
- `createPurchaseRequest`
- `getPurchaseRequests`
- `getPurchaseRequestById`
- `approvePurchaseRequest`
- `createPurchaseOrder`
- `getPurchaseOrders`
- `getPurchaseOrderById`
- `approvePurchaseOrder`
- `markOrderAsOrdered`
- `receiveGoods`
- `paySupplier`

### HR Controller

- `getPositions`
- `createPosition`
- `getShifts`
- `createShift`
- `getLeaves`
- `createLeave`
- `updateLeaveStatus`
- `getTransactions`
- `createTransaction`
- `deleteTransaction`
- `getLoans`
- `createLoan`
- `getDocuments`
- `uploadDocument`

### Accounting Controller

- `listAccounts`
- `createAccount`
- `updateAccount`
- `listCashAccounts`
- `createCashAccount`
- `listBankAccounts`
- `createBankAccount`
- `listJournalEntries`
- `getJournalEntry`
- `createJournalEntry`
- `getGeneralLedger`
- `getTrialBalance`
- `getProfitLoss`
- `getBalanceSheet`
- `createExpense`

### QC Controller

- `getDefectCategories`
- `getAll`
- `getById`
- `create`
- `updateResults`
- `addPhoto`
- `getReports`

### Reports Controller

- `salesOverview`
- `createSalesExpense`
- `productionOverview`
- `hrOverview`
- `inventoryOverview`

### Settings Controller

- `getAttendancePayroll`
- `updateAttendancePayroll`

## Service Export Catalog

### Accounting Service

- `ACCOUNTS`
- `postJournalEntry`
- `listAccounts`
- `createAccount`
- `updateAccount`
- `listCashAccounts`
- `listBankAccounts`
- `createCashAccount`
- `createBankAccount`
- `listJournalEntries`
- `getJournalEntry`
- `getGeneralLedger`
- `getTrialBalance`
- `getProfitLoss`
- `getBalanceSheet`
- `createExpense`
- `postSalesInvoice`
- `postCustomerPayment`
- `postSalesCredit`
- `postPurchaseReceipt`
- `postSupplierPayment`
- `postPayrollAccrual`
- `postPayrollPayment`
- `postInventoryTransaction`
- `postProductionCompletion`

### Inventory Service

- `receiveStock`
- `issueStock`
- `reserveStock`
- `releaseReservation`
- `transferStock`
- `adjustStock`
- `getLedger`
- `getBalances`
- `getAvailability`
- `createWarehouse`
- `getWarehouses`
- `createLocation`
- `getLocations`

### Payroll Service

- `getPayroll`
- `generatePayroll`
- `generateMonthlyPayroll`
- `markPaid`

### Sales Service

- `listCustomers`
- `addCustomer`
- `getCustomerLedger`
- `addCustomerPayment`
- `listSalesOrders`
- `getSalesOrder`
- `createSalesOrder`
- `updateOrderStatus`
- `removeOrder`
- `listQuotations`
- `createQuotation`
- `convertQuotationToOrder`
- `listInvoices`
- `createInvoiceFromOrder`
- `listDeliveryNotes`
- `createDeliveryNote`
- `listReturns`
- `createReturn`
- `listCreditNotes`
- `createCreditNote`
- `getOutstandingBalances`
- `getCustomerAnalytics`

### Production Service

- `getProductionOrders`
- `getProductionOrderById`
- `createProductionOrder`
- `updateProductionStatus`
- `completeWorkOrder`

### Production Tracking Service

- `listProductionOrders`
- `createProductionOrder`
- `addProductionPhase`
- `getProductionOrderReport`
- `listMachines`
- `deleteOrder`
- `PHASE_SORTING`
- `PHASE_FINAL`

### Purchasing Service

- `createSupplier`
- `getSuppliers`
- `getSupplierLedger`
- `createPurchaseRequest`
- `getPurchaseRequests`
- `getPurchaseRequestById`
- `approvePurchaseRequest`
- `createPurchaseOrder`
- `getPurchaseOrders`
- `getPurchaseOrderById`
- `approvePurchaseOrder`
- `markOrderAsOrdered`
- `receiveGoods`
- `paySupplier`
- `getSupplierPerformance`

### HR Service

- `getPositions`
- `createPosition`
- `getShifts`
- `createShift`
- `getLeaves`
- `createLeave`
- `updateLeaveStatus`
- `getTransactions`
- `createTransaction`
- `deleteTransaction`
- `getLoans`
- `createLoan`
- `getDocuments`
- `uploadDocument`

### Employee Service

- `listEmployees`
- `getEmployee`
- `addEmployee`
- `updateEmployee`
- `removeEmployee`
- `logAttendance`
- `getAttendance`
- `listDepartments`

### Product Service

- `listProducts`
- `getProduct`
- `addProduct`
- `updateProduct`
- `removeProduct`

### QC Service

- `getDefectCategories`
- `getAll`
- `getById`
- `create`
- `updateResults`
- `addPhoto`
- `getReports`

### BOM Service

- `createBom`
- `getBoms`
- `getBomById`

### Routing Service

- `getProductionStages`
- `createProductionStage`
- `createRouting`
- `getRoutings`
- `getRoutingById`

### Auto Payroll Scheduler

- `startAutoPayrollScheduler`
- `runAutoPayrollForCurrentWeek`

### Audit Service

- `log`
- `extractReqContext`

### Attendance and Payroll Policy Utilities

- `getAttendancePayrollPolicy`
- `updateAttendancePayrollPolicy`

## Legacy Compatibility Notes

- `factory-api/src/routes/inventoryRoutes.js` remains in the repo as a legacy compatibility route file.
- The active route index uses `inventory.routes.js`.
