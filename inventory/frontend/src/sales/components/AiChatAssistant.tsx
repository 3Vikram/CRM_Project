import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Bot, Send, Trash2, X } from 'lucide-react'
import { hasPermission } from '@/sales/lib/permissions'
import {
  salesAnalyticsApi,
  type AnalyticsPeriod,
  type AnalyticsRow,
  type AssistantChartKey,
  type AssistantHistoryMessage,
  type AssistantIntent,
  type AssistantResult,
  type AssistantTable,
  type SalesAnalytics,
} from '@/sales/lib/salesAnalyticsApi'

type ChatPeriod = Exclude<AnalyticsPeriod, 'custom'>
type ChartKey = AssistantChartKey
type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  period?: ChatPeriod
  chartKey?: ChartKey | null
  table?: AssistantTable | null
  intent?: AssistantIntent
  reportState?: 'offered' | 'sent' | 'dismissed'
  isError?: boolean
}
type StoredChat = { messages: ChatMessage[]; period: ChatPeriod }
type ChartSpec = { title: string; rows: AnalyticsRow[]; category: string; metric: string; currency: boolean }

const STORAGE_KEY = 'sales_ai_chat'
const chartKeys: ChartKey[] = ['revenueTrend', 'customers', 'quotations', 'employees', 'funnel', 'products', 'activities']
const periods: { value: ChatPeriod; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This week' },
  { value: 'monthly', label: 'This month' },
  { value: 'quarterly', label: 'This quarter' },
  { value: 'half-yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'This year' },
]
const suggestions = [
  'Show me this year’s sales performance',
  'What is our total revenue?',
  'How many quotations were generated?',
  'Which employee generated the highest revenue?',
  'Which leads are pending conversion?',
  'Show overdue activities',
]
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const compactMoney = (value: number) => `₹${Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)}`
const countValue = (value: number) => new Intl.NumberFormat('en-IN').format(value || 0)

const isChatPeriod = (value: unknown): value is ChatPeriod => periods.some((item) => item.value === value)
const isChartKey = (value: unknown): value is ChartKey => chartKeys.includes(value as ChartKey)
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')
const isAssistantTable = (value: unknown): value is AssistantTable => Boolean(
  value
  && typeof value === 'object'
  && typeof (value as AssistantTable).title === 'string'
  && isStringArray((value as AssistantTable).columns)
  && Array.isArray((value as AssistantTable).rows)
  && (value as AssistantTable).rows.every((row) => isStringArray(row)),
)

const readStoredChat = (): StoredChat => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return { messages: [], period: 'yearly' }
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return { messages: [], period: 'yearly' }
    const value = parsed as { messages?: unknown; period?: unknown }
    const messages = Array.isArray(value.messages)
      ? value.messages.filter((message): message is ChatMessage => {
        if (!message || typeof message !== 'object') return false
        const item = message as ChatMessage
        return typeof item.id === 'string'
          && (item.role === 'user' || item.role === 'assistant')
          && typeof item.text === 'string'
      }).map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        ...(isChatPeriod(message.period) ? { period: message.period } : {}),
        chartKey: isChartKey(message.chartKey) ? message.chartKey : null,
        table: isAssistantTable(message.table) ? message.table : null,
        ...(message.intent && ['greeting', 'issue', 'chat', 'crm'].includes(message.intent) ? { intent: message.intent } : {}),
        ...(message.reportState && ['offered', 'sent', 'dismissed'].includes(message.reportState) ? { reportState: message.reportState } : {}),
        ...(message.isError === true ? { isError: true } : {}),
      })).slice(-50)
      : []
    return { messages, period: isChatPeriod(value.period) ? value.period : 'yearly' }
  } catch {
    return { messages: [], period: 'yearly' }
  }
}

