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

const Login      = lazy(() => import('./features/auth/Login'));
const Dashboard  = lazy(() => import('./features/dashboard/Dashboard'));
const Inventory  = lazy(() => import('./features/inventory/Inventory'));
const Employees  = lazy(() => import('./features/employees/Employees'));
const Payroll    = lazy(() => import('./features/payroll/Payroll'));
const Loans      = lazy(() => import('./features/loans/Loans'));
const Sales      = lazy(() => import('./features/sales/Sales'));
const Customers  = lazy(() => import('./features/sales/Customers'));
const Production = lazy(() => import('./features/production/Production'));
const ProductionPipeline = lazy(() => import('./features/production/ProductionPipeline'));
const ProductionOrderCreate = lazy(() => import('./features/production/ProductionOrderCreate'));
const ProductionSorting = lazy(() => import('./features/production/ProductionSorting'));
const ProductionOutsourcing = lazy(() => import('./features/production/ProductionOutsourcing'));
const ProductionFinal = lazy(() => import('./features/production/ProductionFinal'));
const ProductionTrackingReport = lazy(() => import('./features/production/ProductionTrackingReport'));
const ProductionOrderManage = lazy(() => import('./features/production/ProductionOrderManage'));
const ProductionCutting = lazy(() => import('./features/production/ProductionCutting'));
const ProductionSortingPhase = lazy(() => import('./features/production/ProductionSortingPhase'));
const ProductionPrintingPhase = lazy(() => import('./features/production/ProductionPrintingPhase'));
const ProductionDeliveryPhase = lazy(() => import('./features/production/ProductionDeliveryPhase'));
const PrintShops = lazy(() => import('./features/printShops/PrintShops'));
const ProductionTrackingBoard = lazy(() => import('./features/production/ProductionTrackingBoard'));
const Attendance = lazy(() => import('./features/attendance/Attendance'));
const Reports    = lazy(() => import('./features/reports/Reports'));
const Accounting = lazy(() => import('./features/accounting/Accounting'));
const Products   = lazy(() => import('./features/products/Products'));
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
                  <Route path="/loans"      element={<Protected><Loans /></Protected>} />
                  <Route path="/sales"      element={<Protected><Sales /></Protected>} />
                  <Route path="/customers"  element={<Protected><Customers /></Protected>} />
                  <Route path="/accounting" element={FEATURE_FLAGS.accounting ? <Protected><Accounting /></Protected> : <Navigate to="/" replace />} />
                  <Route path="/production"  element={<Protected><ProductionTrackingBoard /></Protected>} />
                  <Route path="/production-pipeline" element={<Protected><ProductionTrackingBoard /></Protected>} />
                  <Route path="/production-orders/cutting" element={<Protected><ProductionCutting /></Protected>} />
                  <Route path="/production-orders/create" element={<Protected><ProductionCutting /></Protected>} />
                  <Route path="/production-orders/sorting" element={<Protected><ProductionSortingPhase /></Protected>} />
                  <Route path="/production-orders/printing" element={<Protected><ProductionPrintingPhase /></Protected>} />
                  <Route path="/production-orders/outsourcing" element={<Protected><ProductionPrintingPhase /></Protected>} />
                  <Route path="/production-orders/delivery" element={<Protected><ProductionDeliveryPhase /></Protected>} />
                  <Route path="/production-orders/final" element={<Protected><ProductionDeliveryPhase /></Protected>} />
                  <Route path="/print-shops" element={<Protected><PrintShops /></Protected>} />
                  <Route path="/production-orders/report" element={<Protected><ProductionTrackingBoard /></Protected>} />
                  <Route path="/production-orders/manage" element={<Protected><ProductionTrackingBoard /></Protected>} />
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
