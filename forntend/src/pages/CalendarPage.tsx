'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { Modal } from '@/components/modal'
import { completeCalendarEvent, deleteCalendarEvent, fetchCalendarEvents, type CalendarApiEvent } from '@/lib/calendarApi'

type ModuleFilter =
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

type EventPriority = 'Low' | 'Medium' | 'High'
type DashboardDrawerKey = 'today-events' | 'upcoming-events' | 'overdue-activities' | 'meetings-today'

type CalendarEvent = {
  id: string
  title: string
  category: 'Mail Campaign' | 'Lead Follow-up' | 'Customer Meeting' | 'Quotation Reminder' | 'High Priority' | 'Completed Activity'
  module: ModuleFilter extends 'All' ? never : Exclude<ModuleFilter, 'All'>
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
  eventType?: string
  sourceField?: string
  color?: string
}

const filterOptions: ModuleFilter[] = [
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
]

const moduleColorMap: Record<CalendarEvent['category'], string> = {
  'Mail Campaign': 'bg-[#F2EFE8] text-[#111827] border-[#111827]',
  'Lead Follow-up': 'bg-orange-100 text-orange-700 border-orange-200',
  'Customer Meeting': 'bg-green-100 text-green-700 border-green-200',
  'Quotation Reminder': 'bg-violet-100 text-violet-700 border-violet-200',
  'High Priority': 'bg-red-100 text-red-700 border-red-200',
  'Completed Activity': 'bg-slate-200 text-slate-700 border-slate-300',
}

