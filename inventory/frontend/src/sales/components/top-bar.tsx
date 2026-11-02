'use client'

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  CircleHelp,
  Contact,
  Expand,
  FilePlus2,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shrink,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { clearStoredAuth, getStoredAuth } from '@/sales/lib/auth'
import { hasPermission } from '@/sales/lib/permissions'
import NotificationBell from '@/sales/components/NotificationBell'

interface TopBarProps {
  userName?: string
  userRole?: string
  onMenuClick?: () => void
}

const navigationItems = [
  { href: '/sales/dashboard', label: 'Dashboard', permission: 'dashboard' },
  { href: '/sales/contacts', label: 'Contact', permission: 'contacts' },
  { href: '/sales/mail-campaign', label: 'Mail Campaign', permission: 'mailCampaign' },
  { href: '/sales/leads', label: 'Lead', permission: 'leads' },
  { href: '/sales/activities', label: 'Activity', permission: 'activities' },
  { href: '/sales/calendar', label: 'Calendar', permission: 'calendar' },
  { href: '/sales/customers', label: 'Customer', permission: 'customers' },
  { href: '/sales/customer-mapping', label: 'Customer Mapping', permission: 'customerMapping' },
  { href: '/sales/quotations', label: 'Quotation', permission: 'quotations' },
  { href: '/sales/suppliers', label: 'Supplier', permission: 'suppliers' },
  { href: '/sales/funnels', label: 'Funnel', permission: 'funnels' },
  { href: '/sales/opf', label: 'OPF', permission: 'opf' },
  { href: '/sales/renewals', label: 'Renewals', permission: 'renewals' },
  { href: '/reports', label: 'Reports', permission: 'reports' },
  { href: '/sales/data-admin', label: 'Data Admin', permission: 'dataAdmin' },
  { href: '/sales/employees', label: 'Employees', permission: 'employees' },
  { href: '/sales/company-profiles', label: 'Company Profiles', permission: 'companyProfiles' },
]

const createItems = [
  { href: '/sales/contacts/new', label: 'New Contact', permission: 'contacts', icon: Contact },
  { href: '/sales/leads/new', label: 'New Lead', permission: 'leads', icon: Zap },
  { href: '/sales/quotations', label: 'New Quotation', permission: 'quotations', icon: FilePlus2 },
  { href: '/customers/new', label: 'New Customer', permission: 'customers', icon: Users },
]

