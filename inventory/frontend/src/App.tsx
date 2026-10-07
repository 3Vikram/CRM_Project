import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { InventoryLayout } from '@/components/inventory-layout'
import ModuleSelectPage from '@/pages/ModuleSelectPage'
import InventoryOverviewPage from '@/pages/InventoryOverviewPage'
import InventoryLoginPage from '@/pages/InventoryLoginPage'
import AllAssetsPage from '@/pages/AllAssetsPage'
import InwardingPage from '@/pages/InwardingPage'
import OutwardDashboardPage from '@/pages/OutwardDashboardPage'
import ProductsPage from '@/pages/ProductsPage'
import OutStockPage from '@/pages/inventory/OutStockPage'
import DCTrackingPage from '@/pages/DCTrackingPage'
import ReturnedChallanPage from '@/pages/ReturnedChallanPage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import OutwardEntry from '@/pages/OutwardEntry'
import SerialHistoryPage from '@/pages/inventory/SerialHistoryPage'
import RentalLifecyclePage from '@/pages/RentalLifecyclePage'
import DailyEmailPage from '@/pages/DailyEmailPage'
import DepreciationHistoryPage from '@/pages/DepreciationHistoryPage'
import AccessoriesPage from '@/pages/AccessoriesPage'
import AccessoryLifecyclePage from '@/pages/AccessoryLifecyclePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing: choose a module */}
        <Route path="/" element={<ModuleSelectPage />} />
        {/* Inventory module — standalone module */}
        <Route path="/inventory/login" element={<InventoryLoginPage />} />
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
          path="/inventory/returned-challan"
          element={
            <InventoryLayout>
              <ReturnedChallanPage />
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
          path="/inventory/accessory-lifecycle/:accessoryId"
          element={
            <InventoryLayout>
              <AccessoryLifecyclePage />
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
        <Route
          path="/inventory/accessories"
          element={
            <InventoryLayout>
              <AccessoriesPage />
            </InventoryLayout>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
