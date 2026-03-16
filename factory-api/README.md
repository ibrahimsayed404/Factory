# Factory API — Clothes Factory Management System

## Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Auth**: JWT (Bearer token)

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your values
cp .env.example .env

# 3. Create the database
createdb factory_db

# 4. Run the schema
psql -d factory_db -f src/db/schema.sql

# 5. Start development server
npm run dev

# 6. (One-time) create initial admin user
npm run bootstrap:admin

# 7. Run security/index migration (safe for existing envs)
npm run migrate
```

## Security & Ops Scripts

```bash
# Ensure target DB exists
npm run db:ensure

# Apply migration file (includes attendance constraint + indexes)
npm run migrate

# Run integration tests (auth, attendance upsert, production stock guards)
npm run test:integration
```

---

## API Reference

All protected routes require authentication.

- Browser clients use an `httpOnly` cookie set by `POST /api/auth/login`.
- Bearer tokens are also accepted for non-browser clients.

---

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user info |

**Login body:**
```json
{ "email": "admin@factory.com", "password": "secret" }
```

---

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Summary: orders, revenue, employees, alerts |

---

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | List all materials |
| GET | `/api/inventory?low_stock=true` | Filter low stock items |
| GET | `/api/inventory?category=fabric` | Filter by category |
| GET | `/api/inventory/:id` | Get single material |
| POST | `/api/inventory` | Add new material |
| PUT | `/api/inventory/:id` | Update material |
| DELETE | `/api/inventory/:id` | Delete material |

**Create body:**
```json
{
  "name": "Cotton fabric",
  "category": "fabric",
  "unit": "meters",
  "quantity": 500,
  "min_quantity": 50,
  "cost_per_unit": 3.5,
  "supplier": "Nile Textiles"
}
```

---

### Employees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/departments` | List departments |
| GET | `/api/employees` | List employees |
| GET | `/api/employees?status=active` | Filter by status |
| GET | `/api/employees?department_id=2` | Filter by department |
| GET | `/api/employees/:id` | Get single employee |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Delete employee |
| POST | `/api/employees/:id/attendance` | Log attendance |
| GET | `/api/employees/:id/attendance?month=3&year=2026` | Get attendance |

---

### Payroll
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payroll?month=3&year=2026` | List payroll records |
| POST | `/api/payroll` | Generate payroll entry |
| PUT | `/api/payroll/:id/pay` | Mark as paid |

---

### Sales & Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers |
| POST | `/api/customers` | Create customer |
| GET | `/api/sales` | List sales orders |
| GET | `/api/sales?status=shipped` | Filter by status |
| GET | `/api/sales/:id` | Get order with items |
| POST | `/api/sales` | Create sales order |
| PUT | `/api/sales/:id/status` | Update order status/payment |

**Create sales order body:**
```json
{
  "customer_id": 1,
  "delivery_date": "2026-04-01",
  "notes": "Rush order",
  "items": [
    { "product_name": "Men's linen shirt", "quantity": 200, "unit_price": 12.5 }
  ]
}
```

---

### Production
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/production` | List production orders |
| GET | `/api/production?status=in_progress` | Filter by status |
| GET | `/api/production/:id` | Get order with materials |
| POST | `/api/production` | Create production order |
| PUT | `/api/production/:id/status` | Update status / qty produced |

**Create production order body:**
```json
{
  "product_name": "Men's linen shirt",
  "quantity": 200,
  "sales_order_id": 1,
  "assigned_to": 3,
  "start_date": "2026-03-15",
  "due_date": "2026-03-20",
  "materials": [
    { "material_id": 1, "quantity_used": 120 },
    { "material_id": 4, "quantity_used": 400 }
  ]
}
```

---

## Project Structure

```
factory-api/
├── config/
│   └── db.js              # PostgreSQL pool
├── src/
│   ├── index.js            # Express app entry point
│   ├── db/
│   │   └── schema.sql      # Full DB schema
│   ├── routes/
│   │   └── index.js        # All route definitions
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── inventoryController.js
│   │   ├── employeeController.js
│   │   ├── payrollController.js
│   │   ├── salesController.js
│   │   ├── productionController.js
│   │   └── dashboardController.js
│   └── middleware/
│       ├── auth.js          # JWT middleware
│       └── errorHandler.js  # Global error handler
├── .env.example
└── package.json
```
