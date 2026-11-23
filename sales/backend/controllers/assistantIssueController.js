const { sendSupportEmail } = require('../services/emailService');

const reportsByUser = new Map();
const REPORT_LIMIT = 5;
const REPORT_WINDOW_MS = 60 * 60 * 1000;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const reportIssue = async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message || message.length > 2000) {
    return res.status(400).json({ success: false, message: 'Describe the problem in 1–2000 characters.' });
  }
  const supportEmail = String(process.env.SALES_SUPPORT_EMAIL || '').trim();
  if (!supportEmail) {
    return res.status(503).json({ success: false, message: 'Developer support email is not configured.' });
  }

  const now = Date.now();
  const userKey = String(req.user?.id || req.user?.email || req.ip);
  const timestamps = (reportsByUser.get(userKey) || []).filter((timestamp) => timestamp > now - REPORT_WINDOW_MS);
  if (timestamps.length >= REPORT_LIMIT) {
    reportsByUser.set(userKey, timestamps);
    return res.status(429).json({ success: false, message: 'You have sent several reports recently. Please try again later.' });
  }
  timestamps.push(now);
  reportsByUser.set(userKey, timestamps);

  const page = String(req.body?.page || '').slice(0, 300);
  const recentMessages = (Array.isArray(req.body?.recentMessages) ? req.body.recentMessages : [])
    .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .slice(-6)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 300) }));
  const userName = String(req.user?.name || 'Not provided');
  const userRole = String(req.user?.role || 'Not provided');
  const userEmail = String(req.user?.email || 'Not provided');
  const reportTime = new Date(now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const subjectSummary = message.replace(/[\r\n]+/g, ' ').slice(0, 70);
  const recentText = recentMessages.length
    ? recentMessages.map((item) => `${item.role}: ${item.content}`).join('\n')
    : 'No recent chat messages.';
  const recentHtml = recentMessages.length
    ? `<ul>${recentMessages.map((item) => `<li><strong>${escapeHtml(item.role)}:</strong> ${escapeHtml(item.content)}</li>`).join('')}</ul>`
    : '<p>No recent chat messages.</p>';
  const text = [
    `User: ${userName}`,
    `Role: ${userRole}`,
    `Email: ${userEmail}`,
    `Page: ${page || 'Not provided'}`,
    `Time: ${reportTime}`,
    '',
    'Problem:',
    message,
    '',
    'Recent chat:',
    recentText,
  ].join('\n');
  const html = `<h2>Sales assistant problem report</h2>
    <p><strong>User:</strong> ${escapeHtml(userName)}</p>
    <p><strong>Role:</strong> ${escapeHtml(userRole)}</p>
    <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
    <p><strong>Page:</strong> ${escapeHtml(page || 'Not provided')}</p>
    <p><strong>Time:</strong> ${escapeHtml(reportTime)}</p>
    <h3>Problem</h3><p>${escapeHtml(message).replace(/\r?\n/g, '<br>')}</p>
    <h3>Recent chat</h3>${recentHtml}`;

  const replyTo = isValidEmail(String(req.user?.email || '')) ? String(req.user.email) : undefined;
  try {
    await sendSupportEmail({
      to: supportEmail,
      replyTo,
      subject: `[CRM Sales issue] ${subjectSummary}`,
      text,
      html,
    });
    return res.status(200).json({ success: true, message: 'Your problem was sent to the developer.' });
  } catch (error) {
    const userReports = reportsByUser.get(userKey) || [];
    const timestampIndex = userReports.lastIndexOf(now);
    if (timestampIndex !== -1) userReports.splice(timestampIndex, 1);
    reportsByUser.set(userKey, userReports);
    console.error(String(error?.message || error));
    return res.status(502).json({ success: false, message: 'Unable to send the report right now. Please try again later.' });
  }
};

module.exports = { reportIssue };
