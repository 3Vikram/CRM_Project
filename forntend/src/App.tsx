import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { InventoryLayout } from '@/components/inventory-layout'
import ModuleSelectPage from '@/pages/ModuleSelectPage'
import DashboardPage from '@/pages/DashboardPage'
import CustomersPage from '@/pages/CustomersPage'
import LeadsPage from '@/pages/LeadsPage'
import InventoryPage from '@/pages/InventoryPage'
import InventoryOverviewPage from '@/pages/InventoryOverviewPage'
import AllAssetsPage from '@/pages/AllAssetsPage'
import InwardingPage from '@/pages/InwardingPage'
import OutwardDashboardPage from '@/pages/OutwardDashboardPage'
import ProductsPage from '@/pages/ProductsPage'
import OutStockPage from '@/pages/inventory/OutStockPage'
import PurchaseOrdersPage from '@/pages/PurchaseOrdersPage'
import DCTrackingPage from '@/pages/DCTrackingPage'
import BillSalePage from '@/pages/BillSalePage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import OutwardEntry from '@/pages/OutwardEntry'
import SerialHistoryPage from '@/pages/inventory/SerialHistoryPage'
import RentalLifecyclePage from '@/pages/RentalLifecyclePage'
import DailyEmailPage from '@/pages/DailyEmailPage'
import DepreciationHistoryPage from '@/pages/DepreciationHistoryPage'

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
          path="/account/dc/dc-generate"
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

        {/* Inventory module — standalone module */}
        <Route
          path="/inventory"
          element={
            <InventoryLayout>
              <InventoryOverviewPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/dashboard"
          element={
            <InventoryLayout>
              <Navigate to="/inventory" replace />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/all-assets"
          element={
            <InventoryLayout>
              <Navigate to="/inventory/assets" replace />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/assets"
          element={
            <InventoryLayout>
              <AllAssetsPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/in-stock"
          element={
            <InventoryLayout>
              <AllAssetsPage initialStatus="IN_STOCK" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/out-stock"
          element={
            <InventoryLayout>
              <OutStockPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/products"
          element={
            <InventoryLayout>
              <ProductsPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/delivery-challan"
          element={
            <InventoryLayout>
              <DCTrackingPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/inwarding"
          element={
            <InventoryLayout>
              <InwardingPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/outward"
          element={
            <InventoryLayout>
              <OutwardDashboardPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/outwarding"
          element={
            <InventoryLayout>
              <OutwardEntry />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/serial-history/:serialNumber"
          element={
            <InventoryLayout>
              <SerialHistoryPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/rental-lifecycle/:serialNumber"
          element={
            <InventoryLayout>
              <RentalLifecyclePage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/rent-out"
          element={
            <InventoryLayout>
              <AllAssetsPage initialStatus="RENTED" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/sold-out"
          element={
            <InventoryLayout>
              <AllAssetsPage initialStatus="SOLD" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/returned"
          element={
            <InventoryLayout>
              <AllAssetsPage initialStatus="RETURNED" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/returned-assets"
          element={
            <InventoryLayout>
              <AllAssetsPage initialStatus="RETURNED" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/damaged"
          element={
            <InventoryLayout>
              <AllAssetsPage initialStatus="DAMAGED" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/damaged-lost"
          element={
            <InventoryLayout>
              <Navigate to="/inventory/damaged" replace />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/locations"
          element={
            <InventoryLayout>
              <PlaceholderPage module="Locations" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/vendors"
          element={
            <InventoryLayout>
              <PlaceholderPage module="Vendors" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/reports"
          element={
            <InventoryLayout>
              <PlaceholderPage module="Reports" />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/daily-email"
          element={
            <InventoryLayout>
              <DailyEmailPage />
            </InventoryLayout>
          }
        />
        <Route
          path="/inventory/depreciation-history"
          element={
            <InventoryLayout>
              <DepreciationHistoryPage />
            </InventoryLayout>
          }
        />

        {/* Accounts module (placeholder) */}
        <Route
          path="/accounts"
          element={<PlaceholderPage module="Accounts" />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}