# Factory Desktop App (Electron)

This Electron app launches both the backend (Node.js/Express) and the frontend (React) for your factory management system as a single Windows desktop application.

## Usage

1. **Install dependencies:**
   ```
   cd factory-desktop
   npm install
   ```
2. **Build the React frontend:**
   ```
   cd ../factory-client
   npm install
   npm run build
   ```
3. **Start the desktop app:**
   ```
   cd ../factory-desktop
   npm start
   ```

## Packaging for Windows

To create a distributable `.exe`:

```
cd factory-desktop
npm run dist
```

## Notes
- The backend is started automatically and killed when the app closes.
- The frontend is loaded from `http://localhost:3000` (served by the backend or `serve`).
- Make sure PostgreSQL is running locally.
- You can customize environment variables in `main.js`.