const chartFor = (data: SalesAnalytics, chartKey: ChartKey): ChartSpec => {
  const charts = data.charts
  return {
    revenueTrend: { title: 'Revenue trend', rows: charts.revenueTrend, category: 'label', metric: 'revenue', currency: true },
    customers: { title: 'Customer revenue', rows: charts.customerRevenue, category: 'customer', metric: 'revenue', currency: true },
    quotations: { title: 'Quotations by customer', rows: charts.quotationsByCustomer, category: 'customer', metric: 'quotations', currency: false },
    employees: { title: 'Employee revenue', rows: charts.employeeRevenue, category: 'employee', metric: 'revenue', currency: true },
    funnel: { title: 'Lead funnel', rows: charts.funnel, category: 'stage', metric: 'count', currency: false },
    products: { title: 'Product revenue', rows: charts.productRevenue, category: 'product', metric: 'revenue', currency: true },
    activities: { title: 'Activity volume', rows: charts.activityTrend, category: 'label', metric: 'count', currency: false },
  }[chartKey]
}

const newMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
const isNumericValue = (value: string) => /^-?\d[\d,]*(\.\d+)?%?$/.test(value.trim())

const AssistantText = ({ text }: { text: string }) => {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  return (
    <div className="space-y-1.5 text-sm">
      {lines.map((line, index) => {
        if (/^#{1,3}\s/.test(line)) {
          return <p key={index} className="font-semibold text-slate-900">{line.replace(/^#{1,3}\s*/, '')}</p>
        }
        if (/^[-*]\s/.test(line)) {
          return <p key={index} className="flex gap-2"><span aria-hidden="true">•</span><span>{line.replace(/^[-*]\s*/, '')}</span></p>
        }
        return <p key={index} className="whitespace-pre-wrap leading-5">{line}</p>
      })}
    </div>
  )
}

export default function AiChatAssistant() {
  const [initialChat] = useState(readStoredChat)
  const [isOpen, setIsOpen] = useState(false)
  const [period, setPeriod] = useState<ChatPeriod>(initialChat.period)
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat.messages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportMode, setReportMode] = useState(false)
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [chartLoadState, setChartLoadState] = useState<Partial<Record<ChatPeriod, 'loading' | 'error'>>>({})
  const [, setChartRevision] = useState(0)
  const analyticsCache = useRef(new Map<ChatPeriod, SalesAnalytics>())
  const chartLoads = useRef(new Set<ChatPeriod>())
  const messagesEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-50), period }))
    } catch {
      console.warn('Unable to persist the Sales AI chat in session storage.')
    }
  }, [messages, period])

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0)
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [loading])

  useEffect(() => {
    const neededPeriods = new Set(
      messages
        .filter((message) => message.role === 'assistant' && message.chartKey && message.period)
        .map((message) => message.period as ChatPeriod),
    )
    neededPeriods.forEach((chartPeriod) => {
      if (analyticsCache.current.has(chartPeriod) || chartLoads.current.has(chartPeriod)) return
      chartLoads.current.add(chartPeriod)
      setChartLoadState((current) => ({ ...current, [chartPeriod]: 'loading' }))
      salesAnalyticsApi.getAnalytics({ period: chartPeriod })
        .then((data) => {
          analyticsCache.current.set(chartPeriod, data)
          setChartRevision((revision) => revision + 1)
          setChartLoadState((current) => ({ ...current, [chartPeriod]: undefined }))
        })
        .catch((cause: unknown) => {
          console.error('Unable to load Sales analytics for the assistant chart:', cause)
          setChartLoadState((current) => ({ ...current, [chartPeriod]: 'error' }))
        })
        .finally(() => chartLoads.current.delete(chartPeriod))
    })
  }, [messages])

  const askQuestion = async (value: string) => {
    const question = value.trim()
    if (!question || loading || question.length > 1000) return

    const selectedPeriod = period
    const userMessage: ChatMessage = { id: newMessageId(), role: 'user', text: question }
    setMessages((current) => [...current, userMessage].slice(-50))
    setInput('')
    if (reportMode) {
      setReportMode(false)
      await submitProblemReport(question, [...messages, userMessage])
      return
    }
    setLoading(true)
    try {
      const history: AssistantHistoryMessage[] = messages.slice(-4).map((message) => ({
        role: message.role,
        content: message.text,
      }))
      const result: AssistantResult = await salesAnalyticsApi.askAssistant(question, { period: selectedPeriod }, history)
      const isNonCrmIntent = ['greeting', 'issue', 'chat'].includes(result.intent || '')

      const assistantMessage: ChatMessage = {
        id: newMessageId(),
        role: 'assistant',
        text: result.answer,
        chartKey: !isNonCrmIntent && isChartKey(result.chartKey) ? result.chartKey : null,
        table: !isNonCrmIntent && isAssistantTable(result.table) ? result.table : null,
        intent: result.intent,
        ...(result.intent === 'issue' ? { reportState: 'offered' as const } : {}),
        period: selectedPeriod,
      }
      setMessages((current) => [...current, assistantMessage].slice(-50))
    } catch (cause) {
      const message = cause instanceof Error && cause.message
        ? cause.message
        : 'Something went wrong. Please try again.'
      const errorMessage: ChatMessage = {
        id: newMessageId(),
        role: 'assistant',
        text: message,
        isError: true,
      }
      setMessages((current) => [...current, errorMessage].slice(-50))
    } finally {
      setLoading(false)
    }
  }

  const submitProblemReport = async (message: string, context: ChatMessage[], issueMessageId?: string) => {
    const reportId = issueMessageId || newMessageId()
    setReportingMessageId(reportId)
    setLoading(true)
    try {
      await salesAnalyticsApi.reportAssistantIssue({
        message,
        page: window.location.pathname,
        recentMessages: context.slice(-6).map((item) => ({ role: item.role, content: item.text })),
      })
      if (issueMessageId) {
        setMessages((current) => current.map((item) => item.id === issueMessageId ? { ...item, reportState: 'sent' } : item))
      }
      const confirmation: ChatMessage = {
        id: newMessageId(),
        role: 'assistant',
        text: 'Done. I have sent this to the developer.',
      }
      setMessages((current) => [...current, confirmation].slice(-50))
    } catch (cause) {
      const errorMessage: ChatMessage = {
        id: newMessageId(),
        role: 'assistant',
        text: cause instanceof Error && cause.message ? cause.message : 'Something went wrong. Please try again.',
        isError: true,
      }
      setMessages((current) => [...current, errorMessage].slice(-50))
    } finally {
      setLoading(false)
      setReportingMessageId(null)
    }
  }

  const sendIssueReport = (messageIndex: number) => {
    const issueMessage = messages[messageIndex]
    const userMessage = messages.slice(0, messageIndex).reverse().find((item) => item.role === 'user')
    if (!issueMessage || !userMessage) {
      const missingMessage: ChatMessage = {
        id: newMessageId(),
        role: 'assistant',
        text: 'Unable to find the message to report. Please use "Report a problem" and describe it again.',
        isError: true,
      }
      setMessages((current) => [...current, missingMessage].slice(-50))
      return
    }
    setMessages((current) => current.map((item) => item.id === issueMessage.id ? { ...item, reportState: 'offered' } : item))
    void submitProblemReport(userMessage.text, messages.slice(Math.max(0, messageIndex - 5), messageIndex + 1), issueMessage.id)
  }

  const dismissIssueReport = (messageId: string) => {
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, reportState: 'dismissed' } : item))
  }

  const startReportMode = () => {
    setReportMode(true)
    const reportPrompt: ChatMessage = {
      id: newMessageId(),
      role: 'assistant',
      text: 'Describe the problem and I will send it to the developer.',
    }
    setMessages((current) => [...current, reportPrompt].slice(-50))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void askQuestion(input)
  }

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void askQuestion(input)
    }
  }

  if (!hasPermission('reports')) return null

  return (
    <>
      <button
        type="button"
        aria-label="Open AI assistant"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex rounded-lg p-1 text-slate-600 hover:bg-slate-100 sm:p-2"
      >
        <Bot className="h-5 w-5" />
      </button>

      {isOpen && (
        <section
          aria-label="AI Assistant"
          className="fixed right-3 top-[4.25rem] z-50 flex w-[min(26rem,calc(100vw-1.5rem))] h-[min(36rem,calc(100vh-6rem))] flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <header className="flex items-center gap-2 border-b border-slate-200 p-3">
            <Bot className="h-5 w-5 shrink-0 text-[#172640]" />
            <h2 className="min-w-0 flex-1 text-sm font-semibold text-slate-900">AI Assistant</h2>
            <select
              aria-label="Report period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as ChatPeriod)}
              className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" onClick={startReportMode} disabled={loading} className="whitespace-nowrap rounded-lg px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              Report a problem
            </button>
            <button type="button" aria-label="Start new conversation" title="Start new conversation" onClick={() => { setMessages([]); setReportMode(false) }} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <Trash2 className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Close AI assistant" onClick={() => setIsOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {!messages.length && (
              <div className="space-y-3">
                <p className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">Hello! I’m your Advanced Sales Assistant. Ask about revenue, quotations, leads, employees, customers or activities.</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} type="button" disabled={loading} onClick={() => void askQuestion(suggestion)} className="rounded-full border border-[#EDE7F6] bg-white px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-[#EDE7F6] disabled:opacity-50">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, messageIndex) => {
              const isUser = message.role === 'user'
              const chartData = message.chartKey && message.period ? analyticsCache.current.get(message.period) : undefined
              const chart = chartData && message.chartKey ? chartFor(chartData, message.chartKey) : undefined
              return (
                <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[92%] rounded-2xl p-3 ${isUser ? 'bg-[#172640] text-white' : message.isError ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'bg-slate-100 text-slate-800'}`}>
                    {isUser ? <p className="whitespace-pre-wrap text-sm">{message.text}</p> : <AssistantText text={message.text} />}
                    {message.table && (
                      <div className="mt-3">
                        <p className="mb-1 text-xs font-semibold">{message.table.title}</p>
                        <div className="overflow-x-auto rounded-md border border-slate-200">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead className="bg-[#EDE7F6]">
                              <tr>{message.table.columns.map((column, index) => <th key={`${column}-${index}`} className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-700">{column}</th>)}</tr>
                            </thead>
                            <tbody>
                              {message.table.rows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {message.table?.columns.map((_, columnIndex) => {
                                    const value = row[columnIndex] ?? '—'
                                    return <td key={columnIndex} className={`border-b border-slate-100 px-2 py-1.5 text-slate-700 ${isNumericValue(value) ? 'text-right' : ''}`}>{value}</td>
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {message.intent === 'issue' && message.reportState !== 'sent' && message.reportState !== 'dismissed' && (
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={loading} onClick={() => sendIssueReport(messageIndex)} className="rounded-md bg-[#172640] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
                          {reportingMessageId === message.id ? 'Sending…' : 'Send to developer'}
                        </button>
                        <button type="button" disabled={loading} onClick={() => dismissIssueReport(message.id)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 disabled:opacity-50">
                          No thanks
                        </button>
                      </div>
                    )}
                    {message.chartKey && message.period && chart && chart.rows.length > 0 && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="mb-2 text-xs font-semibold text-slate-600">{chart.title}</p>
                        <div className="h-40 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chart.rows}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey={chart.category} tick={{ fontSize: 10 }} />
                              <YAxis tickFormatter={chart.currency ? compactMoney : undefined} tick={{ fontSize: 10 }} width={52} />
                              <Tooltip formatter={(value) => chart.currency ? money.format(Number(value || 0)) : countValue(Number(value || 0))} />
                              <Bar dataKey={chart.metric} fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {message.chartKey && message.period && chartLoadState[message.period] === 'loading' && <p className="mt-2 text-xs text-slate-500">Loading chart…</p>}
                    {message.chartKey && message.period && chartLoadState[message.period] === 'error' && <p className="mt-2 text-xs text-rose-700">Chart data could not be loaded.</p>}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl bg-slate-100 p-3 text-slate-800">
                  <p className="text-sm">Thinking... {elapsedSeconds}s</p>
                  <p className="mt-1 text-xs text-slate-500">Open-ended questions can take a minute or two.</p>
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-slate-200 p-3">
            <textarea
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              maxLength={1000}
              disabled={loading}
              placeholder={reportMode ? 'Describe the problem...' : 'Ask a Sales question...'}
              aria-label="Ask the AI assistant"
              className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none disabled:bg-slate-50"
            />
            <button type="submit" aria-label="Send message" disabled={loading || !input.trim()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#172640] text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </>
  )
}
