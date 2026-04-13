# Factory Management System

## Setup

1. Clone the repo
2. Install dependencies:
   - `cd factory-api && npm install`
   - `cd ../factory-client && npm install`
3. Set up environment variables:
   - Copy `.env.example` to `.env` in `factory-api` and fill in DB/JWT values
4. Start backend:
   - `cd factory-api && npm start`
5. Start frontend:
   - `cd factory-client && npm start`

## Testing

- Backend: `cd factory-api && npm test`
- Frontend: `cd factory-client && npm test`

## Linting & Formatting

- Lint: `npm run lint`
- Format: `npm run format`

## API Docs

- Swagger UI: [http://localhost:5000/api/docs](http://localhost:5000/api/docs)

## CI/CD

- Automated tests and lint run on every push via GitHub Actions.
