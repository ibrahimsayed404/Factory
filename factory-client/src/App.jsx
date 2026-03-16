import React from 'react';
import { GlobalErrorBoundary } from './components/ui/GlobalErrorBoundary';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Inventory  from './pages/Inventory';
import Employees  from './pages/Employees';
import Payroll    from './pages/Payroll';
import Sales      from './pages/Sales';
import Customers  from './pages/Customers';
import Production from './pages/Production';
import Attendance from './pages/Attendance';
import Reports    from './pages/Reports';
import { Spinner } from './components/ui';

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/"           element={<Protected><Dashboard /></Protected>} />
            <Route path="/inventory"  element={<Protected><Inventory /></Protected>} />
            <Route path="/employees"  element={<Protected><Employees /></Protected>} />
            <Route path="/payroll"    element={<Protected><Payroll /></Protected>} />
            <Route path="/sales"      element={<Protected><Sales /></Protected>} />
            <Route path="/customers"  element={<Protected><Customers /></Protected>} />
            <Route path="/production"  element={<Protected><Production /></Protected>} />
            <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
            <Route path="/reports"    element={<Protected><Reports /></Protected>} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}
