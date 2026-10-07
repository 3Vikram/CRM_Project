import cron from 'node-cron'
import { DailyEmailSettings } from '../models/DailyEmailSettings.js'
import { EmailHistory } from '../models/EmailHistory.js'
import { sendEmailWithAttachment } from './emailService.js'
import { generateWorkbookBuffer } from './reportService.js'
import { Asset } from '../models/Asset.js'
import { AssetMovement } from '../models/AssetMovement.js'

let scheduledJob = null

const getIstDateKey = (date = new Date()) => date.toLocaleDateString('en-CA', {
  timeZone: 'Asia/Kolkata',
})

export const startEmailScheduler = async () => {
  try {
    const settings = await DailyEmailSettings.findOne()

    if (!settings) {
      console.log('ℹ No email settings configured. Daily email scheduler not started.')
      return
    }

    const dailyEnabled =
      settings.dailyReportEnabled ??
      settings.morningReportEnabled ??
      true

    if (dailyEnabled) {
      scheduledJob = cron.schedule('0 11 * * *', async () => {
        await runDailyEmailJob()
      }, { timezone: 'Asia/Kolkata' })

      console.log('✓ Daily email scheduler started')
    }
  } catch (error) {
    console.error('✗ Error starting daily email scheduler:', error.message)
  }
}

export const stopEmailScheduler = () => {
  if (scheduledJob) {
    scheduledJob.stop()
    scheduledJob = null
    console.log('✓ Daily email schedule stopped')
  }
}

export const restartEmailScheduler = async () => {
  stopEmailScheduler()
  await startEmailScheduler()
  console.log('✓ Daily email scheduler restarted')
}

