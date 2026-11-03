'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/sales/components/modal'
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CalendarDays,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Filter,
  ListTodo,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { completeCalendarEvent, deleteCalendarEvent, fetchCalendarEvents, type CalendarApiEvent } from '@/sales/lib/calendarApi'

type CalendarModule =
  | 'All'
  | 'Leads'
  | 'Customers'
  | 'Activities'
  | 'Mail Campaigns'
  | 'Quotations'
  | 'Funnels'
  | 'Meetings'
  | 'Calls'
  | 'Tasks'
  | 'OPF'

type EventPriority = 'Low' | 'Medium' | 'High'
type DashboardDrawerKey = 'today-events' | 'upcoming-events' | 'overdue-activities' | 'meetings-today'

type CalendarEvent = {
  id: string
  title: string
  category: 'Mail Campaign' | 'Lead Follow-up' | 'Customer Meeting' | 'Quotation Reminder' | 'High Priority' | 'Completed Activity' | 'Scheduled Activity'
  module: Exclude<CalendarModule, 'All'>
  description: string
  customer?: string
  lead?: string
  assignedTo: string
  priority: EventPriority
  status: 'Pending' | 'Completed' | 'In Progress'
  date: string
  time: string
  endTime: string
  location?: string
  reminderBefore?: string
  notes?: string
  referenceId?: string
  referenceModule?: string
  targetId?: string
  recordLabel?: string
  quotationType?: 'rent' | 'sold'
  eventType?: string
  sourceField?: string
  color?: string
  amount?: number | string | null
  amountCurrency?: string
}

const moduleOptions: CalendarModule[] = [
  'All',
  'Leads',
  'Customers',
  'Activities',
  'Mail Campaigns',
  'Quotations',
  'Funnels',
  'Meetings',
  'Calls',
  'Tasks',
  'OPF',
]

const moduleColorMap: Record<CalendarEvent['category'], string> = {
  'Mail Campaign': 'bg-[#F2EFE8] text-[#111827] border-[#111827]',
  'Lead Follow-up': 'bg-orange-100 text-orange-700 border-orange-200',
  'Customer Meeting': 'bg-green-100 text-green-700 border-green-200',
  'Quotation Reminder': 'bg-violet-100 text-violet-700 border-violet-200',
  'High Priority': 'bg-red-100 text-red-700 border-red-200',
  'Completed Activity': 'bg-slate-200 text-slate-700 border-slate-300',
  'Scheduled Activity': 'bg-sky-100 text-sky-700 border-sky-200',
}

const getMonthEventPresentation = (event: CalendarEvent): { label: string; Icon: LucideIcon; classes: string } => {
  const type = `${event.eventType || ''} ${event.title}`.toLowerCase()
  if (event.module === 'Funnels') {
    return { label: 'Funnel', Icon: Filter, classes: 'border-l-orange-500 bg-orange-50 text-orange-900' }
  }
  if (event.module === 'Quotations' || type.includes('quotation')) {
    return { label: 'Quotation', Icon: FileText, classes: 'border-l-violet-500 bg-violet-50 text-violet-900' }
  }
  if (event.module === 'Leads') {
    return { label: 'Lead', Icon: UserRound, classes: 'border-l-sky-500 bg-sky-50 text-sky-900' }
  }
  if (type.includes('renewal')) {
    return { label: 'Renewal', Icon: RotateCcw, classes: 'border-l-amber-500 bg-amber-50 text-amber-900' }
  }
  if (event.module === 'OPF') {
    return { label: 'OPF', Icon: BriefcaseBusiness, classes: 'border-l-orange-500 bg-orange-50 text-orange-900' }
  }
  if (type.includes('meeting')) {
    return { label: 'Meeting', Icon: CalendarDays, classes: 'border-l-emerald-500 bg-emerald-50 text-emerald-900' }
  }
  if (type.includes('call') || type.includes('callback')) {
    return { label: 'Call', Icon: Phone, classes: 'border-l-cyan-500 bg-cyan-50 text-cyan-900' }
  }
  if (type.includes('task') || type.includes('next action')) {
    return { label: 'Task', Icon: ListTodo, classes: 'border-l-indigo-500 bg-indigo-50 text-indigo-900' }
  }
  if (event.module === 'Mail Campaigns') {
    return { label: 'Mail Campaign', Icon: Mail, classes: 'border-l-pink-500 bg-pink-50 text-pink-900' }
  }
  if (event.module === 'Activities') {
    return { label: event.eventType || 'Activity', Icon: Clock3, classes: 'border-l-slate-500 bg-slate-50 text-slate-900' }
  }
  return { label: event.eventType || event.module, Icon: BriefcaseBusiness, classes: 'border-l-teal-500 bg-teal-50 text-teal-900' }
}

const formatEventAmount = (amount: CalendarEvent['amount'], currency?: string) => {
  if (amount === null || amount === undefined || amount === '') return ''
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }
  const raw = String(amount).trim()
  if (!raw) return ''
  const numeric = Number(raw.replace(/[,\s]/g, ''))
  if (Number.isFinite(numeric) && /^[A-Z]{3}$/.test(currency || '')) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency!, maximumFractionDigits: 0 }).format(numeric)
  }
  return raw
}

const formatDate = (value: Date) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDisplayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const getMonthLabel = (value: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(value)

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1)
const endOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth() + 1, 0)
const startOfWeek = (value: Date) => {
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  start.setDate(start.getDate() - start.getDay())
  return start
}

