/* eslint-disable react/prop-types */
import React, { Suspense, lazy } from 'react';
import { GlobalErrorBoundary } from './components/ui/GlobalErrorBoundary';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { Spinner } from './components/ui';

const Login      = lazy(() => import('./pages/Login'));
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Inventory  = lazy(() => import('./pages/Inventory'));
const Employees  = lazy(() => import('./pages/Employees'));
const Payroll    = lazy(() => import('./pages/Payroll'));
const Sales      = lazy(() => import('./pages/Sales'));
const Customers  = lazy(() => import('./pages/Customers'));
const Production = lazy(() => import('./pages/Production'));
const ProductionOrderCreate = lazy(() => import('./pages/ProductionOrderCreate'));
const ProductionSorting = lazy(() => import('./pages/ProductionSorting'));
const ProductionFinal = lazy(() => import('./pages/ProductionFinal'));
const ProductionTrackingReport = lazy(() => import('./pages/ProductionTrackingReport'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Reports    = lazy(() => import('./pages/Reports'));

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <GlobalErrorBoundary>
          <AuthProvider>
            <HashRouter>
              <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/"           element={<Protected><Dashboard /></Protected>} />
                  <Route path="/inventory"  element={<Protected><Inventory /></Protected>} />
                  <Route path="/employees"  element={<Protected><Employees /></Protected>} />
                  <Route path="/payroll"    element={<Protected><Payroll /></Protected>} />
                  <Route path="/sales"      element={<Protected><Sales /></Protected>} />
                  <Route path="/customers"  element={<Protected><Customers /></Protected>} />
                  <Route path="/production"  element={<Protected><Production /></Protected>} />
                  <Route path="/production-orders/create" element={<Protected><ProductionOrderCreate /></Protected>} />
                  <Route path="/production-orders/sorting" element={<Protected><ProductionSorting /></Protected>} />
                  <Route path="/production-orders/final" element={<Protected><ProductionFinal /></Protected>} />
                  <Route path="/production-orders/report" element={<Protected><ProductionTrackingReport /></Protected>} />
                  <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
                  <Route path="/reports"    element={<Protected><Reports /></Protected>} />
                  <Route path="*"           element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </HashRouter>
          </AuthProvider>
        </GlobalErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  );
}