const today = new Date()

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

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<ModuleFilter>('All')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedView, setSelectedView] = useState<'Month' | 'Week' | 'Day' | 'Agenda'>('Month')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [eventPendingDeletion, setEventPendingDeletion] = useState<CalendarEvent | null>(null)
  const [isEventActionLoading, setIsEventActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [dashboardDrawer, setDashboardDrawer] = useState<DashboardDrawerKey | null>(null)
  const [isAddEventOpen, setIsAddEventOpen] = useState(false)
  const [isDrawerClosing, setIsDrawerClosing] = useState(false)
  const navigate = useNavigate()

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    module: 'Meetings' as Exclude<ModuleFilter, 'All'>,
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

  const loadEvents = useCallback(async () => {
      try {
        setIsLoadingEvents(true)
        const data = await fetchCalendarEvents()
        const mappedEvents: CalendarEvent[] = data.map((event: CalendarApiEvent) => ({
          id: event.id,
          title: event.title,
          category: event.module === 'Mail Campaigns' ? 'Mail Campaign' : event.module === 'Leads' ? 'Lead Follow-up' : event.module === 'Customers' ? 'Customer Meeting' : event.module === 'Quotations' ? 'Quotation Reminder' : event.priority === 'High' ? 'High Priority' : 'Completed Activity',
          module: (event.referenceModule || event.module || 'Activities') as Exclude<ModuleFilter, 'All'>,
          description: event.description || `${event.title} scheduled in ${event.module}.`,
          customer: event.customerName || undefined,
          lead: event.contactName || event.customerName || undefined,
          assignedTo: event.assignedTo || 'Unassigned',
          priority: (event.priority || 'Medium') as EventPriority,
          status: (event.status || 'Pending') as 'Pending' | 'Completed' | 'In Progress',
          date: event.date,
          time: event.time,
          endTime: event.time,
          location: undefined,
          reminderBefore: undefined,
          notes: event.description || '',
          referenceId: event.referenceId,
          referenceModule: event.referenceModule,
          eventType: event.eventType,
          sourceField: event.sourceField,
          color: event.color,
        }))

        setEvents(mappedEvents)
      } catch (error) {
        console.error('Unable to load calendar events', error)
        setActionError('Unable to load calendar events.')
        setEvents([])
      } finally {
        setIsLoadingEvents(false)
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

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesFilter = selectedFilter === 'All' || event.module === selectedFilter || (selectedFilter === 'Meetings' && event.eventType === 'Meeting') || (selectedFilter === 'Calls' && event.eventType === 'Call') || (selectedFilter === 'Tasks' && event.eventType === 'Task')
      const query = searchTerm.trim().toLowerCase()
      const matchesSearch =
        !query ||
        [event.title, event.customer, event.lead, event.description, event.assignedTo, event.referenceModule]
          .filter(Boolean)
          .some((value) => (value ?? '').toLowerCase().includes(query))

      return matchesFilter && matchesSearch
    })
  }, [events, searchTerm, selectedFilter])

  const todaysEvents = useMemo(
    () =>
      filteredEvents.filter((event) => isSameDay(new Date(`${event.date}T${event.time}:00`), today)),
    [filteredEvents],
  )

  const summaryCards = useMemo(() => {
    const todaysCount = filteredEvents.filter((event) => isSameDay(getEventDateTime(event), today)).length
    const upcomingCount = filteredEvents.filter((event) => getEventDateTime(event) > today).length
    const overdueCount = filteredEvents.filter(
      (event) => getEventDateTime(event) < today && event.status !== 'Completed',
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
        accent: 'bg-[#F2EFE8] text-[#111827]',
      },
      {
        key: 'upcoming-events' as DashboardDrawerKey,
        title: 'Upcoming Events',
        count: upcomingCount,
        icon: Clock3,
        subtitle: 'Next in queue',
        accent: 'bg-violet-100 text-violet-700',
      },
      {
        key: 'overdue-activities' as DashboardDrawerKey,
        title: 'Overdue Activities',
        count: overdueCount,
        icon: AlertTriangle,
        subtitle: 'Need attention',
        accent: 'bg-amber-100 text-amber-700',
      },
      {
        key: 'meetings-today' as DashboardDrawerKey,
        title: 'Meetings Today',
        count: meetingsTodayCount,
        icon: Users,
        subtitle: 'Calls and reviews',
        accent: 'bg-emerald-100 text-emerald-700',
      },
    ]
  }, [filteredEvents])

  const monthDays = useMemo(() => getCalendarDays(currentDate), [currentDate])

  const scheduleForToday = useMemo(
    () =>
      [...filteredEvents]
        .filter((event) => isSameDay(new Date(`${event.date}T${event.time}:00`), today))
        .sort((a, b) => a.time.localeCompare(b.time))
        .slice(0, 6),
    [filteredEvents],
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
  }, [filteredEvents])

  const eventListForAgenda = useMemo(
    () => [...filteredEvents].sort((a, b) => new Date(`${a.date}T${a.time}:00`).getTime() - new Date(`${b.date}T${b.time}:00`).getTime()),
    [filteredEvents],
  )

  const monthCellEvents = (day: Date) =>
    filteredEvents.filter((event) => isSameDay(new Date(`${event.date}T${event.time}:00`), day))

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
    const id = event.referenceId
    if (!id) throw new Error('This calendar event has no source record ID.')
    if (event.referenceModule === 'Leads') return mode === 'edit' ? `/sales/leads/edit/${id}` : `/sales/leads/${id}`
    if (event.referenceModule === 'Activities') return `/sales/activities/edit/${id}`
    if (event.referenceModule === 'Customers') return `/customers/edit/${id}`
    if (event.referenceModule === 'Contacts') return `/sales/contacts/edit/${id}`
    if (event.referenceModule === 'Mail Campaigns') return mode === 'edit' ? `/sales/mail-campaign/edit/${id}` : `/sales/mail-campaign/view/${id}`
    if (event.referenceModule === 'Suppliers') return `/sales/suppliers/edit/${id}`
    throw new Error(`No route is configured for ${event.referenceModule || event.module}.`)
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
    if (!selectedEvent && !dashboardDrawer) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedEvent, dashboardDrawer])

  useEffect(() => {
    if (!selectedEvent && !dashboardDrawer) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedEvent, dashboardDrawer])

  const goToToday = () => setCurrentDate(new Date(today))

  const handleSubmitEvent = () => {
    if (!newEvent.title.trim()) return

    const nextEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: newEvent.title,
      category:
        newEvent.type === 'Meeting'
          ? 'Customer Meeting'
          : newEvent.type === 'Reminder'
            ? 'Quotation Reminder'
            : newEvent.type === 'Call'
              ? 'Lead Follow-up'
              : newEvent.type === 'Task'
                ? 'Completed Activity'
                : 'High Priority',
      module: newEvent.module,
      description: newEvent.description || 'Event created from the CRM calendar.',
      customer: newEvent.customer || undefined,
      lead: newEvent.lead || undefined,
      assignedTo: newEvent.assignedTo,
      priority: newEvent.priority,
      status: 'Pending',
      date: newEvent.date,
      time: newEvent.time,
      endTime: newEvent.endTime,
      location: newEvent.location || 'CRM scheduler',
      reminderBefore: newEvent.reminderBefore,
      notes: newEvent.notes || '',
    }

    setEvents((prev) => [nextEvent, ...prev])
    setIsAddEventOpen(false)
    setCurrentDate(new Date(`${newEvent.date}T00:00:00`))
    setSelectedFilter('All')
    setNewEvent({
      title: '',
      description: '',
      module: 'Meetings',
      customer: '',
      lead: '',
      contact: '',
      supplier: '',
      date: formatDate(today),
      time: '09:00',
      endTime: '10:00',
      priority: 'Medium',
      assignedTo: 'Anaya Patel',
      location: '',
      reminderBefore: '15 minutes',
      notes: '',
      type: 'Meeting',
    })
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
            { label: '+ Add Event', primary: true, onClick: () => setIsAddEventOpen(true) },
            { label: 'Today', primary: false, onClick: goToToday },
            { label: 'Refresh', primary: false, onClick: () => setCurrentDate(new Date(currentDate)) },
            { label: 'Export Calendar', primary: false, onClick: () => null },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={
                action.primary
                  ? 'rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1E293B]'
                  : 'rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-[#F2EFE8]'
              }
            >
              {action.label === 'Refresh' ? <RefreshCw className="mr-2 inline h-4 w-4" /> : null}
              {action.label === 'Export Calendar' ? <Download className="mr-2 inline h-4 w-4" /> : null}
              {action.label === '+ Add Event' ? <Plus className="mr-2 inline h-4 w-4" /> : null}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ key, title, count, icon: Icon, subtitle, accent }) => (
          <button
            key={title}
            type="button"
            onClick={() => openDashboardDrawer(key)}
            className="cursor-pointer rounded-xl border border-[#EFECE5] bg-white p-5 text-left shadow-sm transition hover:border-[#D9D1BF] hover:bg-[#FAF8F2]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <div className="mt-3 text-3xl font-serif font-bold text-gray-900">{count}</div>
              </div>
              <div className={`rounded-xl p-2 ${accent}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-gray-400">{subtitle}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {filterOptions.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  selectedFilter === filter
                    ? 'bg-[#111827] text-white'
                    : 'border border-[#EFECE5] bg-[#F8F7F3] text-gray-700 hover:bg-[#F2EFE8]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search calendar"
              className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#CEC9BD] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#EFECE5] pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="rounded-lg border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-2xl font-serif font-bold text-gray-900">{getMonthLabel(currentDate)}</div>
              <button
                type="button"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="rounded-lg border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {['Month', 'Week', 'Day', 'Agenda'].map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setSelectedView(view as 'Month' | 'Week' | 'Day' | 'Agenda')}
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
                      key={`${day.toISOString()}-${day.getDate()}`}
                      className={`min-h-[120px] border-r border-b border-[#EFECE5] p-2 text-left last:border-r-0 ${
                        !isCurrentMonth ? 'bg-[#FBFAF7] text-gray-400' : 'bg-white'
                      } ${isToday ? 'ring-1 ring-inset ring-[#111827]' : ''}`}
                    >
                      <div className={`mb-2 text-right text-sm ${isToday ? 'font-bold text-[#111827]' : 'font-medium text-gray-700'}`}>
                        {day.getDate()}
                      </div>

                      <div className="space-y-1">
                        {eventsForDay.slice(0, 3).map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setSelectedEvent(event)}
                            className={`w-full rounded px-2 py-1 text-left text-[10px] font-medium ${moduleColorMap[event.category]}`}
                          >
                            {event.title}
                          </button>
                        ))}
                        {eventsForDay.length > 3 && (
                          <div className="px-1 text-[10px] font-medium text-gray-500">+{eventsForDay.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {selectedView === 'Agenda' && (
            <div className="mt-5 space-y-4">
              {eventListForAgenda.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#EFECE5] bg-[#FAF8F2] p-4 text-left transition hover:bg-[#F2EFE8]"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{event.title}</div>
                    <div className="mt-1 text-xs text-gray-500">{formatDisplayDate(event.date)} • {event.time}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${moduleColorMap[event.category]}`}>{event.module}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityMap[event.priority]}`}>{event.priority}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedView !== 'Month' && selectedView !== 'Agenda' && (
            <div className="mt-5 space-y-4 rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-4">
              <div className="text-sm font-medium text-gray-600">{selectedView} view</div>
              <div className="space-y-3">
                {filteredEvents.slice(0, 6).map((event) => (
                  <div key={event.id} className="rounded-lg border border-[#EFECE5] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-gray-900">{event.title}</div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${moduleColorMap[event.category]}`}>{event.category}</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">{formatDisplayDate(event.date)} • {event.time}</div>
                  </div>
                ))}
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
                    onClick={() => setSelectedEvent(event)}
                    className="flex w-full items-start gap-3 rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-3 text-left transition hover:bg-[#F2EFE8]"
                  >
                    <div className="min-w-[52px] text-sm font-semibold text-gray-700">{event.time}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900">{event.title}</div>
                      <div className="mt-1 text-xs text-gray-500">{event.customer || event.lead || 'CRM record'}</div>
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
                        <div key={event.id} className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-gray-900">{formatDisplayDate(event.date)}</div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${moduleColorMap[event.category]}`}>{event.status}</span>
                          </div>
                          <div className="mt-2 text-sm text-gray-700">{event.title}</div>
                          <div className="mt-1 text-xs text-gray-500">{event.module} • {event.assignedTo}</div>
                        </div>
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
                        <button type="button" onClick={() => void handleMarkComplete()} disabled={isEventActionLoading || selectedEvent.status === 'Completed'} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{selectedEvent.status === 'Completed' ? 'Completed' : 'Mark Complete'}</button>
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

      {actionError && <div className="fixed bottom-5 right-5 z-[70] max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">{actionError}</div>}

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
                onChange={(event) => setNewEvent((current) => ({ ...current, module: event.target.value as Exclude<ModuleFilter, 'All'> }))}
                className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
              >
                {filterOptions.filter((filter) => filter !== 'All').map((filter) => (
                  <option key={filter} value={filter}>{filter}</option>
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
