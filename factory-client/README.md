# FabriCore — React Frontend

## Stack
- **React 18** with React Router v6
- **Recharts** for dashboard charts
- **DM Sans + DM Mono** fonts
- Dark-themed design system with CSS variables

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. (Optional) set API URL if backend is not on same host
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env

# 3. Start dev server
npm start
```

> The app proxies `/api` to `http://localhost:5000` automatically (configured in package.json).
> Make sure the backend API is running first.

---

## Project Structure

```
factory-client/
├── public/
│   └── index.html
└── src/
    ├── index.js              # Entry point
    ├── index.css             # Global styles + CSS variables
    ├── App.jsx               # Router + protected routes
    ├── api/
    │   └── index.js          # All API calls (auth, inventory, employees, etc.)
    ├── context/
    │   └── AuthContext.jsx   # Global auth state + JWT management
    ├── hooks/
    │   └── useFetch.js       # Generic data loading hook
    ├── components/
    │   ├── ui/index.jsx      # Design system: Badge, Btn, Card, Input, Table, Modal...
    │   └── layout/Layout.jsx # Sidebar + main shell
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx     # Stats + Recharts bar chart
        ├── Inventory.jsx     # Materials with low-stock filter
        ├── Employees.jsx     # Staff list with department filter
        ├── Payroll.jsx       # Month/year payroll with mark-paid
        ├── Sales.jsx         # Orders with inline items editor
        ├── Customers.jsx     # Customer management
        └── Production.jsx    # Production orders with status updates
```

---

## Pages Overview

| Page | Features |
|------|----------|
| Login | JWT auth, error handling |
| Dashboard | 4 metric cards, production bar chart |
| Inventory | CRUD, low-stock filter + badge count |
| Employees | CRUD, avatar initials, department/shift |
| Payroll | Month/year filter, generate + mark paid |
| Sales | Multi-item order creation, status update |
| Customers | CRUD with avatar initials |
| Production | Order creation, inline status dropdown |

---

## Running Both Frontend and Backend

```bash
# Terminal 1 — Backend
cd factory-api && npm run dev

# Terminal 2 — Frontend
cd factory-client && npm start
```

Frontend runs on http://localhost:3000
Backend runs on http://localhost:5000
