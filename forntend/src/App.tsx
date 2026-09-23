import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { getStoredAuth } from '@/lib/auth'
import ModuleSelectPage from '@/pages/ModuleSelectPage'
import AdminLoginPage from '@/pages/AdminLoginPage'
import DashboardPage from '@/pages/DashboardPage'
import CustomersPage from '@/pages/CustomersPage'
import CustomerFormPage from '@/pages/CustomerFormPage'
import ContactsPage from '@/pages/ContactsPage'
import ContactFormPage from '@/pages/ContactFormPage'
import SuppliersPage from '@/pages/SuppliersPage'
import SupplierFormPage from '@/pages/SupplierFormPage'
import LeadsPage from '@/pages/LeadsPage'
import LeadFormPage from '@/pages/LeadFormPage'
import LeadDetailsPage from '@/pages/LeadDetailsPage'
import MailCampaignPage from '@/pages/MailCampaignPage'
import MailCampaignFormPage from '@/pages/MailCampaignFormPage'
import MailCampaignPreviewPage from '@/pages/MailCampaignPreviewPage'
import MailCampaignReportPage from '@/pages/MailCampaignReportPage'
import CalendarPage from '@/pages/CalendarPage'
import InventoryPage from '@/pages/InventoryPage'
import PurchaseOrdersPage from '@/pages/PurchaseOrdersPage'
import DCTrackingPage from '@/pages/DCTrackingPage'
import BillSalePage from '@/pages/BillSalePage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import QuotationDashboardPage from '@/pages/QuotationDashboardPage'
import QuotationTypeSelectPage from '@/pages/QuotationTypeSelectPage'
import ActivityPage from '@/pages/ActivityPage'
import ActivityFormPage from '@/pages/ActivityFormPage'
import CompanyProfilesPage from '@/pages/CompanyProfilesPage'
import CompanyProfileFormPage from '@/pages/CompanyProfileFormPage'
import QuotationFormPage from '@/pages/QuotationFormPage'
import QuotationEditPage from '@/pages/QuotationEditPage'
import QuotationViewPage from '@/pages/QuotationViewPage'
import FunnelPage from '@/pages/FunnelPage'
import FunnelFormPage from '@/pages/FunnelFormPage'
import OPFPage from '@/pages/OPFPage'
import OPFGenerateFormPage from '@/pages/OPFGenerateFormPage'
import OPFViewPage from '@/pages/OPFViewPage'
import RenewalsPage from '@/pages/RenewalsPage'
import DataAdminPage from '@/pages/DataAdminPage'
import EmployeesPage from '@/pages/EmployeesPage'
import EmployeeFormPage from '@/pages/EmployeeFormPage'
import ReportsPage from '@/pages/ReportsPage'
import ReportDetailPage from '@/pages/ReportDetailPage'

function SalesLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const auth = getStoredAuth('admin')

  if (!auth || auth.user.role !== 'admin') {
    return <Navigate to="/admin-login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="sales-module-typography h-screen overflow-hidden bg-[#F8F7F3]">
      <TopBar />
      <div className="mt-16 flex h-[calc(100vh-4rem)] overflow-hidden">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-3">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin-login"
          element={getStoredAuth('admin') ? <Navigate to="/sales/dashboard" replace /> : <AdminLoginPage />}
        />

        {/* Landing: choose a module */}
        <Route path="/" element={<ModuleSelectPage />} />

        {/* Sales module — full CRM lives here */}
        <Route
          path="/sales"
          element={getStoredAuth('admin') ? <Navigate to="/sales/dashboard" replace /> : <AdminLoginPage />}
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
          path="/sales/contacts"
          element={
            <SalesLayout>
              <ContactsPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/contacts/new"
          element={
            <SalesLayout>
              <ContactFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/contacts/edit/:id"
          element={
            <SalesLayout>
              <ContactFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/suppliers"
          element={
            <SalesLayout>
              <SuppliersPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/suppliers/new"
          element={
            <SalesLayout>
              <SupplierFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/suppliers/edit/:id"
          element={
            <SalesLayout>
              <SupplierFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/customers"
          element={
            <SalesLayout>
              <Navigate to="/sales/customers" replace />
            </SalesLayout>
          }
        />
        <Route
          path="/customers/new"
          element={
            <SalesLayout>
              <CustomerFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/customers/edit/:id"
          element={
            <SalesLayout>
              <CustomerFormPage />
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
          path="/sales/leads/new"
          element={
            <SalesLayout>
              <LeadFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/leads/edit/:id"
          element={
            <SalesLayout>
              <LeadFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/leads/:id"
          element={
            <SalesLayout>
              <LeadDetailsPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/mail-campaign"
          element={
            <SalesLayout>
              <MailCampaignPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/mail-campaign/new"
          element={
            <SalesLayout>
              <MailCampaignFormPage />
            </SalesLayout>
          }
        />
        <Route path="/sales/mail-campaign/drafts" element={<SalesLayout><MailCampaignPage statusFilter="Draft" /></SalesLayout>} />
        <Route path="/sales/mail-campaign/scheduled" element={<SalesLayout><MailCampaignPage statusFilter="Scheduled" /></SalesLayout>} />
        <Route path="/sales/mail-campaign/sent" element={<SalesLayout><MailCampaignPage statusFilter="Sent" /></SalesLayout>} />
        <Route
          path="/sales/mail-campaign/edit/:id"
          element={
            <SalesLayout>
              <MailCampaignFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/mail-campaign/view/:id"
          element={<SalesLayout><MailCampaignPreviewPage /></SalesLayout>}
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

        {/* New navigation targets (placeholders) */}
        <Route
          path="/sales/calendar"
          element={
            <SalesLayout>
              <CalendarPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/activities"
          element={
            <SalesLayout>
              <ActivityPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/opf"
          element={
            <SalesLayout>
              <OPFPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/opf/new"
          element={
            <SalesLayout>
              <OPFGenerateFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/opf/:id"
          element={
            <SalesLayout>
              <OPFViewPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/opf/edit/:id"
          element={
            <SalesLayout>
              <OPFGenerateFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/renewals"
          element={
            <SalesLayout>
              <RenewalsPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/activities/new"
          element={
            <SalesLayout>
              <ActivityFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/activities/edit/:id"
          element={
            <SalesLayout>
              <ActivityFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/funnels"
          element={
            <SalesLayout>
              <FunnelPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/funnels/new"
          element={
            <SalesLayout>
              <FunnelFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/company-profiles"
          element={
            <SalesLayout>
              <CompanyProfilesPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/company-profiles/new"
          element={
            <SalesLayout>
              <CompanyProfileFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/company-profiles/edit/:id"
          element={
            <SalesLayout>
              <CompanyProfileFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/quotations"
          element={
            <SalesLayout>
              <QuotationTypeSelectPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/quotations/new/:type"
          element={
            <SalesLayout>
              <QuotationFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/quotations/view/:id"
          element={
            <SalesLayout>
              <QuotationViewPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/quotations/edit/:id"
          element={
            <SalesLayout>
              <QuotationEditPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/quotations/:type"
          element={
            <SalesLayout>
              <QuotationDashboardPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/reports"
          element={
            <SalesLayout>
              <PlaceholderPage module="Reports" />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/reports/leads"
          element={
            <SalesLayout>
              <PlaceholderPage module="Lead Reports" />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/reports/customers"
          element={
            <SalesLayout>
              <PlaceholderPage module="Customer Reports" />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/reports/quotations"
          element={
            <SalesLayout>
              <PlaceholderPage module="Quotation Reports" />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/reports/sales"
          element={
            <SalesLayout>
              <PlaceholderPage module="Sales Reports" />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/reports/mail-campaigns/:id"
          element={<SalesLayout><MailCampaignReportPage /></SalesLayout>}
        />
        <Route
          path="/sales/reports/mail-campaigns"
          element={
            <SalesLayout>
              <MailCampaignReportPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/reports/activities"
          element={
            <SalesLayout>
              <PlaceholderPage module="Activity Reports" />
            </SalesLayout>
          }
        />

        <Route
          path="/reports"
          element={
            <SalesLayout>
              <ReportsPage />
            </SalesLayout>
          }
        />
        <Route
          path="/reports/:reportKey"
          element={
            <SalesLayout>
              <ReportDetailPage />
            </SalesLayout>
          }
        />

        <Route
          path="/sales/data-admin"
          element={
            <SalesLayout>
              <DataAdminPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/employees"
          element={
            <SalesLayout>
              <EmployeesPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/employees/new"
          element={
            <SalesLayout>
              <EmployeeFormPage />
            </SalesLayout>
          }
        />
        <Route
          path="/sales/employees/edit/:id"
          element={
            <SalesLayout>
              <EmployeeFormPage />
            </SalesLayout>
          }
        />
        <Route path="/sales/data-admin/import" element={<SalesLayout><PlaceholderPage module="Import Data" /></SalesLayout>} />
        <Route path="/sales/data-admin/export" element={<SalesLayout><PlaceholderPage module="Export Data" /></SalesLayout>} />
        <Route path="/sales/data-admin/user-management" element={<SalesLayout><EmployeesPage /></SalesLayout>} />
        <Route path="/sales/data-admin/role-management" element={<SalesLayout><PlaceholderPage module="Role Management" /></SalesLayout>} />
        <Route path="/sales/data-admin/master-data" element={<SalesLayout><PlaceholderPage module="Master Data" /></SalesLayout>} />
        <Route path="/sales/data-admin/country-master" element={<SalesLayout><PlaceholderPage module="Country Master" /></SalesLayout>} />
        <Route path="/sales/data-admin/state-master" element={<SalesLayout><PlaceholderPage module="State Master" /></SalesLayout>} />
        <Route path="/sales/data-admin/city-master" element={<SalesLayout><PlaceholderPage module="City Master" /></SalesLayout>} />
        <Route path="/sales/data-admin/lead-source-master" element={<SalesLayout><PlaceholderPage module="Lead Source Master" /></SalesLayout>} />
        <Route path="/sales/data-admin/industry-master" element={<SalesLayout><PlaceholderPage module="Industry Master" /></SalesLayout>} />
        <Route path="/sales/data-admin/designation-master" element={<SalesLayout><PlaceholderPage module="Designation Master" /></SalesLayout>} />
        <Route path="/sales/data-admin/email-templates" element={<SalesLayout><PlaceholderPage module="Email Templates" /></SalesLayout>} />
        <Route path="/sales/data-admin/activity-types" element={<SalesLayout><PlaceholderPage module="Activity Types" /></SalesLayout>} />

        <Route
          path="/sales/settings"
          element={
            <SalesLayout>
              <PlaceholderPage module="Settings" />
            </SalesLayout>
          }
        />

        {/* Inventory module (placeholder) */}
        <Route
          path="/inventory"
          element={<PlaceholderPage module="Inventory" />}
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