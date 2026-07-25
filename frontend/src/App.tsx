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
import AccountsBlankPage from '@/pages/accounts/AccountsBlankPage'
import SaleInvoicePage from '@/pages/accounts/SaleInvoicePage'

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

function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <AccountsSidebar />
      <div className="flex-1 ml-56">
        <TopBar searchPlaceholder="Search invoices, ledger, reports..." userRole="Accounts · Finance" userInitials="AC" />
        <main className="mt-16 p-8">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing: choose a module */}
        <Route path="/" element={<ModuleSelectPage />} />

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
              <AccountsBlankPage
                title="Purchase Invoice"
                description="Record and review purchase invoices."
              />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/general-voucher"
          element={
            <AccountsLayout>
              <AccountsBlankPage
                title="General Voucher"
                description="Post general accounting vouchers."
              />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/bank-payments"
          element={
            <AccountsLayout>
              <AccountsBlankPage
                title="Bank Payments"
                description="Manage bank payment transactions."
              />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/ledger"
          element={
            <AccountsLayout>
              <AccountsBlankPage
                title="Ledger"
                description="View account ledgers and balances."
              />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/profit-loss"
          element={
            <AccountsLayout>
              <AccountsBlankPage
                title="P & L"
                description="Profit and loss statement overview."
              />
            </AccountsLayout>
          }
        />
        <Route
          path="/accounts/reports"
          element={
            <AccountsLayout>
              <AccountsBlankPage
                title="Reports"
                description="Financial reports and statements."
              />
            </AccountsLayout>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}