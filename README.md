# Factory Management System

> A full-featured ERP platform for clothes manufacturing — covering sales, accounting, inventory, purchasing, production, payroll, HR, quality control, and reporting in one connected system.

![JavaScript](https://img.shields.io/badge/JavaScript-89.6%25-yellow)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)
![Status](https://img.shields.io/badge/status-active-brightgreen)

## Overview

Factory is a production-grade, multi-module ERP built to run a real manufacturing operation end-to-end. It replaces manual, paper-based, and spreadsheet-driven workflows with a single connected platform — from raw material purchasing to finished-product sales, with integrated payroll, HR, and biometric attendance tracking.

## Table of Contents

- [Key Modules](#key-modules)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Security](#security)
- [Roadmap](#roadmap)
- [License](#license)

## Key Modules

| Module | Description |
|---|---|
| **Sales** | Order management and customer tracking |
| **Accounting** | Financial records and reporting |
| **Inventory** | Stock levels for raw materials and finished goods |
| **Purchasing** | Supplier orders and procurement |
| **Production** | Real-time production tracking and efficiency dashboards |
| **Payroll** | Automated salary calculation — shift-based hours, overtime, late deductions, mid-month proration |
| **HR** | Employee records and management |
| **Attendance** | Biometric fingerprint integration (ZKTeco) with a standalone sync agent for real-time clock-in/clock-out |
| **Quality Control (QC)** | Inspection and quality tracking across production |
| **Reporting** | Cross-module operational and financial reports |

## Tech Stack

- **Backend:** Node.js — `factory-api`
- **Frontend:** React — `factory-client`
- **Desktop:** `factory-desktop` (Windows service-based on-premise deployment)
- **Database:** PostgreSQL
- **Hardware Integration:** ZKTeco biometric devices via a dedicated Node.js sync agent
- **Deployment:** Vercel (cloud) + Windows service scripts (on-premise)
- **CI/CD:** GitHub Actions

## Project Structure

```
Factory/
├── factory-api/          # Backend REST API
├── factory-client/       # React frontend
├── factory-desktop/      # Desktop/on-premise runner
├── docs/                 # Full documentation
├── .env.example           # Environment variable template
├── docker-compose.yml     # Container orchestration
└── run-factory-*.ps1/bat  # Local/on-premise setup scripts
```

## Documentation

- [System Overview](docs/system-overview.md)
- [Backend Reference](docs/backend-reference.md)
- [Frontend Reference](docs/frontend-reference.md)
- [Database & Automation](docs/database-and-automation.md)
- [Operations Guide](docs/operations.md)

## Quick Start

1. Install backend dependencies in `factory-api`
2. Install frontend dependencies in `factory-client`
3. Copy `.env.example` to `factory-api/.env` and configure database and JWT values
4. Start the backend and frontend

```bash
# Backend
cd factory-api
npm install
npm start

# Frontend
cd factory-client
npm install
npm start
```

## API Documentation

Swagger UI available at: `http://localhost:5000/api/docs`

## Testing

- **Backend:** `cd factory-api && npm test`
- **Frontend:** `cd factory-client && npm run build`

## CI/CD

Automated tests and linting run on every push via GitHub Actions.

## Security

- Regular security audits covering authentication flows and credential handling
- Sensitive data (passwords, tokens) is never transmitted via URL query strings
- Environment-based configuration keeps secrets out of source control

## Roadmap

- [ ] Expand QC module reporting
- [ ] Mobile companion app
- [ ] Multi-factory / multi-branch support

## License

[Add license here]

---

**Maintainer:** [Ibrahim Sayed](https://github.com/ibrahimsayed404)
