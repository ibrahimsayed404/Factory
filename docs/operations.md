# Operations Guide

## Setup

### Backend

1. Install dependencies in `factory-api`
2. Copy `.env.example` to `.env`
3. Configure PostgreSQL connection values and JWT secret
4. Run `npm run db:ensure`
5. Run `npm run migrate`
6. Start the API with `npm run dev`

### Frontend

1. Install dependencies in `factory-client`
2. Optionally set `VITE_API_URL`
3. Start the frontend with `npm start`

### Desktop

- `factory-desktop/main.js` runs the Electron shell

## Scripts

### Root

- `run-factory-all.bat` - launch full stack on Windows
- `run-factory-desktop.ps1` - launch desktop wrapper
- `setup-factory-all.ps1` - install and prepare all packages
- `setup-factory-api-service.ps1` - configure API as a service
- `setup-factory-client-service.ps1` - configure client as a service

### API

- `npm start` - run backend
- `npm run dev` - run backend with nodemon
- `npm run db:ensure` - create database if needed
- `npm run migrate` - apply safe migrations
- `npm test` - run integration suite
- `npm run lint` - lint backend
- `npm run format` - format backend code

### Client

- `npm start` - run Vite dev server
- `npm run build` - production build
- `npm test` - run frontend tests
- `npm run lint` - lint frontend
- `npm run format` - format frontend code

## Test Coverage

Backend integration tests currently cover:

- Authentication and cookie/session behavior
- Attendance upsert behavior
- Production stock deduction safety
- Payroll auto adjustments
- Device punch ingestion
- Paid payroll spend reporting
- Customer payment ledger
- Inventory ledger behavior
- Purchasing flow
- Production tracking phases
- Manufacturing workflow
- QC workflow

## Deployment Notes

- The root app uses route grouping under `/api`
- Swagger UI is available at `/api/docs`
- Client build output is generated with Vite in `factory-client/build`
- The system supports both browser cookie auth and bearer tokens

## Troubleshooting

- If the backend test database is missing, run the database ensure and migration scripts first
- If inventory or sales stock actions fail, check warehouse and location seed rows in the test database
- If payroll values look like strings in a response, the API normalizes them in the current codebase for client compatibility
- A Jest open-handle warning can appear even when tests pass; it does not fail the suite