const getCalendarDays = (monthDate: Date) => {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const startWeekDay = monthStart.getDay()
  const daysInMonth = monthEnd.getDate()
  const totalCells = Math.ceil((startWeekDay + daysInMonth) / 7) * 7
  const days: Date[] = []

  for (let i = 0; i < totalCells; i += 1) {
    const date = new Date(monthStart)
    date.setDate(monthStart.getDate() - startWeekDay + i)
    days.push(date)
  }

  return days
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const priorityMap: Record<EventPriority, string> = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const getEventDateTime = (event: CalendarEvent) => new Date(`${event.date}T${event.time}:00`)

const getDashboardDrawerTitle: Record<DashboardDrawerKey, string> = {
  'today-events': "Today's Events",
  'upcoming-events': 'Upcoming Events',
  'overdue-activities': 'Overdue Activities',
  'meetings-today': 'Meetings Today',
}

const csvCell = (value: string | undefined) => `"${String(value || '').replace(/"/g, '""')}"`

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [today, setToday] = useState(() => new Date())
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedView, setSelectedView] = useState<'Month' | 'Week' | 'Day' | 'List'>('Month')
  const [activityTypeFilter, setActivityTypeFilter] = useState('All')
  const [employeeFilter, setEmployeeFilter] = useState('All')
  const [customerFilter, setCustomerFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [eventPendingDeletion, setEventPendingDeletion] = useState<CalendarEvent | null>(null)
  const [isEventActionLoading, setIsEventActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [dashboardDrawer, setDashboardDrawer] = useState<DashboardDrawerKey | null>(null)
  const [isAddEventOpen, setIsAddEventOpen] = useState(false)
  const [isDrawerClosing, setIsDrawerClosing] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    module: 'Meetings' as Exclude<CalendarModule, 'All'>,
    customer: '',
    lead: '',
    contact: '',
    supplier: '',
    date: formatDate(today),
    time: '09:00',
    endTime: '10:00',
    priority: 'Medium' as EventPriority,
    assignedTo: 'Anaya Patel',
    location: '',
    reminderBefore: '15 minutes',
    notes: '',
    type: 'Meeting' as 'Meeting' | 'Call' | 'Task' | 'Reminder' | 'Demo' | 'Site Visit' | 'Personal Event' | 'Holiday',
  })

  const loadEvents = useCallback(async (refresh = false) => {
      try {
        if (refresh) setIsRefreshing(true)
        else setIsLoadingEvents(true)
        setActionError(null)
        const data = await fetchCalendarEvents()
        const mappedEvents: CalendarEvent[] = data.map((event: CalendarApiEvent) => ({
          id: event.id,
          title: event.title,
          category: event.eventType === 'Mail Campaign' ? 'Mail Campaign' : event.eventType === 'Meeting' ? 'Customer Meeting' : event.module === 'Leads' ? 'Lead Follow-up' : event.module === 'Quotations' || event.module === 'OPF' ? 'Quotation Reminder' : event.status === 'Completed' ? 'Completed Activity' : event.priority === 'High' ? 'High Priority' : 'Scheduled Activity',
          module: (event.module || 'Activities') as Exclude<CalendarModule, 'All'>,
          description: event.description || `${event.title} scheduled in ${event.module}.`,
          customer: event.customerName || undefined,
          lead: event.contactName || event.customerName || undefined,
          assignedTo: event.assignedTo || 'Unassigned',
          priority: (event.priority || 'Medium') as EventPriority,
          status: (event.status || 'Pending') as 'Pending' | 'Completed' | 'In Progress',
          date: event.date,
          time: event.time,
          endTime: event.endTime || '',
          location: undefined,
          reminderBefore: undefined,
          notes: event.description || '',
          referenceId: event.referenceId,
          referenceModule: event.referenceModule,
          targetId: event.targetId || event.referenceId,
          recordLabel: event.recordLabel,
          quotationType: event.quotationType,
          eventType: event.eventType,
          sourceField: event.sourceField,
          color: event.color,
          amount: event.amount,
          amountCurrency: event.amountCurrency,
        }))

        setEvents(mappedEvents)
      } catch (error) {
        console.error('Unable to load calendar events', error)
        setActionError('Unable to refresh calendar activities. Please try again.')
      } finally {
        setIsLoadingEvents(false)
        setIsRefreshing(false)
      }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (!actionError) return
    const timeout = window.setTimeout(() => setActionError(null), 5000)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [actionError])

  const activityTypes = useMemo(
    () => ['All', ...Array.from(new Set(events.map((event) => event.eventType || event.title).filter(Boolean))).sort()],
    [events],
  )
  const assignedEmployees = useMemo(
    () => ['All', ...Array.from(new Set(events.map((event) => event.assignedTo).filter(Boolean))).sort()],
    [events],
  )
  const customers = useMemo(
    () => ['All', ...Array.from(new Set(events.map((event) => event.customer).filter(Boolean) as string[])).sort()],
    [events],
  )
  const filteredEvents = useMemo(() => events.filter((event) => {
    if (activityTypeFilter !== 'All' && (event.eventType || event.title) !== activityTypeFilter) return false
    if (employeeFilter !== 'All' && event.assignedTo !== employeeFilter) return false
    if (customerFilter !== 'All' && event.customer !== customerFilter) return false
    if (dateFrom && event.date < dateFrom) return false
    if (dateTo && event.date > dateTo) return false
    return true
  }), [events, activityTypeFilter, employeeFilter, customerFilter, dateFrom, dateTo])

  const todaysEvents = useMemo(
    () =>
      filteredEvents.filter((event) => isSameDay(new Date(`${event.date}T${event.time}:00`), today)),
    [filteredEvents, today],
  )

  const summaryCards = useMemo(() => {
    const todaysCount = filteredEvents.filter((event) => isSameDay(getEventDateTime(event), today)).length
    const upcomingCount = filteredEvents.filter((event) => event.date > formatDate(today)).length
    const overdueCount = filteredEvents.filter(
      (event) => event.date < formatDate(today) && event.status !== 'Completed',
    ).length
    const meetingsTodayCount = filteredEvents.filter(
      (event) =>
        isSameDay(getEventDateTime(event), today) &&
        (event.module === 'Meetings' || event.category === 'Customer Meeting' || event.title.toLowerCase().includes('meeting')),
    ).length

    return [
      {
        key: 'today-events' as DashboardDrawerKey,
        title: 'Today\'s Events',
        count: todaysCount,
        icon: CalendarDays,
        subtitle: 'Scheduled today',
        accent: 'bg-blue-50 text-blue-600',
      },
      {
        key: 'upcoming-events' as DashboardDrawerKey,
        title: 'Upcoming Events',
        count: upcomingCount,
        icon: Clock3,
        subtitle: 'Next in queue',
        accent: 'bg-orange-50 text-orange-600',
      },
      {
        key: 'overdue-activities' as DashboardDrawerKey,
        title: 'Overdue Activities',
        count: overdueCount,
        icon: AlertTriangle,
        subtitle: 'Need attention',
        accent: 'bg-rose-50 text-rose-600',
      },
      {
        key: 'meetings-today' as DashboardDrawerKey,
        title: 'Meetings Today',
        count: meetingsTodayCount,
        icon: Users,
        subtitle: 'Calls and reviews',
        accent: 'bg-green-50 text-green-600',
      },
    ]
  }, [filteredEvents, today])

  const monthDays = useMemo(() => getCalendarDays(currentDate), [currentDate])

  const scheduleForToday = useMemo(
    () =>
      [...filteredEvents]
        .filter((event) => isSameDay(new Date(`${event.date}T${event.time}:00`), today))
        .sort((a, b) => a.time.localeCompare(b.time))
        .slice(0, 6),
    [filteredEvents, today],
  )

  const sidebarEvents = useMemo(() => {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    const nextMonth = new Date(today)
    nextMonth.setMonth(today.getMonth() + 1)

    return [
      {
        label: 'Tomorrow',
        items: filteredEvents.filter((event) => {
          const eventDate = new Date(`${event.date}T${event.time}:00`)
          return eventDate >= tomorrow && eventDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
        }),
      },
      {
        label: 'This Week',
        items: filteredEvents.filter((event) => {
          const eventDate = new Date(`${event.date}T${event.time}:00`)
          return eventDate > today && eventDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        }),
      },
      {
        label: 'Next Week',
        items: filteredEvents.filter((event) => {
          const eventDate = new Date(`${event.date}T${event.time}:00`)
          return eventDate > new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) && eventDate <= new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
        }),
      },
      {
        label: 'This Month',
        items: filteredEvents.filter((event) => {
          const eventDate = new Date(`${event.date}T${event.time}:00`)
          return eventDate > today && eventDate <= nextMonth
        }),
      },
    ]
  }, [filteredEvents, today])

  const eventListForList = useMemo(
    () => filteredEvents
      .filter((event) => event.date >= formatDate(startOfMonth(currentDate)) && event.date <= formatDate(endOfMonth(currentDate)))
      .sort((a, b) => new Date(`${a.date}T${a.time}:00`).getTime() - new Date(`${b.date}T${b.time}:00`).getTime()),
    [filteredEvents, currentDate],
  )

  const visibleCalendarDays = useMemo(() => {
    if (selectedView === 'Day') return [new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())]
    if (selectedView === 'Week') return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(currentDate), index))
    return []
  }, [currentDate, selectedView])

  const monthCellEvents = (day: Date) =>
    filteredEvents
      .filter((event) => event.date === formatDate(day))
      .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title))

  const expandedDateEvents = useMemo(
    () => expandedDate ? filteredEvents.filter((event) => event.date === expandedDate).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title)) : [],
    [expandedDate, filteredEvents],
  )

  const openDashboardDrawer = (key: DashboardDrawerKey) => {
    setSelectedEvent(null)
    setDashboardDrawer(key)
  }

  const closeDrawer = () => {
    setIsDrawerClosing(true)
    window.setTimeout(() => {
      setSelectedEvent(null)
      setDashboardDrawer(null)
      setIsDrawerClosing(false)
    }, 250)
  }

  const getModuleRoute = (event: CalendarEvent, mode: 'open' | 'edit') => {
    const id = event.targetId || event.referenceId
    if (!id) throw new Error('This calendar event has no source record ID.')
    if (event.module === 'Quotations') {
      const quotationId = event.recordLabel
      if (!quotationId) throw new Error('This quotation event has no quotation ID.')
      const type = event.quotationType ? `&type=${encodeURIComponent(event.quotationType)}` : ''
      return `/sales/quotation?recordId=${encodeURIComponent(quotationId)}${type}`
    }
    if (event.module === 'Funnels') return `/sales/funnels?recordId=${encodeURIComponent(id)}`
    if (event.module === 'OPF' && /renewal/i.test(`${event.eventType || ''} ${event.title}`)) {
      return `/sales/renewals?recordId=${encodeURIComponent(id)}`
    }
    if (event.module === 'OPF') {
      return `/sales/opf?recordId=${encodeURIComponent(id)}`
    }
    if (event.referenceModule === 'Leads') return `/sales/leads?recordId=${encodeURIComponent(id)}`
    if (event.referenceModule === 'Activities') return `/sales/activities/edit/${id}`
    if (event.referenceModule === 'Customers') return `/customers/edit/${id}`
    if (event.referenceModule === 'Contacts') return `/sales/contacts/edit/${id}`
    if (event.referenceModule === 'Mail Campaigns') return mode === 'edit' ? `/sales/mail-campaign/edit/${id}` : `/sales/mail-campaign/view/${id}`
    if (event.referenceModule === 'Suppliers') return `/sales/suppliers/edit/${id}`
    throw new Error(`No route is configured for ${event.referenceModule || event.module}.`)
  }

  const handleOpenCalendarEvent = (event: CalendarEvent) => {
    try {
      navigate(getModuleRoute(event, 'open'))
    } catch (error) {
      console.error('Calendar event navigation error:', error)
      setActionError(error instanceof Error ? error.message : 'Unable to open the related CRM record.')
    }
  }

  const handleOpenModule = () => {
    if (!selectedEvent) return
    try {
      navigate(getModuleRoute(selectedEvent, 'open'))
    } catch (error) {
      console.error('Calendar event action error:', error)
      setActionError(error instanceof Error ? error.message : 'Unable to open the related module.')
    }
  }

  const handleEditEvent = () => {
    if (!selectedEvent) return
    try {
      navigate(getModuleRoute(selectedEvent, 'edit'))
    } catch (error) {
      console.error('Calendar event action error:', error)
      setActionError(error instanceof Error ? error.message : 'Unable to edit this event.')
    }
  }

  const handleMarkComplete = async () => {
    if (!selectedEvent?.referenceId || !selectedEvent.referenceModule) return
    setIsEventActionLoading(true)
    try {
      await completeCalendarEvent(selectedEvent.referenceModule, selectedEvent.referenceId)
      await loadEvents()
      setSelectedEvent((current) => current ? { ...current, status: 'Completed' } : current)
    } catch (error: any) {
      console.error('Calendar event action error:', error?.response?.data || error)
      setActionError(error?.response?.data?.message || 'Unable to mark this event complete.')
    } finally {
      setIsEventActionLoading(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!eventPendingDeletion?.referenceId || !eventPendingDeletion.referenceModule) return
    setIsEventActionLoading(true)
    try {
      await deleteCalendarEvent(eventPendingDeletion.referenceModule, eventPendingDeletion.referenceId, eventPendingDeletion.sourceField || '')
      setEventPendingDeletion(null)
      setSelectedEvent(null)
      await loadEvents()
    } catch (error: any) {
      console.error('Calendar event action error:', error?.response?.data || error)
      setActionError(error?.response?.data?.message || 'Unable to delete this event.')
    } finally {
      setIsEventActionLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedEvent && !dashboardDrawer && !expandedDate) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (expandedDate) setExpandedDate(null)
        else closeDrawer()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedEvent, dashboardDrawer, expandedDate])

  useEffect(() => {
    if (!selectedEvent && !dashboardDrawer) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedEvent, dashboardDrawer])

  const goToToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

  const navigateCalendarDate = (direction: -1 | 1) => {
    const next = new Date(currentDate)
    if (selectedView === 'Day') next.setDate(next.getDate() + direction)
    else if (selectedView === 'Week') next.setDate(next.getDate() + direction * 7)
    else next.setMonth(next.getMonth() + direction)
    setCurrentDate(next)
  }

  const handleExportCalendar = () => {
    try {
      if (!filteredEvents.length) {
        setActionError('There are no calendar activities to export.')
        return
      }
      const headers = ['Title', 'Event Type', 'Module', 'Date', 'Start Time', 'End Time', 'Record ID', 'Description', 'Status', 'Customer', 'Contact', 'Assigned Employee', 'Priority', 'Amount']
      const rows = filteredEvents.map((event) => [
        event.title,
        event.eventType,
        event.module,
        event.date,
        event.time,
        event.endTime,
        event.recordLabel,
        event.description,
        event.status,
        event.customer,
        event.lead,
        event.assignedTo,
        event.priority,
        formatEventAmount(event.amount, event.amountCurrency),
      ].map(csvCell).join(','))
      const blob = new Blob([`\uFEFF${headers.map(csvCell).join(',')}\r\n${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'Sales_Calendar_Activities.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Unable to export calendar activities:', error)
      setActionError('Unable to export calendar activities. Please try again.')
    }
  }

  const handleSubmitEvent = () => {
    setIsAddEventOpen(false)
    navigate('/sales/activities/new')
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="crm-page-heading">Calendar</h1>
          {/* <p className="text-gray-600">Manage meetings, follow-ups, reminders, campaigns and business activities from one place.</p> */}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Add Activity', primary: true, onClick: () => navigate('/sales/activities/new') },
            { label: 'Today', primary: false, onClick: goToToday },
            { label: 'Refresh', primary: false, onClick: () => void loadEvents(true) },
            { label: 'Export Calendar', primary: false, onClick: handleExportCalendar },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.label === 'Refresh' && isRefreshing}
              className={
                action.primary
                  ? 'rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1E293B]'
                  : 'rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-[#F2EFE8]'
              }
            >
              {action.label === 'Refresh' ? <RefreshCw className={`mr-2 inline h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> : null}
              {action.label === 'Export Calendar' ? <Download className="mr-2 inline h-4 w-4" /> : null}
              {isRefreshing && action.label === 'Refresh' ? 'Refreshing...' : action.label}
            </button>
          ))}
        </div>
      </div>

      {actionError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div> : null}
      {isLoadingEvents && events.length === 0 ? <div role="status" className="rounded-lg border border-[#EFECE5] bg-white px-4 py-6 text-center text-sm text-gray-500">Loading calendar activities...</div> : null}

      <div className="grid gap-3 rounded-xl border border-[#EFECE5] bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-xs font-medium text-gray-600">
          Activity type
          <select value={activityTypeFilter} onChange={(event) => setActivityTypeFilter(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm text-gray-800">
            {activityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-gray-600">
          Assigned employee
          <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm text-gray-800">
            {assignedEmployees.map((employee) => <option key={employee} value={employee}>{employee}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-gray-600">
          Customer
          <select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm text-gray-800">
            {customers.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-gray-600">
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm text-gray-800" />
        </label>
        <label className="space-y-1 text-xs font-medium text-gray-600">
          To
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm text-gray-800" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ key, title, count, icon: Icon, subtitle, accent }) => (
          <button
            key={title}
            type="button"
            onClick={() => openDashboardDrawer(key)}
            className="sales-summary-card flex w-full items-center gap-3 text-left transition"
          >
            <div className={`sales-summary-card-icon ${accent}`}>
              <Icon />
            </div>
            <div className="min-w-0">
              <p className="sales-summary-card-value">{count}</p>
              <p className="sales-summary-card-label mt-0.5">{title}</p>
              <p className="sales-summary-card-description mt-0.5 truncate">{subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#EFECE5] pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateCalendarDate(-1)}
                className="rounded-lg border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]"
                aria-label={`Previous ${selectedView === 'Day' ? 'day' : selectedView === 'Week' ? 'week' : 'month'}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-2xl font-serif font-bold text-gray-900">
                {selectedView === 'Month'
                  ? getMonthLabel(currentDate)
                  : selectedView === 'Day'
                    ? formatDisplayDate(formatDate(currentDate))
                    : selectedView === 'Week'
                      ? `${formatDisplayDate(formatDate(visibleCalendarDays[0]))} - ${formatDisplayDate(formatDate(visibleCalendarDays[6]))}`
                      : getMonthLabel(currentDate)}
              </div>
              <button
                type="button"
                onClick={() => navigateCalendarDate(1)}
                className="rounded-lg border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]"
                aria-label={`Next ${selectedView === 'Day' ? 'day' : selectedView === 'Week' ? 'week' : 'month'}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {['Month', 'Week', 'Day', 'List'].map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setSelectedView(view as 'Month' | 'Week' | 'Day' | 'List')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    selectedView === view
                      ? 'bg-[#111827] text-white'
                      : 'border border-[#EFECE5] bg-white text-gray-700 hover:bg-[#F2EFE8]'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          {selectedView === 'Month' && (
            <div className="mt-5">
              <div className="grid grid-cols-7 border border-[#EFECE5]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="border-b border-r border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 border border-t-0 border-[#EFECE5]">
                {monthDays.map((day) => {
                  const eventsForDay = monthCellEvents(day)
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                  const isToday = isSameDay(day, today)

                  return (
                    <div
                      key={formatDate(day)}
                      className={`min-h-[176px] overflow-hidden border-r border-b border-[#EFECE5] p-1.5 text-left last:border-r-0 sm:p-2 ${
                        !isCurrentMonth ? 'bg-[#FBFAF7] text-gray-400' : 'bg-white'
                      } ${isToday ? 'ring-1 ring-inset ring-[#111827]' : ''}`}
                    >
                      <div className={`mb-1.5 text-right text-xs ${isToday ? 'font-bold text-[#111827]' : 'font-medium text-gray-700'}`}>
                        {day.getDate()}
                      </div>

                      <div className="space-y-1 overflow-hidden">
                        {eventsForDay.slice(0, 2).map((event) => {
                          const presentation = getMonthEventPresentation(event)
                          const amount = formatEventAmount(event.amount, event.amountCurrency)
                          return (
                            <button
                              key={event.id}
                              type="button"
                              title={`${presentation.label}: ${event.title}${event.customer ? ` · ${event.customer}` : ''}${event.recordLabel ? ` · ${event.recordLabel}` : ''}${amount ? ` · ${amount}` : ''}`}
                              onClick={() => handleOpenCalendarEvent(event)}
                              className={`block w-full min-w-0 overflow-hidden rounded-r border border-transparent border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-95 sm:text-xs ${presentation.classes}`}
                            >
                              <span className="flex min-w-0 items-center gap-1 font-semibold">
                                <presentation.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">{presentation.label}: {event.title}</span>
                                <span className="ml-auto shrink-0 font-normal opacity-75">{event.time}</span>
                              </span>
                              {event.customer ? <span className="mt-0.5 block truncate pl-4">{event.customer}</span> : null}
                              {event.recordLabel ? <span className="mt-0.5 block truncate pl-4">{event.recordLabel}</span> : null}
                              {amount ? <span className="mt-0.5 block truncate pl-4 font-semibold">{amount}</span> : null}
                            </button>
                          )
                        })}
                        {eventsForDay.length > 2 ? (
                          <button
                            type="button"
                            onClick={() => setExpandedDate(formatDate(day))}
                            className="w-full truncate px-1 text-left text-xs font-semibold text-blue-700 hover:underline"
                            aria-label={`Show ${eventsForDay.length - 2} more activities on ${formatDisplayDate(formatDate(day))}`}
                          >
                            +{eventsForDay.length - 2} more
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {selectedView === 'List' && (
            <div className="mt-5 space-y-4">
              {eventListForList.length ? eventListForList.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleOpenCalendarEvent(event)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#EFECE5] bg-[#FAF8F2] p-4 text-left transition hover:bg-[#F2EFE8]"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{event.title}</div>
                    <div className="mt-1 text-xs text-gray-500">{event.eventType || event.module} · {formatDisplayDate(event.date)} · {event.time}</div>
                    <div className="mt-1 text-xs text-gray-600">{event.customer || 'No customer'}{event.recordLabel ? ` · ${event.recordLabel}` : ''}</div>
                    {formatEventAmount(event.amount, event.amountCurrency) ? <div className="mt-1 text-xs font-semibold text-gray-700">{formatEventAmount(event.amount, event.amountCurrency)}</div> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${moduleColorMap[event.category]}`}>{event.module}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityMap[event.priority]}`}>{event.priority}</span>
                  </div>
                </button>
              )) : <div className="rounded-lg border border-dashed border-[#EFECE5] p-8 text-center text-sm text-gray-500">No calendar activities found.</div>}
            </div>
          )}

          {selectedView !== 'Month' && selectedView !== 'List' && (
            <div className="mt-5 overflow-x-auto">
              <div className={`grid min-w-[700px] ${selectedView === 'Week' ? 'grid-cols-7' : 'grid-cols-1'} rounded-lg border border-[#EFECE5]`}>
                {visibleCalendarDays.map((day) => {
                  const dayEvents = monthCellEvents(day).sort((a, b) => a.time.localeCompare(b.time))
                  return (
                    <section key={formatDate(day)} className={`min-h-[320px] border-r border-[#EFECE5] last:border-r-0 ${isSameDay(day, today) ? 'bg-[#FAF8F2]' : 'bg-white'}`}>
                      <div className={`border-b border-[#EFECE5] px-3 py-3 text-center ${isSameDay(day, today) ? 'font-bold text-[#111827]' : 'font-semibold text-gray-700'}`}>
                        <div className="text-xs uppercase tracking-wide text-gray-500">{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day)}</div>
                        <div className="mt-1 text-sm">{formatDisplayDate(formatDate(day))}</div>
                      </div>
                      <div className="space-y-2 p-2">
                        {dayEvents.length ? dayEvents.map((event) => (
                          <button key={event.id} type="button" onClick={() => handleOpenCalendarEvent(event)} className={`w-full rounded-md border p-2 text-left ${moduleColorMap[event.category]}`}>
                            <span className="block text-xs font-semibold">{event.time}{event.endTime ? ` - ${event.endTime}` : ''}</span>
                            <span className="mt-1 block truncate text-xs">{event.title}</span>
                            <span className="mt-1 block truncate text-xs">{event.customer || event.recordLabel || ''}</span>
                          </button>
                        )) : <div className="py-4 text-center text-xs text-gray-400">No activities</div>}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-gray-900">Today&apos;s Schedule</h3>
              <BellRing className="h-4 w-4 text-[#111827]" />
            </div>

            <div className="space-y-3">
              {scheduleForToday.length > 0 ? (
                scheduleForToday.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleOpenCalendarEvent(event)}
                    className="flex w-full items-start gap-3 rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-3 text-left transition hover:bg-[#F2EFE8]"
                  >
                    <div className="min-w-[52px] text-sm font-semibold text-gray-700">{event.time}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900">{event.title}</div>
                      <div className="mt-1 text-xs text-gray-500">{event.customer || event.lead || 'CRM record'}</div>
                      {event.recordLabel ? <div className="mt-1 text-xs text-gray-500">{event.recordLabel}</div> : null}
                      {formatEventAmount(event.amount, event.amountCurrency) ? <div className="mt-1 text-xs font-semibold text-gray-700">{formatEventAmount(event.amount, event.amountCurrency)}</div> : null}
                      <div className="mt-2 text-[10px] uppercase tracking-wider text-gray-500">{event.assignedTo}</div>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${priorityMap[event.priority]}`}>{event.priority}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-[#EFECE5] bg-[#FAF8F2] p-4 text-sm text-gray-500">No items scheduled for today.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-serif font-bold text-gray-900">Upcoming Events</h3>
            <div className="space-y-4">
              {sidebarEvents.map((section) => (
                <div key={section.label}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{section.label}</div>
                  <div className="space-y-2">
                    {section.items.length > 0 ? (
                      section.items.slice(0, 2).map((event) => (
                        <button key={event.id} type="button" onClick={() => handleOpenCalendarEvent(event)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-3 text-left hover:bg-[#F2EFE8]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-gray-900">{formatDisplayDate(event.date)}</div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${moduleColorMap[event.category]}`}>{event.status}</span>
                          </div>
                          <div className="mt-2 text-sm text-gray-700">{event.title}</div>
                          <div className="mt-1 text-xs text-gray-500">{event.eventType || event.module} · {event.module} · {event.assignedTo}</div>
                          <div className="mt-1 text-xs text-gray-500">{event.customer || 'No customer'}{event.recordLabel ? ` · ${event.recordLabel}` : ''}</div>
                          {formatEventAmount(event.amount, event.amountCurrency) ? <div className="mt-1 text-xs font-semibold text-gray-700">{formatEventAmount(event.amount, event.amountCurrency)}</div> : null}
                        </button>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#EFECE5] bg-[#FAF8F2] p-3 text-xs text-gray-500">No events</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {(selectedEvent || dashboardDrawer) && (
        <div
          className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${isDrawerClosing ? 'opacity-0' : 'opacity-100'}`}
          onClick={closeDrawer}
        >
          <div
            className={`fixed right-0 top-[calc(4rem+20px)] z-50 h-[calc(100vh-4rem-20px)] w-full max-w-[480px] border-l border-[#EFECE5] bg-white shadow-2xl transition-transform duration-300 ease-out md:w-[70%] ${
              isDrawerClosing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
            }`}
            onClick={(event) => event.stopPropagation()}
            aria-label="CRM details drawer"
          >
            <div className="flex h-full flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EFECE5] bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 transition hover:bg-[#F2EFE8]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>

                <h3 className="text-base font-serif font-bold text-gray-900">
                  {selectedEvent ? 'Event Details' : dashboardDrawer ? getDashboardDrawerTitle[dashboardDrawer] : 'Details'}
                </h3>

                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg p-2 text-gray-500 transition hover:bg-[#F2EFE8] hover:text-gray-800"
                  aria-label="Close details drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 text-sm text-gray-700">
                {selectedEvent && (
                  <>
                    <div className="mb-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{selectedEvent.module}</div>
                      <h4 className="mt-2 text-2xl font-serif font-bold text-gray-900">{selectedEvent.title}</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Description</div>
                        <div className="mt-2">{selectedEvent.description}</div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-[#EFECE5] p-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</div>
                          <div className="mt-2 font-medium text-gray-900">{selectedEvent.customer || 'N/A'}</div>
                        </div>
                        <div className="rounded-lg border border-[#EFECE5] p-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Lead</div>
                          <div className="mt-2 font-medium text-gray-900">{selectedEvent.lead || 'N/A'}</div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-[#EFECE5] p-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Assigned User</div>
                          <div className="mt-2 font-medium text-gray-900">{selectedEvent.assignedTo}</div>
                        </div>
                        <div className="rounded-lg border border-[#EFECE5] p-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</div>
                          <div className="mt-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityMap[selectedEvent.priority]}`}>{selectedEvent.priority}</span></div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-[#EFECE5] p-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date</div>
                          <div className="mt-2 font-medium text-gray-900">{formatDisplayDate(selectedEvent.date)}</div>
                        </div>
                        <div className="rounded-lg border border-[#EFECE5] p-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Time</div>
                          <div className="mt-2 font-medium text-gray-900">{selectedEvent.time} - {selectedEvent.endTime}</div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#EFECE5] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Location</div>
                        <div className="mt-2 flex items-center gap-2 text-gray-900"><MapPin className="h-4 w-4 text-gray-500" /> {selectedEvent.location || 'CRM scheduler'}</div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <button type="button" onClick={handleOpenModule} className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E293B]">Open Module</button>
                        <button type="button" onClick={handleEditEvent} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700">Edit Event</button>
                        {selectedEvent.referenceModule !== 'OPF' && <button type="button" onClick={() => void handleMarkComplete()} disabled={isEventActionLoading || selectedEvent.status === 'Completed'} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{selectedEvent.status === 'Completed' ? 'Completed' : 'Mark Complete'}</button>}
                        <button type="button" onClick={() => setEventPendingDeletion(selectedEvent)} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">Delete</button>
                      </div>
                    </div>
                  </>
                )}

                {dashboardDrawer && (
                  <div className="space-y-5">
                    {dashboardDrawer === 'today-events' && (
                      <>
                        {todaysEvents.length > 0 ? (
                          todaysEvents.map((event) => (
                            <div key={event.id} className="rounded-xl border border-[#EFECE5] bg-[#FAF8F2] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">{event.time}</div>
                                  <div className="mt-1 text-base font-semibold text-gray-900">{event.title}</div>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityMap[event.priority]}`}>{event.priority}</span>
                              </div>

                              <div className="mt-3 space-y-2 text-xs text-gray-600">
                                <div><span className="font-semibold text-gray-700">Module:</span> {event.module}</div>
                                <div><span className="font-semibold text-gray-700">Customer / Lead:</span> {event.customer || event.lead || 'N/A'}</div>
                                <div><span className="font-semibold text-gray-700">Assigned User:</span> {event.assignedTo}</div>
                                <div><span className="font-semibold text-gray-700">Status:</span> <span className="rounded-full border border-[#EFECE5] bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700">{event.status}</span></div>
                              </div>

                              <div className="mt-4 flex flex-col gap-2">
                                <button type="button" className="rounded-lg bg-[#111827] px-3 py-2 text-sm font-medium text-white hover:bg-[#1E293B]">Open Module</button>
                                <button type="button" className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm font-medium text-gray-700">Edit Event</button>
                                <button type="button" className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm font-medium text-gray-700">Mark Complete</button>
                                <button type="button" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Delete</button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-[#EFECE5] bg-[#FAF8F2] p-4 text-sm text-gray-500">No events scheduled for today.</div>
                        )}
                      </>
                    )}

                    {dashboardDrawer === 'upcoming-events' && (
                      <>
                        {['Tomorrow', 'This Week', 'Next Week', 'This Month'].map((label) => {
                          const sectionMap = {
                            Tomorrow: filteredEvents.filter((event) => {
                              const eventDate = getEventDateTime(event)
                              const tomorrow = addDays(today, 1)
                              return eventDate > today && eventDate <= new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59)
                            }),
                            'This Week': filteredEvents.filter((event) => {
                              const eventDate = getEventDateTime(event)
                              return eventDate > today && eventDate <= addDays(today, 7)
                            }),
                            'Next Week': filteredEvents.filter((event) => {
                              const eventDate = getEventDateTime(event)
                              return eventDate > addDays(today, 7) && eventDate <= addDays(today, 14)
                            }),
                            'This Month': filteredEvents.filter((event) => {
                              const eventDate = getEventDateTime(event)
                              return eventDate > today && eventDate <= addDays(today, 30)
                            }),
                          }

                          const items = sectionMap[label as keyof typeof sectionMap]
                          if (!items.length) return null

                          return (
                            <div key={label} className="space-y-3">
                              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
                              {items.map((event) => (
                                <div key={event.id} className="rounded-xl border border-[#EFECE5] bg-[#FAF8F2] p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{formatDisplayDate(event.date)}</div>
                                      <div className="mt-1 text-base font-semibold text-gray-900">{event.title}</div>
                                    </div>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityMap[event.priority]}`}>{event.priority}</span>
                                  </div>

                                  <div className="mt-3 space-y-2 text-xs text-gray-600">
                                    <div><span className="font-semibold text-gray-700">Date:</span> {formatDisplayDate(event.date)}</div>
                                    <div><span className="font-semibold text-gray-700">Time:</span> {event.time}</div>
                                    <div><span className="font-semibold text-gray-700">Module:</span> {event.module}</div>
                                    <div><span className="font-semibold text-gray-700">Assigned User:</span> {event.assignedTo}</div>
                                    <div><span className="font-semibold text-gray-700">Status:</span> {event.status}</div>
                                  </div>

                                  <div className="mt-4 flex flex-col gap-2">
                                    <button type="button" className="rounded-lg bg-[#111827] px-3 py-2 text-sm font-medium text-white hover:bg-[#1E293B]">Open Module</button>
                                    <button type="button" className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm font-medium text-gray-700">Edit</button>
                                    <button type="button" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Delete</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </>
                    )}

                    {dashboardDrawer === 'overdue-activities' && (
                      <>
                        {filteredEvents.filter((event) => getEventDateTime(event) < today && event.status !== 'Completed').length > 0 ? (
                          filteredEvents
                            .filter((event) => getEventDateTime(event) < today && event.status !== 'Completed')
                            .map((event) => {
                              const daysOverdue = Math.max(0, Math.ceil((today.getTime() - getEventDateTime(event).getTime()) / (1000 * 60 * 60 * 24)))

                              return (
                                <div key={event.id} className="rounded-xl border border-[#EFECE5] bg-[#FAF8F2] p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="text-base font-semibold text-gray-900">{event.title}</div>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityMap[event.priority]}`}>{event.priority}</span>
                                  </div>

                                  <div className="mt-3 space-y-2 text-xs text-gray-600">
                                    <div><span className="font-semibold text-gray-700">Due Date:</span> {formatDisplayDate(event.date)}</div>
                                    <div><span className="font-semibold text-gray-700">Days Overdue:</span> {daysOverdue}</div>
                                    <div><span className="font-semibold text-gray-700">Assigned User:</span> {event.assignedTo}</div>
                                    <div><span className="font-semibold text-gray-700">Status:</span> {event.status}</div>
                                  </div>

                                  <div className="mt-4 flex flex-col gap-2">
                                    <button type="button" className="rounded-lg bg-[#111827] px-3 py-2 text-sm font-medium text-white hover:bg-[#1E293B]">Open Activity</button>
                                    <button type="button" className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm font-medium text-gray-700">Mark Complete</button>
                                    <button type="button" className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm font-medium text-gray-700">Reschedule</button>
                                    <button type="button" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Delete</button>
                                  </div>
                                </div>
                              )
                            })
                        ) : (
                          <div className="rounded-xl border border-dashed border-[#EFECE5] bg-[#FAF8F2] p-4 text-sm text-gray-500">No overdue activities.</div>
                        )}
                      </>
                    )}

                    {dashboardDrawer === 'meetings-today' && (
                      <>
                        {filteredEvents.filter((event) => isSameDay(getEventDateTime(event), today) && (event.module === 'Meetings' || event.category === 'Customer Meeting' || event.title.toLowerCase().includes('meeting'))).length > 0 ? (
                          filteredEvents
                            .filter((event) => isSameDay(getEventDateTime(event), today) && (event.module === 'Meetings' || event.category === 'Customer Meeting' || event.title.toLowerCase().includes('meeting')))
                            .map((event) => {
                              const isOnline = /zoom|teams|meet|webinar|online/i.test(event.location || '')

                              return (
                                <div key={event.id} className="rounded-xl border border-[#EFECE5] bg-[#FAF8F2] p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="text-base font-semibold text-gray-900">{event.title}</div>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityMap[event.priority]}`}>{event.priority}</span>
                                  </div>

                                  <div className="mt-3 space-y-2 text-xs text-gray-600">
                                    <div><span className="font-semibold text-gray-700">Customer:</span> {event.customer || 'N/A'}</div>
                                    <div><span className="font-semibold text-gray-700">Contact Person:</span> {event.lead || event.customer || 'N/A'}</div>
                                    <div><span className="font-semibold text-gray-700">Time:</span> {event.time}</div>
                                    <div><span className="font-semibold text-gray-700">Location:</span> {event.location || 'CRM scheduler'}</div>
                                    <div><span className="font-semibold text-gray-700">Meeting Type:</span> {event.category}</div>
                                    <div><span className="font-semibold text-gray-700">Assigned User:</span> {event.assignedTo}</div>
                                  </div>

                                  <div className="mt-4 flex flex-col gap-2">
                                    {isOnline && <button type="button" className="rounded-lg bg-[#111827] px-3 py-2 text-sm font-medium text-white hover:bg-[#1E293B]">Join Meeting</button>}
                                    <button type="button" className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm font-medium text-gray-700">Open Customer</button>
                                    <button type="button" className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm font-medium text-gray-700">Edit Meeting</button>
                                    <button type="button" className="rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm font-medium text-gray-700">Mark Completed</button>
                                  </div>
                                </div>
                              )
                            })
                        ) : (
                          <div className="rounded-xl border border-dashed border-[#EFECE5] bg-[#FAF8F2] p-4 text-sm text-gray-500">No meetings scheduled today.</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {expandedDate && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/35 px-4 py-6"
          onClick={() => setExpandedDate(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-day-events-title"
            className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#EFECE5] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-[#EFECE5] px-4 py-3">
              <div>
                <h2 id="calendar-day-events-title" className="text-base font-semibold text-gray-900">
                  Activities on {formatDisplayDate(expandedDate)}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">{expandedDateEvents.length} scheduled activities</p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedDate(null)}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-[#F2EFE8]"
                aria-label="Close activities for date"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-2 overflow-y-auto p-3">
              {expandedDateEvents.map((event) => {
                const presentation = getMonthEventPresentation(event)
                const amount = formatEventAmount(event.amount, event.amountCurrency)
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      setExpandedDate(null)
                      handleOpenCalendarEvent(event)
                    }}
                    className={`block w-full rounded-r-lg border border-transparent border-l-4 p-3 text-left transition hover:brightness-95 ${presentation.classes}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <presentation.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{presentation.label}: {event.title}</span>
                      <span className="ml-auto shrink-0 text-xs font-medium">{event.time}</span>
                    </span>
                    <span className="mt-1 block pl-6 text-xs">{event.customer || 'No related customer'}</span>
                    {event.recordLabel ? <span className="mt-1 block pl-6 text-xs">{event.recordLabel}</span> : null}
                    {amount ? <span className="mt-1 block pl-6 text-xs font-semibold">{amount}</span> : null}
                    <span className="mt-1 block pl-6 text-xs opacity-75">{event.module} · {event.status}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {eventPendingDeletion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4" onClick={() => !isEventActionLoading && setEventPendingDeletion(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-event-title" className="w-full max-w-md rounded-lg bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#EFECE5] px-5 py-4">
              <h2 id="delete-event-title" className="text-lg font-bold text-gray-900">Delete Event</h2>
              <button type="button" onClick={() => setEventPendingDeletion(null)} disabled={isEventActionLoading} className="rounded-lg p-2 text-gray-500 hover:bg-[#F2EFE8] disabled:opacity-50" aria-label="Close delete event confirmation"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 py-6 text-sm text-gray-700">Are you sure to want to delete this event?</div>
            <div className="flex justify-end gap-3 border-t border-[#EFECE5] px-5 py-4">
              <button type="button" onClick={() => setEventPendingDeletion(null)} disabled={isEventActionLoading} className="rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void handleDeleteEvent()} disabled={isEventActionLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{isEventActionLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        title="Add Event"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setIsAddEventOpen(false)} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700">
              Cancel
            </button>
            <button type="button" onClick={handleSubmitEvent} className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E293B]">
              Save
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Title</label>
            <input
              value={newEvent.title}
              onChange={(event) => setNewEvent((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Description</label>
            <textarea
              value={newEvent.description}
              onChange={(event) => setNewEvent((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Related Module</label>
              <select
                value={newEvent.module}
                onChange={(event) => setNewEvent((current) => ({ ...current, module: event.target.value as Exclude<CalendarModule, 'All'> }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {moduleOptions.filter((option) => option !== 'All').map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Type</label>
              <select
                value={newEvent.type}
                onChange={(event) => setNewEvent((current) => ({ ...current, type: event.target.value as 'Meeting' | 'Call' | 'Task' | 'Reminder' | 'Demo' | 'Site Visit' | 'Personal Event' | 'Holiday' }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {['Meeting', 'Call', 'Task', 'Reminder', 'Demo', 'Site Visit', 'Personal Event', 'Holiday'].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Lead</label>
              <input
                value={newEvent.lead}
                onChange={(event) => setNewEvent((current) => ({ ...current, lead: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</label>
              <input
                value={newEvent.customer}
                onChange={(event) => setNewEvent((current) => ({ ...current, customer: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</label>
              <input
                value={newEvent.contact}
                onChange={(event) => setNewEvent((current) => ({ ...current, contact: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Supplier</label>
              <input
                value={newEvent.supplier}
                onChange={(event) => setNewEvent((current) => ({ ...current, supplier: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Date</label>
              <input
                type="date"
                value={newEvent.date}
                onChange={(event) => setNewEvent((current) => ({ ...current, date: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</label>
              <select
                value={newEvent.priority}
                onChange={(event) => setNewEvent((current) => ({ ...current, priority: event.target.value as EventPriority }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {['Low', 'Medium', 'High'].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Time</label>
              <input
                type="time"
                value={newEvent.time}
                onChange={(event) => setNewEvent((current) => ({ ...current, time: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">End Time</label>
              <input
                type="time"
                value={newEvent.endTime}
                onChange={(event) => setNewEvent((current) => ({ ...current, endTime: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Assigned To</label>
              <input
                value={newEvent.assignedTo}
                onChange={(event) => setNewEvent((current) => ({ ...current, assignedTo: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Location</label>
              <input
                value={newEvent.location}
                onChange={(event) => setNewEvent((current) => ({ ...current, location: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Reminder Before</label>
              <select
                value={newEvent.reminderBefore}
                onChange={(event) => setNewEvent((current) => ({ ...current, reminderBefore: event.target.value }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {['No reminder', '15 minutes', '30 minutes', '1 hour', '2 hours', '1 day'].map((reminder) => (
                  <option key={reminder} value={reminder}>{reminder}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Status</label>
              <div className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700">Pending</div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Notes</label>
            <textarea
              value={newEvent.notes}
              onChange={(event) => setNewEvent((current) => ({ ...current, notes: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>

        </div>
      </Modal>
    </div>
  )
}
