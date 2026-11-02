import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, List, X } from 'lucide-react'
import { clearNotifications, getNotificationState, markRead } from '@/sales/lib/notificationState'
import { fetchNotifications, type NotificationItem } from '@/sales/lib/notificationApi'

type NotificationTab = 'mine' | 'all'
type StoredNotificationState = ReturnType<typeof getNotificationState>

const relativeTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [storedState, setStoredState] = useState<StoredNotificationState>(() => getNotificationState())
  const [activeTab, setActiveTab] = useState<NotificationTab>('mine')
  const selectedTab = useRef(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  const loadNotifications = useCallback(async () => {
    setItems(await fetchNotifications())
    setStoredState(getNotificationState())
  }, [])

  useEffect(() => {
    void loadNotifications()
    const interval = window.setInterval(() => {
      if (!document.hidden) void loadNotifications()
    }, 60_000)
    const handleVisibility = () => {
      if (!document.hidden) void loadNotifications()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadNotifications])

  useEffect(() => {
    if (isOpen) void loadNotifications()
  }, [isOpen, loadNotifications])

  useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const visibleItems = useMemo(
    () => items.filter((item) => !storedState.cleared.includes(item.id)),
    [items, storedState.cleared],
  )
  const myItems = useMemo(() => visibleItems.filter((item) => item.mine), [visibleItems])
  const unreadCount = visibleItems.filter((item) => !storedState.read.includes(item.id)).length
  const tabItems = activeTab === 'mine' ? myItems : visibleItems
  const unreadCountLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  useEffect(() => {
    if (!selectedTab.current) setActiveTab(myItems.length ? 'mine' : 'all')
  }, [myItems.length])

  const updateState = (nextState: StoredNotificationState) => {
    setStoredState(nextState)
  }

  const handleItemClick = (item: NotificationItem) => {
    updateState(markRead([item.id]))
    setIsOpen(false)
    navigate(item.link)
  }

  const handleClear = () => {
    updateState(clearNotifications(tabItems.map((item) => item.id)))
  }

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    navigate(path)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="relative inline-flex rounded-lg p-1 text-slate-600 hover:bg-slate-100 sm:p-2"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? <span className="absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">{unreadCountLabel}</span> : null}
      </button>

      {isOpen ? (
        <section
          aria-label="Notifications panel"
          className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-[#EFECE5] bg-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Notification</h2>
              {unreadCount > 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{unreadCountLabel}</span> : null}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleClear} disabled={!tabItems.length} className="text-xs font-semibold text-slate-500 hover:text-slate-900 disabled:cursor-default disabled:opacity-40">Clear</button>
              <button type="button" aria-label="Close notifications" onClick={() => setIsOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="mx-4 flex rounded-lg bg-slate-100 p-1">
            <button type="button" onClick={() => { selectedTab.current = true; setActiveTab('mine') }} className={`flex-1 rounded-md px-2 py-2 text-xs font-semibold transition ${activeTab === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>My Items ({myItems.length})</button>
            <button type="button" onClick={() => { selectedTab.current = true; setActiveTab('all') }} className={`flex-1 rounded-md px-2 py-2 text-xs font-semibold transition ${activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>All Items ({visibleItems.length})</button>
          </div>

          <div className="max-h-[360px] min-h-36 overflow-y-auto px-2 py-2">
            {tabItems.length ? tabItems.map((item) => {
              const isUnread = !storedState.read.includes(item.id)
              return (
                <button key={item.id} type="button" onClick={() => handleItemClick(item)} className="block w-full rounded-lg px-3 py-3 text-left transition hover:bg-slate-50">
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs"><span className="font-bold text-blue-700">{item.category}</span><span className="text-slate-400"> / {item.module}</span></span>
                    <span className="shrink-0 text-[10px] text-slate-400">{relativeTime(item.createdAt)}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    {isUnread ? <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : <span className="h-2 w-2 shrink-0" />}
                    <span className={`min-w-0 flex-1 truncate text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{item.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </span>
                  <span className="mt-1 block truncate pl-4 text-xs text-slate-500">{item.description}</span>
                </button>
              )
            }) : (
              <div className="flex min-h-32 flex-col items-center justify-center text-center">
                <Bell className="h-6 w-6 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No notifications</p>
                <p className="mt-0.5 text-xs text-slate-400">You're all caught up.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#EFECE5] bg-[#F7F5EF] px-4 py-3">
            <button type="button" onClick={() => handleNavigate('/sales/dashboard')} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Dashboard</button>
            <button type="button" onClick={() => handleNavigate('/sales/activities')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"><List className="h-3.5 w-3.5" />All Activities</button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