export function TopBar({ userName, userRole, onMenuClick }: TopBarProps) {
  const [activePanel, setActivePanel] = useState<'mega' | 'add' | 'profile' | 'support' | 'search' | null>(null)
  const [search, setSearch] = useState('')
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))
  const [fullscreenError, setFullscreenError] = useState('')
  const barRef = useRef<HTMLElement | null>(null)
  const navigate = useNavigate()
  const session = getStoredAuth()
  const displayName = userName ?? session?.user.name ?? 'Sales User'
  const firstName = displayName.trim().split(/\s+/)[0] || 'Sales'
  const initials = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const permittedNavigation = navigationItems.filter((item) => hasPermission(item.permission))
  const searchResults = permittedNavigation.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()))

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setActivePanel(null)
    }
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('fullscreenchange', updateFullscreen)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('fullscreenchange', updateFullscreen)
    }
  }, [])

  const goTo = (href: string) => {
    setActivePanel(null)
    setSearch('')
    navigate(href)
  }
  const panelButton = (panel: typeof activePanel) => () => setActivePanel((current) => current === panel ? null : panel)
  const handleLogout = () => {
    setActivePanel(null)
    localStorage.removeItem('sales_logged_in')
    clearStoredAuth()
    navigate('/sales', { replace: true })
  }
  const toggleFullscreen = async () => {
    setFullscreenError('')
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch (error) {
      console.error('Unable to change fullscreen mode:', error)
      setFullscreenError('Fullscreen is not available in this browser.')
    }
  }

  return (
    <header ref={barRef} className="relative z-50 flex h-16 w-full shrink-0 items-center gap-2 border-b border-[#EFECE5] bg-white px-3 sm:gap-4 sm:px-5">
      <button type="button" onClick={onMenuClick} aria-label="Collapse or expand Sales navigation" className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 sm:p-2">
        <Menu className="h-5 w-5" />
      </button>
      <div className="relative mx-auto hidden min-w-32 max-w-lg flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onFocus={() => setActivePanel('search')}
          onChange={(event) => { setSearch(event.target.value); setActivePanel('search') }}
          onKeyDown={(event) => { if (event.key === 'Enter' && searchResults[0]) goTo(searchResults[0].href) }}
          placeholder="Search Sales pages..."
          aria-label="Search Sales pages"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
        {search ? <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button> : null}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button type="button" onClick={panelButton('search')} aria-label="Search Sales pages" aria-expanded={activePanel === 'search'} className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 sm:p-2 md:hidden"><Search className="h-5 w-5" /></button>
        <button type="button" onClick={panelButton('mega')} aria-expanded={activePanel === 'mega'} className="inline-flex items-center gap-1 rounded-lg p-1 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:p-2"><LayoutGrid className="h-4 w-4" /><span className="hidden xl:inline">Mega Menu</span></button>
        <button type="button" onClick={panelButton('add')} aria-label="Add new record" aria-expanded={activePanel === 'add'} className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 sm:p-2"><Plus className="h-5 w-5" /></button>
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} className="inline-flex rounded-lg p-1 text-slate-600 hover:bg-slate-100 sm:p-2">{fullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}</button>
        <NotificationBell />
        <button type="button" onClick={panelButton('support')} aria-label="Support" aria-expanded={activePanel === 'support'} className="inline-flex rounded-lg p-1 text-slate-600 hover:bg-slate-100 sm:p-2"><CircleHelp className="h-5 w-5" /></button>
        <button type="button" onClick={() => goTo('/sales/profile')} aria-label="Settings" className="inline-flex rounded-lg p-1 text-slate-600 hover:bg-slate-100 sm:p-2"><Settings className="h-5 w-5" /></button>
        <button type="button" onClick={panelButton('profile')} aria-label="Open profile menu" aria-expanded={activePanel === 'profile'} className="ml-0.5 flex items-center gap-1 rounded-full border border-[#E2E8F0] px-1 py-1 transition hover:bg-slate-100 sm:ml-1 sm:gap-2 sm:px-1.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#EDE7F6] text-xs font-bold text-[#17233B] sm:h-8 sm:w-8">{initials || 'S'}</span>
          <span className="hidden max-w-28 truncate text-left text-xs font-semibold text-slate-700 sm:block">{firstName}</span>
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {activePanel ? (
        <div className={`absolute right-3 top-[calc(100%+0.5rem)] z-50 max-h-[calc(75vh/var(--sales-ui-scale))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl sm:right-5 ${activePanel === 'mega' ? 'w-[min(42rem,calc(100vw-1.5rem))]' : activePanel === 'search' ? 'left-4 right-4 sm:left-1/2 sm:right-auto sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2' : 'w-64'}`}>
          {activePanel === 'search' ? (
            <div className="space-y-1">
              <div className="relative mb-2 md:hidden"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && searchResults[0]) goTo(searchResults[0].href) }} placeholder="Search Sales pages..." aria-label="Search Sales pages" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" /></div>
              {searchResults.length ? searchResults.map((item) => <button key={item.href} type="button" onClick={() => goTo(item.href)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">{item.label}</button>) : <p className="px-3 py-4 text-sm text-slate-500">No matching Sales pages.</p>}
            </div>
          ) : null}
          {activePanel === 'mega' ? <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{permittedNavigation.map((item) => <button key={item.href} type="button" onClick={() => goTo(item.href)} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">{item.label}</button>)}</div> : null}
          {activePanel === 'add' ? <div className="space-y-1"><p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Create</p>{createItems.filter((item) => hasPermission(item.permission)).map(({ href, label, icon: Icon }) => <button key={href} type="button" onClick={() => goTo(href)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Icon className="h-4 w-4 text-slate-500" />{label}</button>)}</div> : null}
          {activePanel === 'profile' ? <div className="space-y-1"><div className="border-b border-slate-100 px-3 pb-3"><p className="truncate text-sm font-semibold text-slate-800">{displayName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{userRole ?? session?.user.role ?? 'Sales'}</p></div><button type="button" onClick={() => goTo('/sales/profile')} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Profile &amp; settings</button><button type="button" onClick={() => setActivePanel('support')} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Sales support</button><button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"><LogOut className="h-4 w-4" />Log out</button></div> : null}
          {activePanel === 'support' ? <div className="px-3 py-2"><h2 className="text-sm font-semibold text-slate-800">Sales support</h2><p className="mt-1 text-sm text-slate-500">For assistance, contact your Sales administrator.</p></div> : null}
        </div>
      ) : null}
      {fullscreenError ? <div role="status" className="absolute right-5 top-[calc(100%+0.5rem)] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow">{fullscreenError}</div> : null}
    </header>
  )
}
