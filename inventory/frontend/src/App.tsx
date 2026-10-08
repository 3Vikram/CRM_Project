import axios from 'axios'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import { Sidebar } from '@/salesPages/components/sidebar'
import { TopBar } from '@/salesPages/components/top-bar'
import { getStoredAuth } from '@/salesPages/lib/auth'
import { hasPermission } from '@/salesPages/lib/permissions'
import AdminLoginPage from '@/salesPages/pages/AdminLoginPage'
import SalesLoginPage from '@/salesPages/pages/SalesLoginPage'
import SalesProfilePage from '@/salesPages/pages/SalesProfilePage'
import DashboardPage from '@/salesPages/pages/DashboardPage'
import CustomersPage from '@/salesPages/pages/CustomersPage'
import CustomerFormPage from '@/salesPages/pages/CustomerFormPage'
import ContactsPage from '@/salesPages/pages/ContactsPage'
import ContactFormPage from '@/salesPages/pages/ContactFormPage'
import SuppliersPage from '@/salesPages/pages/SuppliersPage'
import SupplierFormPage from '@/salesPages/pages/SupplierFormPage'
import LeadsPage from '@/salesPages/pages/LeadsPage'
import LeadFormPage from '@/salesPages/pages/LeadFormPage'
import LeadDetailsPage from '@/salesPages/pages/LeadDetailsPage'
import MailCampaignPage from '@/salesPages/pages/MailCampaignPage'
import MailCampaignFormPage from '@/salesPages/pages/MailCampaignFormPage'
import MailCampaignPreviewPage from '@/salesPages/pages/MailCampaignPreviewPage'
import MailCampaignReportPage from '@/salesPages/pages/MailCampaignReportPage'
import CalendarPage from '@/salesPages/pages/CalendarPage'
import SalesInventoryPage from '@/salesPages/pages/InventoryPage'
import PurchaseOrdersPage from '@/salesPages/pages/PurchaseOrdersPage'
import SalesDCTrackingPage from '@/salesPages/pages/DCTrackingPage'
import BillSalePage from '@/salesPages/pages/BillSalePage'
import SalesPlaceholderPage from '@/salesPages/pages/PlaceholderPage'
import QuotationDashboardPage from '@/salesPages/pages/QuotationDashboardPage'
import QuotationTypeSelectPage from '@/salesPages/pages/QuotationTypeSelectPage'
import ActivityPage from '@/salesPages/pages/ActivityPage'
import ActivityFormPage from '@/salesPages/pages/ActivityFormPage'
import CompanyProfilesPage from '@/salesPages/pages/CompanyProfilesPage'
import CompanyProfileFormPage from '@/salesPages/pages/CompanyProfileFormPage'
import QuotationFormPage from '@/salesPages/pages/QuotationFormPage'
import QuotationEditPage from '@/salesPages/pages/QuotationEditPage'
import QuotationViewPage from '@/salesPages/pages/QuotationViewPage'
import FunnelPage from '@/salesPages/pages/FunnelPage'
import FunnelFormPage from '@/salesPages/pages/FunnelFormPage'
import OPFPage from '@/salesPages/pages/OPFPage'
import OPFGenerateFormPage from '@/salesPages/pages/OPFGenerateFormPage'
import OPFViewPage from '@/salesPages/pages/OPFViewPage'
import RenewalsPage from '@/salesPages/pages/RenewalsPage'
import DataAdminPage from '@/salesPages/pages/DataAdminPage'
import EmployeesPage from '@/salesPages/pages/EmployeesPage'
import EmployeeFormPage from '@/salesPages/pages/EmployeeFormPage'
import ReportsPage from '@/salesPages/pages/ReportsPage'
import ReportDetailPage from '@/salesPages/pages/ReportDetailPage'

