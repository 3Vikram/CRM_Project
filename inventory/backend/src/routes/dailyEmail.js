import express from 'express'
import { DailyEmailSettings } from '../models/DailyEmailSettings.js'
import { EmailHistory } from '../models/EmailHistory.js'
import { sendTestEmail, restartEmailScheduler } from '../services/emailScheduler.js'

const router = express.Router()

const defaultSettings = {
  ceoEmail: '',
  ccEmails: [],
  dailyReportEnabled: true,
  morningReportEnabled: true,
  morningReportTime: '10:00',
  eveningReportEnabled: true,
  eveningReportTime: '17:50',
  timezone: 'Asia/Kolkata',
  companyName: '3Vikram Technologies',
}

// GET email settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await DailyEmailSettings.findOne().lean()

    if (!settings) {
      return res.json(defaultSettings)
    }

    res.json({
      ...defaultSettings,
      ...settings,
      ccEmails: Array.isArray(settings.ccEmails) ? settings.ccEmails : [],
    })
  } catch (error) {
    console.error('[Daily Email] GET settings error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// PUT email settings
router.put('/settings', async (req, res) => {
  try {
    const {
      ceoEmail,
      ccEmails,
      dailyReportEnabled,
      morningReportEnabled,
      morningReportTime,
      eveningReportEnabled,
      eveningReportTime,
      timezone,
      companyName,
    } = req.body

    if (!ceoEmail || !ceoEmail.match(/.+\@.+\..+/)) {
      return res.status(400).json({
        error: 'Valid CEO email is required',
      })
    }

    if (ccEmails && ccEmails.length > 5) {
      return res.status(400).json({
        error: 'Maximum 5 CC recipients allowed',
      })
    }

    if (ccEmails) {
      for (const email of ccEmails) {
        if (!email.match(/.+\@.+\..+/)) {
          return res.status(400).json({
            error: `Invalid CC email: ${email}`,
          })
        }
      }
    }

    let settings = await DailyEmailSettings.findOne()

    if (!settings) {
      settings = new DailyEmailSettings()
    }

    const finalDailyReportEnabled =
      dailyReportEnabled ?? morningReportEnabled ?? true

    settings.ceoEmail = ceoEmail
    settings.ccEmails = ccEmails || []
    settings.dailyReportEnabled = finalDailyReportEnabled
    settings.morningReportEnabled = finalDailyReportEnabled
    settings.morningReportTime = morningReportTime || '10:00'

    settings.eveningReportEnabled = false
    settings.eveningReportTime = '17:50'

    settings.timezone = timezone || 'Asia/Kolkata'
    settings.companyName = companyName || '3Vikram Technologies'
    settings.lastUpdatedBy = req.user?.email || 'System'

    await settings.save()
    await restartEmailScheduler()

    res.json({
      success: true,
      message: 'Email settings updated successfully',
      data: settings,
    })
  } catch (error) {
    console.error('[Daily Email] PUT settings error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// POST send test email
router.post('/send-test', async (req, res) => {
  try {
    // IMPORTANT DEBUG LOG
    console.log('🔥🔥🔥 SEND-TEST ROUTE HIT 🔥🔥🔥')
    console.log('[Daily Email] Request body:', req.body)

    const { testEmail } = req.body

    const settings = await DailyEmailSettings.findOne()

    console.log(
      '[Daily Email] Settings found:',
      settings ? 'YES' : 'NO'
    )

    const recipient = (
      testEmail ||
      settings?.ceoEmail ||
      ''
    ).trim()

    console.log(
      '[Daily Email] Test recipient:',
      recipient || 'NO RECIPIENT'
    )

    if (!recipient) {
      return res.status(400).json({
        error:
          'Email settings not configured. Please provide a test recipient or configure the CEO email first.',
      })
    }

    console.log(
      `[Daily Email] Calling sendTestEmail() for: ${recipient}`
    )

    await sendTestEmail(recipient)

    console.log(
      `[Daily Email] sendTestEmail() completed successfully for: ${recipient}`
    )

    return res.json({
      success: true,
      message: 'Test email sent successfully',
    })
  } catch (error) {
    const message =
      error && error.message
        ? error.message
        : 'Email sending failed'

    console.error(
      '[Daily Email] send-test route error:',
      message
    )

    return res.status(500).json({
      error: message,
    })
  }
})

// GET email history
router.get('/history', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      reportType,
      status,
    } = req.query

    const query = {}

    if (reportType) {
      query.reportType = reportType
    }

    if (status) {
      query.status = status
    }

    const skip =
      (parseInt(page, 10) - 1) *
      parseInt(limit, 10)

    const history = await EmailHistory.find(query)
      .sort({ scheduledDate: -1, _id: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))

    const total = await EmailHistory.countDocuments(query)

    res.json({
      success: true,
      data: history,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(
          total / parseInt(limit, 10)
        ),
      },
    })
  } catch (error) {
    console.error(
      '[Daily Email] GET history error:',
      error.message
    )

    res.status(500).json({
      error: error.message,
    })
  }
})

// GET email history by ID
router.get('/history/:id', async (req, res) => {
  try {
    const emailRecord =
      await EmailHistory.findById(req.params.id)

    if (!emailRecord) {
      return res.status(404).json({
        error: 'Email record not found',
      })
    }

    res.json(emailRecord)
  } catch (error) {
    res.status(500).json({
      error: error.message,
    })
  }
})

// DELETE email history record
router.delete('/history/:id', async (req, res) => {
  try {
    const result =
      await EmailHistory.findByIdAndDelete(
        req.params.id
      )

    if (!result) {
      return res.status(404).json({
        error: 'Email record not found',
      })
    }

    res.json({
      success: true,
      message: 'Email history deleted successfully',
    })
  } catch (error) {
    res.status(500).json({
      error: error.message,
    })
  }
})

// PUT toggle schedule
router.put('/settings/toggle/:type', async (req, res) => {
  try {
    const { type } = req.params
    const { enabled } = req.body

    if (!['daily', 'morning', 'evening'].includes(type)) {
      return res.status(400).json({
        error:
          'Invalid schedule type. Must be daily, morning, or evening.',
      })
    }

    let settings =
      await DailyEmailSettings.findOne()

    if (!settings) {
      return res.status(404).json({
        error: 'Email settings not found',
      })
    }

    const finalEnabled = Boolean(enabled)

    settings.dailyReportEnabled =
      type === 'daily'
        ? finalEnabled
        : settings.dailyReportEnabled

    settings.morningReportEnabled =
      type === 'morning'
        ? finalEnabled
        : settings.morningReportEnabled

    settings.eveningReportEnabled =
      type === 'evening'
        ? finalEnabled
        : settings.eveningReportEnabled

    await settings.save()
    await restartEmailScheduler()

    res.json({
      success: true,
      message: `${type} schedule ${
        finalEnabled ? 'enabled' : 'disabled'
      }`,
      data: settings,
    })
  } catch (error) {
    console.error(
      '[Daily Email] Toggle error:',
      error.message
    )

    res.status(500).json({
      error: error.message,
    })
  }
})

export default router