import SalesDashboardView from '@/components/SalesDashboardView'
import { fetchDashboard } from '@/lib/dashboardApi'

export default function DashboardPage() {
  return <SalesDashboardView fetchDashboardData={fetchDashboard} />
}