axios.interceptors.request.use((config) => {
  const token = getStoredAuth()?.token
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const getSalesRoutePermission = (pathname: string) => {
  if (pathname.startsWith('/sales/profile')) return null
  if (pathname.startsWith('/sales/dashboard')) return 'dashboard'
  if (pathname.startsWith('/sales/customers') || pathname === '/customers') return 'customers'
  if (pathname.startsWith('/sales/contacts')) return 'contacts'
  if (pathname.startsWith('/sales/suppliers')) return 'suppliers'
  if (pathname.startsWith('/sales/leads')) return 'leads'
  if (pathname.startsWith('/sales/activities')) return 'activities'
  if (pathname.startsWith('/sales/calendar')) return 'calendar'
  if (pathname.startsWith('/sales/mail-campaign')) return 'mailCampaign'
  if (pathname.startsWith('/sales/quotations')) return 'quotations'
  if (pathname.startsWith('/sales/opf')) return 'opf'
  if (pathname.startsWith('/sales/funnels')) return 'funnels'
  if (pathname.startsWith('/sales/renewals')) return 'renewals'
  if (pathname.startsWith('/sales/reports') || pathname === '/reports' || pathname.startsWith('/reports/')) return 'reports'
  if (pathname.startsWith('/sales/data-admin')) return 'dataAdmin'
  if (pathname.startsWith('/sales/employees')) return 'employees'
  if (pathname.startsWith('/sales/company-profiles')) return 'companyProfiles'
  if (pathname.startsWith('/sales/inventory')) return 'inventory'
  if (pathname.startsWith('/sales/purchase-orders')) return 'purchaseOrders'
  if (pathname.startsWith('/sales/dc-tracking')) return 'dcTracking'
  if (pathname.startsWith('/sales/bill-sale')) return 'billSale'
  return null
}

function SalesAccessDeniedPage() {
  return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center"><div className="rounded-lg border border-[#E7E3DA] bg-white px-8 py-10 text-center shadow-sm"><h1 className="text-2xl font-semibold text-[#1F1D1A]">Access denied</h1><p className="mt-2 text-sm text-[#6B6657]">You do not have permission to view this module.</p></div></div>
}

function SalesLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const loggedIn = typeof window !== 'undefined' && Boolean(getStoredAuth()?.token)

  if (!loggedIn) {
    return <Navigate to="/sales" replace state={{ from: location.pathname }} />
  }

  const requiredPermission = getSalesRoutePermission(location.pathname)
  const canView = !requiredPermission || hasPermission(requiredPermission)

  return (
    <div className="sales-module-typography h-screen overflow-hidden bg-[#F8F7F3]">
      <TopBar />
      <div className="mt-16 flex h-[calc(100vh-4rem)] overflow-hidden">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-3">{canView ? children : <SalesAccessDeniedPage />}</main>
      </div>
    </div>
  )
}

function SalesRoutes() {
  const page = (element: React.ReactNode): React.ReactNode => <SalesLayout>{element}</SalesLayout>
  const routes: Array<[string, React.ReactNode]> = [
    ['/sales', <SalesLoginPage />],
    ['/sales/profile', page(<SalesProfilePage />)],
    ['/sales/dashboard', typeof window !== 'undefined' && Boolean(getStoredAuth()?.token) ? page(<DashboardPage />) : <Navigate to="/sales" replace />],
    ['/sales/customers', page(<CustomersPage />)],
    ['/sales/contacts', page(<ContactsPage />)],
    ['/sales/contacts/new', page(<ContactFormPage />)],
    ['/sales/contacts/edit/:id', page(<ContactFormPage />)],
    ['/sales/suppliers', page(<SuppliersPage />)],
    ['/sales/suppliers/new', page(<SupplierFormPage />)],
    ['/sales/suppliers/edit/:id', page(<SupplierFormPage />)],
    ['/customers', page(<Navigate to="/sales/customers" replace />)],
    ['/customers/new', page(<CustomerFormPage />)],
    ['/customers/edit/:id', page(<CustomerFormPage />)],
    ['/sales/leads', page(<LeadsPage />)],
    ['/sales/leads/new', page(<LeadFormPage />)],
    ['/sales/leads/edit/:id', page(<LeadFormPage />)],
    ['/sales/leads/:id', page(<LeadDetailsPage />)],
    ['/sales/mail-campaign', page(<MailCampaignPage />)],
    ['/sales/mail-campaign/new', page(<MailCampaignFormPage />)],
    ['/sales/mail-campaign/drafts', page(<MailCampaignPage statusFilter="Draft" />)],
    ['/sales/mail-campaign/scheduled', page(<MailCampaignPage statusFilter="Scheduled" />)],
    ['/sales/mail-campaign/sent', page(<MailCampaignPage statusFilter="Sent" />)],
    ['/sales/mail-campaign/edit/:id', page(<MailCampaignFormPage />)],
    ['/sales/mail-campaign/view/:id', page(<MailCampaignPreviewPage />)],
    ['/sales/inventory', page(<SalesInventoryPage />)],
    ['/sales/purchase-orders', page(<PurchaseOrdersPage />)],
    ['/sales/dc-tracking', page(<SalesDCTrackingPage />)],
    ['/sales/bill-sale', page(<BillSalePage />)],
    ['/sales/calendar', page(<CalendarPage />)],
    ['/sales/activities', page(<ActivityPage />)],
    ['/sales/opf', page(<OPFPage />)],
    ['/sales/opf/new', page(<OPFGenerateFormPage />)],
    ['/sales/opf/:id', page(<OPFViewPage />)],
    ['/sales/opf/edit/:id', page(<OPFGenerateFormPage />)],
    ['/sales/renewals', page(<RenewalsPage />)],
    ['/sales/activities/new', page(<ActivityFormPage />)],
    ['/sales/activities/edit/:id', page(<ActivityFormPage />)],
    ['/sales/funnels', page(<FunnelPage />)],
    ['/sales/funnels/new', page(<FunnelFormPage />)],
    ['/sales/company-profiles', page(<CompanyProfilesPage />)],
    ['/sales/company-profiles/new', page(<CompanyProfileFormPage />)],
    ['/sales/company-profiles/edit/:id', page(<CompanyProfileFormPage />)],
    ['/sales/quotations', page(<QuotationTypeSelectPage />)],
    ['/sales/quotations/new/:type', page(<QuotationFormPage />)],
    ['/sales/quotations/view/:id', page(<QuotationViewPage />)],
    ['/sales/quotations/edit/:id', page(<QuotationEditPage />)],
    ['/sales/quotations/:type', page(<QuotationDashboardPage />)],
    ['/sales/reports', page(<SalesPlaceholderPage module="Reports" />)],
    ['/sales/reports/leads', page(<SalesPlaceholderPage module="Lead Reports" />)],
    ['/sales/reports/customers', page(<SalesPlaceholderPage module="Customer Reports" />)],
    ['/sales/reports/quotations', page(<SalesPlaceholderPage module="Quotation Reports" />)],
    ['/sales/reports/sales', page(<SalesPlaceholderPage module="Sales Reports" />)],
    ['/sales/reports/mail-campaigns/:id', page(<MailCampaignReportPage />)],
    ['/sales/reports/mail-campaigns', page(<MailCampaignReportPage />)],
    ['/sales/reports/activities', page(<SalesPlaceholderPage module="Activity Reports" />)],
    ['/reports', page(<ReportsPage />)],
    ['/reports/:reportKey', page(<ReportDetailPage />)],
    ['/sales/data-admin', page(<DataAdminPage />)],
    ['/sales/employees', page(<EmployeesPage />)],
    ['/sales/employees/new', page(<EmployeeFormPage />)],
    ['/sales/employees/edit/:id', page(<EmployeeFormPage />)],
    ['/sales/data-admin/import', page(<SalesPlaceholderPage module="Import Data" />)],
    ['/sales/data-admin/export', page(<SalesPlaceholderPage module="Export Data" />)],
    ['/sales/data-admin/user-management', page(<EmployeesPage />)],
    ['/sales/data-admin/role-management', page(<SalesPlaceholderPage module="Role Management" />)],
    ['/sales/data-admin/master-data', page(<SalesPlaceholderPage module="Master Data" />)],
    ['/sales/data-admin/country-master', page(<SalesPlaceholderPage module="Country Master" />)],
    ['/sales/data-admin/state-master', page(<SalesPlaceholderPage module="State Master" />)],
    ['/sales/data-admin/city-master', page(<SalesPlaceholderPage module="City Master" />)],
    ['/sales/data-admin/lead-source-master', page(<SalesPlaceholderPage module="Lead Source Master" />)],
    ['/sales/data-admin/industry-master', page(<SalesPlaceholderPage module="Industry Master" />)],
    ['/sales/data-admin/designation-master', page(<SalesPlaceholderPage module="Designation Master" />)],
    ['/sales/data-admin/email-templates', page(<SalesPlaceholderPage module="Email Templates" />)],
    ['/sales/data-admin/activity-types', page(<SalesPlaceholderPage module="Activity Types" />)],
    ['/sales/settings', page(<SalesPlaceholderPage module="Settings" />)],
  ]

  return (
    <Routes>
      <Route path="/admin-login" element={getStoredAuth('admin') ? <Navigate to="/sales/dashboard" replace /> : <AdminLoginPage />} />
      {routes.map(([path, element]) => <Route key={path} path={path} element={element} />)}
      <Route path="*" element={<Navigate to="/sales" replace />} />
    </Routes>
  )
}

function InventoryRoutes() {
  return (
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
  )
}

function AppRoutes() {
  const { pathname } = useLocation()
  const isSalesRoute =
    pathname === '/sales' ||
    pathname.startsWith('/sales/') ||
    pathname === '/admin-login' ||
    pathname === '/customers' ||
    pathname.startsWith('/customers/') ||
    pathname === '/reports' ||
    pathname.startsWith('/reports/')

  return isSalesRoute ? <SalesRoutes /> : <InventoryRoutes />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
