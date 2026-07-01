# Factory Management System

Factory is a clothes manufacturing ERP covering sales, accounting, inventory, purchasing, production, payroll, HR, QC, and reporting.

## Documentation

- [System Overview](docs/system-overview.md)
- [Backend Reference](docs/backend-reference.md)
- [Frontend Reference](docs/frontend-reference.md)
- [Database and Automation](docs/database-and-automation.md)
- [Operations Guide](docs/operations.md)

## Quick Start

1. Install backend dependencies in `factory-api`
2. Install frontend dependencies in `factory-client`
3. Copy `.env.example` to `factory-api/.env` and configure database and JWT values
4. Start the backend and frontend

## API Documentation

- Swagger UI: http://localhost:5000/api/docs

## Verification

- Backend: `cd factory-api && npm test`
- Frontend: `cd factory-client && npm run build`

## CI/CD

- Automated tests and lint run on every push via GitHub Actions.
