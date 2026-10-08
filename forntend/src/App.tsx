```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { InventoryLayout } from '@/components/inventory-layout'
import ModuleSelectPage from '@/pages/ModuleSelectPage'
import InventoryOverviewPage from '@/pages/InventoryOverviewPage'
import AllAssetsPage from '@/pages/AllAssetsPage'
import InwardingPage from '@/pages/InwardingPage'
import OutwardDashboardPage from '@/pages/OutwardDashboardPage'
import ProductsPage from '@/pages/ProductsPage'
import OutStockPage from '@/pages/inventory/OutStockPage'
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
        {/* Landing */}
        <Route path="/" element={<ModuleSelectPage />} />

        {/* Inventory module */}
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
              <PlaceholderPage module="Delivery Challan" />
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
            </Invent
```
