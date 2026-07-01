/* eslint-disable react/prop-types */
import React, { Suspense, lazy } from 'react';
import { GlobalErrorBoundary } from './components/ui/GlobalErrorBoundary';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { Spinner } from './components/ui';
import { FEATURE_FLAGS } from './config/featureFlags';

const Login      = lazy(() => import('./pages/Login'));
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Inventory  = lazy(() => import('./pages/Inventory'));
const Employees  = lazy(() => import('./pages/Employees'));
const Payroll    = lazy(() => import('./pages/Payroll'));
const Sales      = lazy(() => import('./pages/Sales'));
const Customers  = lazy(() => import('./pages/Customers'));
const Production = lazy(() => import('./pages/Production'));
const ProductionPipeline = lazy(() => import('./pages/ProductionPipeline'));
const ProductionOrderCreate = lazy(() => import('./pages/ProductionOrderCreate'));
const ProductionSorting = lazy(() => import('./pages/ProductionSorting'));
const ProductionFinal = lazy(() => import('./pages/ProductionFinal'));
const ProductionTrackingReport = lazy(() => import('./pages/ProductionTrackingReport'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Reports    = lazy(() => import('./pages/Reports'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Products   = lazy(() => import('./pages/Products'));
const Purchasing = lazy(() => import('./pages/Purchasing'));
const Bom        = lazy(() => import('./pages/BOM'));
const Routings   = lazy(() => import('./pages/Routings'));
const QCInspections = lazy(() => import('./pages/QCInspections'));
const QCInspectionDetail = lazy(() => import('./pages/QCInspectionDetail'));
const QCReports = lazy(() => import('./pages/QCReports'));

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
                  <Route path="/purchasing" element={FEATURE_FLAGS.purchasing ? <Protected><Purchasing /></Protected> : <Navigate to="/" replace />} />
                  <Route path="/products"   element={<Protected><Products /></Protected>} />
                  <Route path="/employees"  element={<Protected><Employees /></Protected>} />
                  <Route path="/payroll"    element={<Protected><Payroll /></Protected>} />
                  <Route path="/sales"      element={<Protected><Sales /></Protected>} />
                  <Route path="/customers"  element={<Protected><Customers /></Protected>} />
                  <Route path="/accounting" element={FEATURE_FLAGS.accounting ? <Protected><Accounting /></Protected> : <Navigate to="/" replace />} />
                  <Route path="/production"  element={<Protected><Production /></Protected>} />
                  <Route path="/production-pipeline" element={FEATURE_FLAGS.productionPipeline ? <Protected><ProductionPipeline /></Protected> : <Navigate to="/" replace />} />
                  <Route path="/production-orders/create" element={<Protected><ProductionOrderCreate /></Protected>} />
                  <Route path="/production-orders/sorting" element={<Protected><ProductionSorting /></Protected>} />
                  <Route path="/production-orders/final" element={<Protected><ProductionFinal /></Protected>} />
                  <Route path="/production-orders/report" element={<Protected><ProductionTrackingReport /></Protected>} />
                  <Route path="/manufacturing/boms" element={FEATURE_FLAGS.manufacturingBoms ? <Protected><Bom /></Protected> : <Navigate to="/" replace />} />
                  <Route path="/manufacturing/routings" element={FEATURE_FLAGS.manufacturingRoutings ? <Protected><Routings /></Protected> : <Navigate to="/" replace />} />
                  <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
                  <Route path="/qc/inspections" element={FEATURE_FLAGS.qcInspections ? <Protected><QCInspections /></Protected> : <Navigate to="/" replace />} />
                  <Route path="/qc/inspections/:id" element={FEATURE_FLAGS.qcInspections ? <Protected><QCInspectionDetail /></Protected> : <Navigate to="/" replace />} />
                  <Route path="/qc/reports" element={FEATURE_FLAGS.qcReports ? <Protected><QCReports /></Protected> : <Navigate to="/" replace />} />
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
