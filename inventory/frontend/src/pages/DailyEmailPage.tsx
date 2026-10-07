'use client'

import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { Close } from '@mui/icons-material'

interface EmailSettings {
  ceoEmail: string
  ccEmails: string[]
  dailyReportEnabled?: boolean
  morningReportEnabled?: boolean
  morningReportTime?: string
  eveningReportEnabled?: boolean
  eveningReportTime?: string
  timezone?: string
  companyName?: string
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const contentType = response.headers.get('content-type') || ''

  if (!response.ok) {
    const text = await response.text()
    let message = `Request failed (${response.status})`

    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(text)
        message = parsed?.error || parsed?.message || message
      } catch {
        // ignore parse failures and keep the fallback message
      }
    } else if (text && text.trim().startsWith('<')) {
      message = 'The server returned HTML instead of JSON. Check the backend route and proxy configuration.'
    } else if (text) {
      message = text.slice(0, 200)
    }

    throw new Error(message)
  }

  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>
  }

  const text = await response.text()
  if (!text) return {} as T

  if (text.trim().startsWith('<')) {
    throw new Error('The server returned HTML instead of JSON. Check the backend route and proxy configuration.')
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Unexpected non-JSON response from the server.')
  }
}

export default function DailyEmailPage() {
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const data = await apiRequest<EmailSettings>('/api/daily-email/settings')
      setSettings(
        data || {
          ceoEmail: '',
          ccEmails: [],
          dailyReportEnabled: true,
          morningReportEnabled: true,
          morningReportTime: '10:00',
          eveningReportEnabled: false,
          eveningReportTime: '17:50',
          timezone: 'Asia/Kolkata',
          companyName: '3Vikram Technologies',
        }
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!settings) return

    if (!settings.ceoEmail) {
      setError('CEO email is required')
      return
    }

    try {
      setSaving(true)
      const data = await apiRequest<{ data?: EmailSettings }>('/api/daily-email/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      setSettings(data.data || settings)
      setSuccess('Settings saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSchedule = async (type: 'daily') => {
    if (!settings) return

    try {
      const enabled = !(settings.dailyReportEnabled ?? settings.morningReportEnabled ?? false)
      const data = await apiRequest<{ data?: EmailSettings }>(`/api/daily-email/settings/toggle/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      setSettings(data.data || settings)
      setSuccess(`Daily report ${enabled ? 'enabled' : 'disabled'}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle schedule')
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!settings) {
    return <Alert severity="error">Failed to load email settings</Alert>
  }

  const visibleCcEmails = settings.ccEmails.filter((email) => email && email.trim())

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        p: { xs: 2, md: 3 },
        bgcolor: '#F5F6F8',
        minHeight: '100%',
      }}
    >
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0B1F33', mb: 1 }}>
            Daily Stock Email
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              border: '1px solid #E5E7EB',
              borderRadius: 4,
              p: 3,
              bgcolor: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0B1F33', mb: 0.5 }}>
              Email Recipients
            </Typography>
            <Typography variant="body2" sx={{ color: '#5F6B76', mb: 2.5 }}>
              Choose who receives the daily In Stock report.
            </Typography>

            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0B1F33', mb: 1 }}>
                  TO
                </Typography>
                <TextField
                  label="CEO / TO Email"
                  value={settings.ceoEmail}
                  onChange={(e) => setSettings({ ...settings, ceoEmail: e.target.value })}
                  fullWidth
                  placeholder="ceo@example.com"
                  error={!settings.ceoEmail && saving}
                  sx={{
                    '& .MuiInputBase-root': {
                      borderRadius: 2,
                      backgroundColor: '#FAFBFC',
                      minHeight: 56,
                    },
                    '& .MuiInputLabel-root': { fontSize: '0.96rem' },
                  }}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0B1F33', mb: 1 }}>
                  CC MEMBERS
                </Typography>

                <Stack spacing={1.25}>
                  {settings.ccEmails.map((email, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                      <TextField
                        value={email}
                        onChange={(e) => {
                          const newCc = [...settings.ccEmails]
                          newCc[index] = e.target.value
                          setSettings({ ...settings, ccEmails: newCc })
                        }}
                        fullWidth
                        placeholder={`CC Member ${index + 1}`}
                        size="small"
                        sx={{
                          '& .MuiInputBase-root': {
                            borderRadius: 2,
                            backgroundColor: '#FAFBFC',
                            minHeight: 48,
                          },
                        }}
                      />
                      <IconButton
                        onClick={() => {
                          const newCc = settings.ccEmails.filter((_, i) => i !== index)
                          setSettings({ ...settings, ccEmails: newCc })
                        }}
                        size="small"
                        sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>

                {settings.ccEmails.length < 5 && (
                  <Button
                    variant="outlined"
                    size="medium"
                    onClick={() => setSettings({ ...settings, ccEmails: [...settings.ccEmails, ''] })}
                    sx={{
                      mt: 2,
                      borderRadius: 2,
                      fontWeight: 600,
                      px: 2,
                    }}
                  >
                    + Add CC Member
                  </Button>
                )}
              </Box>

              <Button
                variant="contained"
                onClick={handleSaveSettings}
                disabled={saving}
                sx={{
                  alignSelf: 'flex-start',
                  borderRadius: 2,
                  px: 3,
                  py: 1.2,
                  fontWeight: 700,
                  boxShadow: 'none',
                  backgroundColor: '#06283D',
                  '&:hover': { backgroundColor: '#041F33' },
                }}
              >
                {saving ? 'Saving...' : 'Save Recipients'}
              </Button>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              border: '1px solid #E5E7EB',
              borderRadius: 4,
              p: 3,
              bgcolor: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0B1F33', mb: 0.5 }}>
              Daily Email
            </Typography>
            <Typography variant="body2" sx={{ color: '#5F6B76', mb: 2.5 }}>
              Automatically send the latest In Stock asset report every day.
            </Typography>

            <Card
              elevation={0}
              sx={{
                border: '1px solid #E5E7EB',
                borderRadius: 2,
                bgcolor: '#F8FAFC',
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#0B1F33' }}>
                      Enable Daily Email
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#5F6B76', mt: 0.5 }}>
                      Automatically sends the current In Stock report to configured recipients.
                    </Typography>
                  </Box>
                  <Switch
                    checked={Boolean(settings.dailyReportEnabled ?? settings.morningReportEnabled ?? false)}
                    onChange={() => handleToggleSchedule('daily')}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#06283D' },
                      '& .MuiSwitch-track': { backgroundColor: '#C7D2FE' },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ mt: 2.5 }}>
              <Button
                variant="contained"
                onClick={handleSaveSettings}
                disabled={saving}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1.2,
                  fontWeight: 700,
                  boxShadow: 'none',
                  backgroundColor: '#06283D',
                  '&:hover': { backgroundColor: '#041F33' },
                }}
              >
                {saving ? 'Saving...' : 'Save Daily Email Setting'}
              </Button>
            </Box>
          </Paper>
        </Box>

        <Paper
          elevation={0}
          sx={{
            border: '1px solid #E5E7EB',
            borderRadius: 4,
            p: 3,
            bgcolor: '#FFFFFF',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0B1F33', mb: 2 }}>
            Email Preview
          </Typography>

          <Box
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid #E5E7EB',
              background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                TO
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.75, color: '#0F172A', fontWeight: 500 }}>
                {settings.ceoEmail || 'smitha@synov.in'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                CC
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.75, color: '#0F172A', fontWeight: 500 }}>
                {visibleCcEmails.length > 0 ? visibleCcEmails.join(', ') : 'Not configured'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                SUBJECT
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.75, color: '#0F172A', fontWeight: 500 }}>
                Daily In Stock Report - [Date]
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, pt: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                ATTACHMENT
              </Typography>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.8,
                  borderRadius: 1.5,
                  border: '1px solid #D9E3F0',
                  bgcolor: '#EEF5FF',
                  color: '#0B5ED7',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                }}
              >
                Daily_In_Stock_Report_[Date].xlsx
              </Box>
            </Box>
          </Box>

        </Paper>
      </Box>
    </Box>
  )
}
