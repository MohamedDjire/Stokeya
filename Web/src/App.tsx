import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { bootstrapAuth } from './store/authSlice';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductImportPage = lazy(() => import('./pages/ProductImportPage'));
const POSPage = lazy(() => import('./pages/POSPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentErrorPage = lazy(() => import('./pages/PaymentErrorPage'));
const SitesPage = lazy(() => import('./pages/SitesPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const ScanPage = lazy(() => import('./pages/ScanPage'));
const LabelsPage = lazy(() => import('./pages/LabelsPage'));
const TraceabilityPage = lazy(() => import('./pages/TraceabilityPage'));
const StockRequestsPage = lazy(() => import('./pages/StockRequestsPage'));

function Loader() {
  return (
    <Box sx={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  if (status === 'idle' || status === 'loading') {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/import" element={<ProductImportPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/labels" element={<LabelsPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/traceability" element={<TraceabilityPage />} />
          <Route path="/requests" element={<StockRequestsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/payment/sale/:saleId" element={<PaymentPage />} />
          <Route path="/payment/subscription" element={<PaymentPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/error" element={<PaymentErrorPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
