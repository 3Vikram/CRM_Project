import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar'
import { AccountsSidebar } from '@/components/accounts-sidebar'
import { TopBar } from '@/components/top-bar'
import ModuleSelectPage from '@/pages/ModuleSelectPage'
import DashboardPage from '@/pages/DashboardPage'
import CustomersPage from '@/pages/CustomersPage'
import LeadsPage from '@/pages/LeadsPage'
import InventoryPage from '@/pages/InventoryPage'
import PurchaseOrdersPage from '@/pages/PurchaseOrdersPage'
import DCTrackingPage from '@/pages/DCTrackingPage'
import BillSalePage from '@/pages/BillSalePage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import SaleInvoicePage from '@/pages/accounts/SaleInvoicePage'
import LoginPage from '@/pages/accounts/LoginPage'
import { AccountingProvider } from '@/components/accounts/accounting-context'
import { AuthProvider } from '@/components/accounts/auth-provider'
import { RequireAuth } from '@/components/accounts/require-auth'
import { AccountingQueryProvider } from '@/components/accounts/query-provider'
import { useAuth } from '@/lib/auth'
import { PurchaseInvoicePage, JournalRegisterPage, BankPaymentsPage, LedgerPage, ProfitLossPage } from '@/pages/accounts/AccountingPages'
import BalanceSheetPage from '@/pages/accounts/BalanceSheetPage'
import ReportsPage from '@/pages/accounts/ReportsPage'

function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 ml-56">
        <TopBar />
        <main className="mt-16 p-8">{children}</main>
      </div>
    </div>
  )
}

function AccountsTopBar() {
  const { user } = useAuth()
  const initials = user
    ? user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('')
    : 'AC'
  return (
    <TopBar
      searchPlaceholder="Search invoices, ledger, reports..."
      userName={user?.name}
      userRole="Accounts · Finance"
      userInitials={initials}
    />
  )
}

function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AccountingQueryProvider>
      <AccountingProvider>
        <div className="flex">
          <AccountsSidebar />
          <div className="flex-1 ml-56">
            <AccountsTopBar />
            <main className="mt-16 p-8">{children}</main>
          </div>
        </div>
      </AccountingProvider>
      </AccountingQueryProvider>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        {/* Landing: choose a module */}
        <Route path="/" element={<ModuleSelectPage />} />

        {/* Accounts sign in */}
        <Route path="/login" element={<LoginPage />} />

        {/* Sales module — full CRM lives here */}
        <Route
          path="/sales"
          element={
            <SalesLayout>
              <Navigate to="/sales/dashboard" replace />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/dashboard"
          element={
            <SalesLayout>
              <DashboardPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/customers"
          element={
            <SalesLayout>
              <CustomersPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/leads"
          element={
            <SalesLayout>
              <LeadsPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/inventory"
          element={
            <SalesLayout>
              <InventoryPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/purchase-orders"
          element={
            <SalesLayout>
              <PurchaseOrdersPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/dc-tracking"
          element={
            <SalesLayout>
              <DCTrackingPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/bill-sale"
          element={
            <SalesLayout>
              <BillSalePage />
            </SalesLayout>
          }
        />

        {/* Inventory module (placeholder) */}
        <Route
          path="/inventory"
          element={<PlaceholderPage module="Inventory" />}
        />

        {/* Accounts module */}
        <Route
          path="/accounts"
          element={
            <AccountsLayout>
              <Navigate to="/accounts/sale-invoice" replace />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/sale-invoice"
          element={
            <AccountsLayout>
              <SaleInvoicePage />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/purchase-invoice"
          element={
            <AccountsLayout>
              <PurchaseInvoicePage />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/journal-register"
          element={
            <AccountsLayout>
              <JournalRegisterPage />
            </AccountsLayout>
          }
        />
        <Route path="/accounts/general-voucher" element={<Navigate to="/accounts/journal-register" replace />} />
        <Route
          path="/accounts/bank-payments"
          element={
            <AccountsLayout>
              <BankPaymentsPage />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/ledger"
          element={
            <AccountsLayout>
              <LedgerPage />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/profit-loss"
          element={
            <AccountsLayout>
              <ProfitLossPage />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/balance-sheet"
          element={
            <AccountsLayout>
              <BalanceSheetPage />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/reports"
          element={
            <AccountsLayout>
              <ReportsPage />
            </AccountsLayout>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  )
}