export const runDailyEmailJob = async ({ testRun = false } = {}) => {
  const settings = await DailyEmailSettings.findOne()

  const dailyEnabled = Boolean(
    settings?.dailyReportEnabled ??
    settings?.morningReportEnabled ??
    true
  )

  console.log(`[Daily Email] Daily Email enabled: ${dailyEnabled}`)

  if (!settings) {
    throw new Error('No email settings configured')
  }

  if (!dailyEnabled) {
    console.log('[Daily Email] Daily email is disabled. Skipping job.')
    return false
  }

  if (!settings.ceoEmail) {
    throw new Error('Daily Email TO recipient is not configured')
  }

  const reportDate = new Date()
  const reportDateKey = testRun ? `test-${reportDate.getTime()}` : getIstDateKey(reportDate)
  const inventoryDateKey = getIstDateKey(reportDate)
  const reportType = testRun ? 'test' : 'daily'

  const formattedDate = new Date(reportDate).toLocaleDateString(
    'en-IN',
    { timeZone: 'Asia/Kolkata' }
  )

  let emailHistoryRecord

  try {
    emailHistoryRecord = await EmailHistory.findOneAndUpdate(
      {
        reportType,
        reportDateKey,
        status: { $nin: ['pending', 'sent'] },
      },
      {
        $set: {
          scheduledDate: reportDate,
          scheduledTime: 'Daily',
          recipients: {
            to: settings.ceoEmail,
            cc: settings.ccEmails,
          },
          subject: `Daily In Stock Report - ${formattedDate}`,
          status: 'pending',
          errorMessage: '',
        },
        $setOnInsert: {
          reportType,
          reportDateKey,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  } catch (error) {
    if (error?.code === 11000) {
      console.log('ℹ Daily email is already being processed today. Skipping duplicate.')
      return
    }
    throw error
  }

  try {
    // Fetch the current In Stock assets directly from MongoDB
    const inStockAssets = await Asset.find({
      $or: [
        { status: 'available' },
        { status: 'AVAILABLE' },
        { status: 'in_stock' },
        { status: 'IN_STOCK' },
        { status: 'IN STOCK' },
        { status: 'In Stock' },
      ],
    })
      .sort({ createdAt: -1 })
      .lean()

    const wasUpdatedToday = inStockAssets.some((asset) => {
      const updatedAt = asset.updatedAt || asset.createdAt
      return updatedAt && getIstDateKey(new Date(updatedAt)) === inventoryDateKey
    })

    const recentMovements = await AssetMovement.find({
      assetId: { $in: inStockAssets.map((asset) => asset._id) },
      $or: [
        { movementDate: { $gte: new Date(reportDate.getTime() - 48 * 60 * 60 * 1000) } },
        { createdAt: { $gte: new Date(reportDate.getTime() - 48 * 60 * 60 * 1000) } },
      ],
    }).select('movementDate createdAt').lean()

    const movementUpdatedToday = recentMovements.some((movement) => {
      return [movement.movementDate, movement.createdAt].some((timestamp) => timestamp && getIstDateKey(new Date(timestamp)) === inventoryDateKey)
    })

    const inventoryWasUpdatedToday = wasUpdatedToday || movementUpdatedToday

    console.log('[Daily Email] Current In Stock count:', inStockAssets.length)
    console.log('[Daily Email] Updated today:', inventoryWasUpdatedToday)

    const inventoryUpdateStatus = inventoryWasUpdatedToday
      ? 'Inventory Update Status: ✅ Updated Today'
      : '⚠️ In Stock Not Updated Today'

    const inventoryUpdateMessage = inventoryWasUpdatedToday
      ? ''
      : 'The In Stock inventory has not been updated today. Please verify and update the stock.'

    emailHistoryRecord.subject = inventoryWasUpdatedToday
      ? `Daily In Stock Report - ${formattedDate}`
      : `⚠️ Daily In Stock Report - Not Updated Today - ${formattedDate}`

    // Generate Excel report
    console.log('[Daily Email] Generating Excel...')
    const { buffer, filename } =
      await generateWorkbookBuffer('daily', reportDate)

    const emailBody =
      `${inventoryUpdateStatus}\n` +
      `${inventoryUpdateMessage ? `${inventoryUpdateMessage}\n` : ''}\n` +
      `Dear Sir/Madam,\n\n` +
      `Please find attached the Daily In Stock Report.\n\n` +
      `Regards,\n3 Vikram Technologies CRM`

    console.log('[Daily Email] Sending email...')
    await sendEmailWithAttachment({
      to: settings.ceoEmail,

      cc:
        settings.ccEmails &&
        settings.ccEmails.length > 0
          ? settings.ccEmails
          : undefined,

      subject: emailHistoryRecord.subject,

      text: emailBody,

      html:
        (inventoryWasUpdatedToday
          ? `<p><strong>${inventoryUpdateStatus}</strong></p>`
          : `<div style="border: 2px solid #dc2626; background: #fef2f2; color: #991b1b; padding: 12px; margin: 12px 0; font-weight: 700;"><p style="margin: 0 0 8px;">${inventoryUpdateStatus}</p><p style="margin: 0; font-weight: 400;">${inventoryUpdateMessage}</p></div>`) +
        `<p>Dear Sir/Madam,</p>` +
        `<p>Please find attached the Daily In Stock Report.</p>` +
        `<p>Regards,<br>3 Vikram Technologies CRM</p>`,

      attachments: [
        {
          filename,
          content: buffer,
        },
      ],
    })

    emailHistoryRecord.status = 'sent'
    emailHistoryRecord.sentAt = new Date()
    emailHistoryRecord.reportFilename = filename

    await emailHistoryRecord.save()

    console.log('[Daily Email] Email sent successfully')
    return true
  } catch (error) {
    console.error('[Daily Email] Email job failed:', error)

    emailHistoryRecord.status = 'failed'
    emailHistoryRecord.errorMessage = error.message
    emailHistoryRecord.retryCount += 1
    emailHistoryRecord.lastRetryAt = new Date()

    await emailHistoryRecord.save()
    return false
  }
}

export const sendDailyEmailNowForTest = async () => {
  console.log('[Daily Email Test] Starting automatic daily email job...')
  const sent = await runDailyEmailJob({ testRun: true })
  if (!sent) {
    throw new Error('Complete daily email test failed; see backend logs and email history')
  }
}

export const sendTestEmail = async (testEmail = null) => {
  try {
    const settings = await DailyEmailSettings.findOne()

    if (!settings && !testEmail) {
      throw new Error(
        'No email settings configured and no test recipient provided'
      )
    }

    const targetEmail =
      testEmail || settings.ceoEmail

    const reportDate = new Date()

    const formattedDate =
      reportDate.toLocaleDateString(
        'en-IN',
        { timeZone: 'Asia/Kolkata' }
      )

    console.log(
      `[Daily Email] Test email requested for: ${targetEmail}`
    )

    // Fetch current In Stock assets
    const inStockAssets = await Asset.find({
      $or: [
        { status: 'available' },
        { status: 'AVAILABLE' },
        { status: 'in_stock' },
        { status: 'IN_STOCK' },
        { status: 'IN STOCK' },
        { status: 'In Stock' },
      ],
    })
      .sort({ createdAt: -1 })
      .lean()

    console.log(
      '[Daily Email] TEST - In Stock assets found:',
      inStockAssets.length
    )

    console.log(
      '[Daily Email] TEST - First In Stock asset:',
      inStockAssets[0]
    )

    // Generate workbook
    const { buffer, filename } =
      await generateWorkbookBuffer(
        'daily',
        reportDate
      )

    const emailBody =
      `Dear Sir/Madam,\n\n` +
      `Please find attached the Daily In Stock Report.\n\n` +
      `Regards,\n3 Vikram Technologies CRM`

    await sendEmailWithAttachment({
      to: targetEmail,

      cc:
        settings &&
        settings.ccEmails &&
        settings.ccEmails.length > 0
          ? settings.ccEmails
          : undefined,

      subject:
        `Daily In Stock Report - ${formattedDate}`,

      text: emailBody,

      html:
        `<p>Dear Sir/Madam,</p>` +
        `<p>Please find attached the Daily In Stock Report.</p>` +
        `<p>Regards,<br>3 Vikram Technologies CRM</p>`,

      attachments: [
        {
          filename: `TEST_${filename}`,
          content: buffer,
        },
      ],
    })

    const testEmailRecord = new EmailHistory({
      reportType: 'test',
      scheduledDate: reportDate,
      scheduledTime: 'Daily',

      recipients: {
        to: targetEmail,
        cc: settings
          ? settings.ccEmails || []
          : [],
      },

      subject:
        `Daily In Stock Report - ${formattedDate}`,

      reportFilename:
        `TEST_${filename}`,

      status: 'sent',

      sentAt: new Date(),
    })

    await testEmailRecord.save()

    console.log(
      `[Daily Email] Test email sent successfully to ${targetEmail}`
    )

    return {
      success: true,
      message: `Test email sent to ${targetEmail}`,
    }
  } catch (error) {
    const message =
      error && error.message
        ? error.message
        : 'Unknown email sending error'

    console.error(
      '[Daily Email] Error sending test email:',
      message
    )

    throw new Error(message)
  }
}