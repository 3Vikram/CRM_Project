const test = require('node:test');
const assert = require('node:assert/strict');
const {
  _createSalesAssistantHandler,
  _getAnalyticsData,
  _getComparisonRange,
  _getDateRange,
  _getRevenue,
} = require('../controllers/salesAnalyticsController');
const {
  buildReportOwnerScope,
  hasFullAccess,
  hasReportFullAccess,
  ownerScope,
  reportOwnerScope,
} = require('../utils/accessScope');
const { requireReportAccess } = require('../middleware/authMiddleware');
const Activity = require('../models/Activity');
const CompanyProfile = require('../models/CompanyProfile');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const Lead = require('../models/Lead');
const OPF = require('../models/OPF');

test('monthly analytics ranges include the full calendar month', () => {
  const range = _getDateRange({ period: 'monthly' }, new Date(2026, 1, 18, 12));
  assert.equal(range.start.getTime(), Date.UTC(2026, 1, 1));
  assert.equal(range.end.getTime(), Date.UTC(2026, 2, 1));
});

test('custom analytics dates include both selected Asia/Kolkata calendar dates', () => {
  const range = _getDateRange({ period: 'custom', startDate: '2026-02-01', endDate: '2026-02-28' });
  assert.equal(range.start.getTime(), Date.UTC(2026, 1, 1));
  assert.equal(range.end.getTime(), Date.UTC(2026, 2, 1));
});

test('daily period boundaries follow Asia/Kolkata across UTC midnight', () => {
  const range = _getDateRange({ period: 'daily' }, new Date('2026-03-01T18:35:00.000Z'));
  assert.equal(range.start.getTime(), Date.UTC(2026, 2, 2));
  assert.equal(range.end.getTime(), Date.UTC(2026, 2, 3));
});

test('custom analytics rejects impossible or reversed dates', () => {
  assert.throws(() => _getDateRange({ period: 'custom', startDate: '2026-02-30', endDate: '2026-03-01' }), /invalid/);
  assert.throws(() => _getDateRange({ period: 'custom', startDate: '2026-03-02', endDate: '2026-03-01' }), /invalid/);
});

test('custom comparison range immediately precedes the selected range', () => {
  const range = _getDateRange({ period: 'custom', startDate: '2026-03-15', endDate: '2026-03-20' });
  const comparison = _getComparisonRange(range);
  assert.equal(comparison.start.getTime(), Date.UTC(2026, 2, 9));
  assert.equal(comparison.end.getTime(), Date.UTC(2026, 2, 15));
});

test('analytics revenue uses saved financials or the CRM order form calculation', () => {
  assert.equal(_getRevenue({ revenue: 500, quantity: 2, unitPrice: 100 }), 500);
  assert.equal(_getRevenue({ quantity: 2, unitPrice: 100, serviceCost: 10, freightCost: 5 }), 215);
});

test('manager report authorization does not imply company-wide data access', () => {
  assert.equal(hasFullAccess({ role: 'admin' }), true);
  assert.equal(hasFullAccess({ role: 'employee', employeeType: 'Manager' }), true);
  assert.equal(hasFullAccess({ role: 'employee', employeeRole: 'Sales Manager' }), false);
  assert.equal(hasReportFullAccess({ role: 'employee', employeeRole: 'Sales Manager' }), true);
  assert.equal(hasFullAccess({ role: 'employee', employeeType: 'User' }), false);
});

test('report API allows managers and enforces report permission for employees', () => {
  const authorize = (user) => {
    let passed = false;
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    requireReportAccess({ user }, response, () => { passed = true; });
    return { passed, response };
  };

  assert.equal(authorize({ role: 'employee', employeeType: 'Manager' }).passed, true);
  assert.equal(authorize({ role: 'employee', employeeRole: 'Sales Manager' }).passed, true);
  assert.equal(authorize({ role: 'employee', permissions: { reports: { view: true } } }).passed, true);
  const denied = authorize({ role: 'employee', permissions: { reports: { view: false } } });
  assert.equal(denied.passed, false);
  assert.equal(denied.response.statusCode, 403);
});

test('employee analytics scope matches only their creator identity or assigned leads', () => {
  const scope = ownerScope({
    user: { id: 'employee-7', name: 'Riya Shah', employeeType: 'User' },
  }, { extraClauses: [{ assignedTo: 'Riya Shah' }] });
  assert.deepEqual(scope, {
    $or: [
      { createdById: 'employee-7' },
      { createdById: { $in: [null, ''] }, createdBy: /^Riya Shah$/i },
      { assignedTo: 'Riya Shah' },
    ],
  });
  assert.deepEqual(reportOwnerScope({ user: { role: 'employee', employeeRole: 'Sales Manager' } }), { _id: null });
  assert.deepEqual(ownerScope({ user: { role: 'employee', employeeRole: 'Sales Manager' } }), { _id: null });
});

test('manager report scope includes only self and directly managed employees', async () => {
  const originalFind = Employee.find;
  const query = (records) => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => records,
  });
  Employee.find = () => query([
    { _id: 'manager-1', employeeName: 'Anaya Patel' },
    { _id: 'rep-2', employeeName: 'Riya Shah' },
  ]);
  try {
    const scope = await buildReportOwnerScope({
      user: { id: 'manager-1', name: 'Anaya Patel', role: 'employee', employeeRole: 'Sales Manager' },
    }, { extraClauses: [{ assignedTo: 'Anaya Patel' }, { assignedToId: 'manager-1' }] });
    assert.deepEqual(scope, {
      $or: [
        { createdById: { $in: ['manager-1', 'rep-2'] } },
        { createdById: { $in: [null, ''] }, createdBy: { $in: [/^Anaya Patel$/i, /^Riya Shah$/i] } },
        { assignedTo: { $in: ['Anaya Patel', 'Riya Shah'] } },
        { assignedToId: { $in: ['manager-1', 'rep-2'] } },
      ],
    });
  } finally {
    Employee.find = originalFind;
  }
});

test('analytics combines period-filtered CRM records into dashboard chart and KPI data', async () => {
  const originals = {
    leadFind: Lead.find,
    opfFind: OPF.find,
    activityFind: Activity.find,
    customerFind: Customer.find,
    employeeFind: Employee.find,
    companyFindOne: CompanyProfile.findOne,
  };
  const query = (records) => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => records,
  });

  const assistantResponse = () => ({
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });

  test('AI assistant reports MongoDB DNS failures instead of returning a generic provider error', async () => {
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async () => {
        throw new Error('querySrv ECONNREFUSED _mongodb._tcp.cluster.example.mongodb.net');
      },
      fetchProvider: async () => {
        throw new Error('AI provider must not be called when CRM data cannot load.');
      },
    });
    const res = assistantResponse();
    await handler({
      body: { question: 'Explain what is driving the sales trend', filters: { period: 'monthly' } },
      user: { id: 'employee-1', role: 'employee' },
    }, res);

    assert.equal(res.statusCode, 503);
    assert.match(res.body.message, /MongoDB SRV DNS lookup failed/);
  });

  test('AI assistant reports a local inference service connection failure clearly', async () => {
    const originalBaseUrl = process.env.SALES_AI_BASE_URL;
    delete process.env.SALES_AI_BASE_URL;
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async () => ({ generatedAt: '2026-11-16T00:00:00.000Z' }),
      fetchProvider: async () => {
        const error = new TypeError('fetch failed');
        error.cause = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
        throw error;
      },
    });
    const res = assistantResponse();
    try {
      await handler({
        body: { question: 'Explain what is driving the sales trend', filters: { period: 'monthly' } },
        user: { id: 'employee-1', role: 'employee' },
      }, res);
      assert.equal(res.statusCode, 503);
      assert.match(res.body.message, /local Sales AI service is unavailable \(ECONNREFUSED\)/);
      assert.match(res.body.message, /SALES_AI_BASE_URL and SALES_AI_MODEL/);
    } finally {
      if (originalBaseUrl === undefined) delete process.env.SALES_AI_BASE_URL;
      else process.env.SALES_AI_BASE_URL = originalBaseUrl;
    }
  });

  test('AI assistant surfaces model errors returned by the local provider', async () => {
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async () => ({ generatedAt: '2026-11-16T00:00:00.000Z' }),
      fetchProvider: async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"error":"model llama3.1 not found"}',
      }),
    });
    const res = assistantResponse();
    await handler({
      body: { question: 'Explain what is driving the sales trend', filters: { period: 'monthly' } },
      user: { id: 'employee-1', role: 'employee' },
    }, res);

    assert.equal(res.statusCode, 502);
    assert.match(res.body.message, /HTTP 404 Not Found/);
    assert.match(res.body.message, /model llama3\.1 not found/);
  });

  test('AI assistant sends authorized analytics to the provider and returns its grounded answer', async () => {
    const originalBaseUrl = process.env.SALES_AI_BASE_URL;
    delete process.env.SALES_AI_BASE_URL;
    let providerRequest;
    const analytics = {
      generatedAt: '2026-11-16T00:00:00.000Z',
      periodLabel: 'November 2026',
      kpis: { totalRevenue: 12500 },
      breakdown: { revenue: [{ customer: 'Northstar Ltd', revenue: 12500 }] },
    };
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async (req) => {
        assert.equal(req.user.id, 'employee-1');
        assert.deepEqual(req.query, { period: 'monthly' });
        return analytics;
      },
      fetchProvider: async (_url, options) => {
        providerRequest = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({
              answer: 'Sales revenue for November 2026 is ₹12,500.',
              chartKey: 'revenueTrend',
            }) } }],
          }),
        };
      },
    });
    const res = assistantResponse();
    try {
      await handler({
        body: { question: 'Explain what is driving the sales trend', filters: { period: 'monthly' } },
        user: { id: 'employee-1', role: 'employee' },
      }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.answer, 'Sales revenue for November 2026 is ₹12,500.');
      assert.equal(res.body.data.chartKey, 'revenueTrend');
      const promptData = JSON.parse(providerRequest.messages[1].content);
      assert.deepEqual(promptData.authorizedSalesAnalytics.kpis, analytics.kpis);
      assert.equal(promptData.authorizedSalesAnalytics.breakdown, undefined);
    } finally {
      if (originalBaseUrl === undefined) delete process.env.SALES_AI_BASE_URL;
      else process.env.SALES_AI_BASE_URL = originalBaseUrl;
    }
  });

  test('AI assistant sends greetings and thanks to the configured model', async () => {
    const questions = ['Hi', 'Good morning', 'Thank you.'];
    for (const question of questions) {
      let providerRequest;
      const handler = _createSalesAssistantHandler({
        loadAnalytics: async () => {
          throw new Error('Greetings must not load analytics.');
        },
        fetchProvider: async (_url, options) => {
          providerRequest = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: `Model response to: ${question}` } }],
            }),
          };
        },
      });
      const res = assistantResponse();
      await handler({ body: { question, history: [{ role: 'user', content: 'Hello' }] } }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.answer, `Model response to: ${question}`);
      assert.equal(res.body.data.intent, 'greeting');
      assert.equal(providerRequest.messages.at(-1).content, question);
      assert.equal(providerRequest.model, process.env.SALES_AI_MODEL || 'llama3.1');
    }
  });

  test('AI assistant delegates CRM analytics answers to the model with computed CRM evidence', async () => {
    const questions = [
      'I need some clarification in the report page can u',
      'Show me this year’s sales performance.',
      'Which employee generated the highest revenue?',
      'Explain the quotation report.',
    ];
    const analytics = {
      generatedAt: '2026-11-16T00:00:00.000Z',
      periodLabel: '2026',
      kpis: { totalRevenue: 1200, totalQuotations: 3, totalLeads: 5 },
      changes: {},
      charts: {
        employeeRevenue: [{ employee: 'Sales Rep', revenue: 1200, deals: 2 }],
        quotationStatus: [{ status: 'Sent', count: 3 }],
      },
    };
    for (const question of questions) {
      let providerRequest;
      const handler = _createSalesAssistantHandler({
        loadAnalytics: async () => analytics,
        fetchProvider: async (_url, options) => {
          providerRequest = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({
              choices: [{
                finish_reason: 'stop',
                message: { content: JSON.stringify({ answer: `AI-generated response for: ${question}`, chartKey: null }) },
              }],
            }),
          };
        },
      });
      const res = assistantResponse();
      await handler({
        body: { question, filters: { period: 'yearly' } },
        user: { id: 'employee-1', role: 'employee' },
      }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.answer, `AI-generated response for: ${question}`);
      const prompt = JSON.parse(providerRequest.messages[1].content);
      assert.equal(prompt.question, question);
      assert.deepEqual(prompt.authorizedSalesAnalytics.kpis, analytics.kpis);
      if (/revenue|performance|quotation/i.test(question)) {
        assert.ok(prompt.computedAnswerFromAuthorizedCRM);
      }
    }
  });

  test('AI assistant keeps report-edit follow-ups separate from earlier employee analytics', async () => {
    const originalBaseUrl = process.env.SALES_AI_BASE_URL;
    delete process.env.SALES_AI_BASE_URL;
    const providerRequests = [];
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async () => ({
        generatedAt: '2026-11-16T00:00:00.000Z',
        periodLabel: '2026',
        kpis: { totalRevenue: 1200 },
        charts: { employeeRevenue: [{ employee: 'Admin', revenue: 1200, deals: 2 }] },
      }),
      fetchProvider: async (_url, options) => {
        const request = JSON.parse(options.body);
        providerRequests.push(request);
        const lastMessage = request.messages.at(-1).content;
        const isAnalyticsPrompt = request.messages.some((message) => message.content.includes('"authorizedSalesAnalytics"'));
        const content = isAnalyticsPrompt
          ? JSON.stringify({ answer: 'Admin generated the highest revenue.', chartKey: 'employees' })
          : lastMessage === 'I want to make some changes in the report page.'
            ? 'What changes would you like to make to the report page?'
            : 'Which card would you like to remove?';
        return {
          ok: true,
          json: async () => ({
            choices: [{ finish_reason: 'stop', message: { content } }],
          }),
        };
      },
    });
    const conversation = [];
    const ask = async (question) => {
      const res = assistantResponse();
      await handler({
        body: { question, filters: { period: 'yearly' }, history: [...conversation] },
        user: { id: 'employee-1', role: 'employee' },
      }, res);
      assert.equal(res.statusCode, 200);
      conversation.push({ role: 'user', content: question });
      conversation.push({ role: 'assistant', content: res.body.data.answer });
      return res.body.data;
    };

    try {
      const revenueAnswer = await ask('Which employee generated the highest revenue?');
      assert.equal(revenueAnswer.answer, 'Admin generated the highest revenue.');

      const reportAnswer = await ask('I want to make some changes in the report page.');
      assert.equal(reportAnswer.intent, 'chat');
      assert.equal(reportAnswer.answer, 'What changes would you like to make to the report page?');
      const reportRequest = providerRequests.at(-1);
      assert.equal(reportRequest.messages.at(-1).content, 'I want to make some changes in the report page.');
      assert.equal(JSON.stringify(reportRequest.messages).includes('Admin'), false);

      const cardAnswer = await ask('I want to remove one card.');
      assert.equal(cardAnswer.intent, 'chat');
      assert.equal(cardAnswer.answer, 'Which card would you like to remove?');
      const cardRequest = providerRequests.at(-1);
      const conversationPrompt = cardRequest.messages.map((message) => message.content).join('\n');
      assert.match(conversationPrompt, /I want to make some changes in the report page\./);
      assert.equal(conversationPrompt.includes('Admin'), false);
      assert.equal(conversationPrompt.includes('Which employee generated the highest revenue?'), false);
    } finally {
      if (originalBaseUrl === undefined) delete process.env.SALES_AI_BASE_URL;
      else process.env.SALES_AI_BASE_URL = originalBaseUrl;
    }
  });

  test('AI assistant keeps period follow-ups grounded in prior CRM conversation', async () => {
    let loadedFilters;
    let providerPrompt;
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async (req) => {
        loadedFilters = req.query;
        return {
          generatedAt: '2026-11-16T00:00:00.000Z',
          periodLabel: 'November 2026',
          kpis: { totalRevenue: 1200 },
          charts: {},
        };
      },
      fetchProvider: async (_url, options) => {
        providerPrompt = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{
              finish_reason: 'stop',
              message: { content: JSON.stringify({ answer: 'The selected-period revenue trend is stable.', chartKey: null }) },
            }],
          }),
        };
      },
    });
    const res = assistantResponse();
    await handler({
      body: {
        question: 'And what about last month?',
        filters: { period: 'monthly' },
        history: [{ role: 'user', content: 'Show me this year’s sales performance.' }],
      },
      user: { id: 'employee-1', role: 'employee' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(loadedFilters, { period: 'monthly' });
    assert.equal(providerPrompt.messages[1].content.includes('And what about last month?'), true);
    const prompt = JSON.parse(providerPrompt.messages[1].content);
    assert.deepEqual(prompt.conversationHistory, [{ role: 'user', content: 'Show me this year’s sales performance.' }]);
    assert.equal(prompt.reportingPeriod, 'November 2026');
  });

  test('AI assistant retries a truncated conversational answer and retains its continuation', async () => {
    const requests = [];
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async () => {
        throw new Error('General conversation must not load analytics.');
      },
      fetchProvider: async (_url, options) => {
        const request = JSON.parse(options.body);
        requests.push(request);
        return {
          ok: true,
          json: async () => ({
            choices: [{
              finish_reason: requests.length === 1 ? 'length' : 'stop',
              message: { content: requests.length === 1 ? 'Here is the first part' : 'and the completed explanation.' },
            }],
          }),
        };
      },
    });
    const res = assistantResponse();
    await handler({
      body: { question: 'Could you explain that in a little more detail?' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.answer, 'Here is the first part\nand the completed explanation.');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].max_tokens, 1200);
    assert.equal(requests[1].max_tokens, 1800);
    assert.equal(requests[1].messages.at(-2).content, 'Here is the first part');
  });

  test('AI assistant retries truncated JSON and extracts a complete object from surrounding text', async () => {
    const requestOptions = [];
    const analytics = {
      generatedAt: '2026-11-16T00:00:00.000Z',
      periodLabel: 'November 2026',
      kpis: { totalRevenue: 1200 },
      charts: {},
    };
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async () => analytics,
      fetchProvider: async (_url, options) => {
        requestOptions.push(JSON.parse(options.body));
        if (requestOptions.length === 1) {
          return {
            ok: true,
            json: async () => ({
              choices: [{ finish_reason: 'length', message: { content: '{"answer":"A clarification with an unfinished string' } }],
              usage: { completion_tokens: 1200 },
            }),
          };
        }
        const answer = JSON.stringify({
          answer: 'Report clarification:\nUse the "Revenue" section for monthly totals.',
          chartKey: null,
        });
        return {
          ok: true,
          json: async () => ({
            choices: [{ finish_reason: 'stop', message: { content: `Explanation follows:\n\`\`\`json\n${answer}\n\`\`\`\n` } }],
          }),
        };
      },
    });
    const res = assistantResponse();
    await handler({
      body: {
        question: 'I need some clarification about the Reports page.',
        filters: { period: 'monthly' },
        history: [{ role: 'assistant', content: 'Which report are you viewing?' }],
      },
      user: { id: 'employee-1', role: 'employee' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.answer, 'Report clarification:\nUse the "Revenue" section for monthly totals.');
    assert.equal(requestOptions.length, 2);
    assert.equal(requestOptions[0].max_tokens, 1200);
    assert.equal(requestOptions[1].max_tokens, 1800);
    const originalPrompt = JSON.parse(requestOptions[0].messages[1].content);
    assert.deepEqual(originalPrompt.conversationHistory, [{ role: 'assistant', content: 'Which report are you viewing?' }]);
    assert.equal(originalPrompt.reportingPeriod, analytics.periodLabel);
  });

  test('AI assistant returns a safe error after repeated malformed JSON', async () => {
    let attempts = 0;
    const handler = _createSalesAssistantHandler({
      loadAnalytics: async () => ({ generatedAt: '2026-11-16T00:00:00.000Z', periodLabel: 'November 2026', kpis: {}, charts: {} }),
      fetchProvider: async () => {
        attempts += 1;
        return {
          ok: true,
          json: async () => ({
            choices: [{ finish_reason: 'length', message: { content: '{"answer":"still incomplete' } }],
            usage: { completion_tokens: 1200 },
          }),
        };
      },
    });
    const res = assistantResponse();
    await handler({
      body: { question: 'I need some clarification about the Reports page.', filters: { period: 'monthly' } },
      user: { id: 'employee-1', role: 'employee' },
    }, res);

    assert.equal(attempts, 2);
    assert.equal(res.statusCode, 502);
    assert.match(res.body.message, /incomplete or invalid response after retry/);
    assert.doesNotMatch(res.body.message, /SyntaxError|stack|position \d+/i);
  });

  Lead.find = () => query([
    { quotationId: 'Q-1', leadStatus: 'Proposal Sent', createdDate: new Date(2026, 1, 4), createdById: '' },
    { leadStatus: 'Won', createdDate: new Date(2026, 1, 8), createdById: '', assignedTo: 'Anaya Patel' },
    { leadStatus: 'Lost', createdDate: new Date(2026, 1, 12), createdById: '' },
    { leadStatus: 'New', isConverted: true, sourceOfLead: 'Web', createdDate: new Date(2026, 1, 16), createdById: '' },
    { leadStatus: 'Won', createdDate: new Date(2026, 0, 16), createdById: '' },
  ]);
  OPF.find = () => query([
    { createdBy: 'Anaya Patel', customerName: 'Northstar Ltd', product: 'Sensor', createdDate: new Date(2026, 1, 6), quantity: 1, unitPrice: 1000, vendorPrice: 800, createdById: '' },
    { createdBy: 'Anaya Patel', customerName: 'Northstar Ltd', product: 'Sensor', createdDate: new Date(2026, 1, 18), quantity: 2, unitPrice: 500, vendorPrice: 300, serviceCost: 100, freightCost: 50, createdById: '' },
    { createdBy: 'Another employee', customerName: 'Out of range', product: 'Other', createdDate: new Date(2026, 0, 18), quantity: 1, unitPrice: 900, createdById: '' },
  ]);
  Activity.find = () => query([
    { activityDate: '2026-02-15', activityType: 'Call', status: 'Follow-Up Required', followUpDate: '2099-12-30', assignedUser: 'Anaya Patel', createdById: '', createdAt: new Date(2026, 1, 15) },
    { activityDate: '2026-02-20', activityType: 'Email', status: 'Completed', assignedUser: 'Anaya Patel', createdById: '', createdAt: new Date(2026, 1, 20) },
  ]);
  Customer.find = () => query([
    { createdAt: new Date(2026, 1, 3), status: 'Active', accountType: 'Business' },
    { createdAt: new Date(2026, 0, 3), status: 'Inactive', accountType: 'Individual' },
  ]);
  Employee.find = () => query([{ employeeName: 'Anaya Patel', fullName: 'Anaya Patel' }]);
  CompanyProfile.findOne = () => ({
    select() { return this; },
    lean: async () => ({ companyName: 'Northstar CRM' }),
  });

  try {
    const data = await _getAnalyticsData({
      user: { id: 'admin', name: 'Admin', role: 'admin' },
      query: { period: 'custom', startDate: '2026-02-01', endDate: '2026-02-28' },
    });
    assert.equal(data.companyName, 'Northstar CRM');
    assert.equal(data.kpis.totalRevenue, 2150);
    assert.equal(data.kpis.totalDeals, 4);
    assert.equal(data.kpis.totalLeads, 3);
    assert.equal(data.kpis.convertedLeads, 2);
    assert.equal(data.kpis.totalQuotations, 1);
    assert.equal(data.kpis.pendingQuotations, 1);
    assert.equal(data.kpis.quotationConversionRate, 0);
    assert.equal(data.kpis.wonDeals, 1);
    assert.equal(data.kpis.lostDeals, 1);
    assert.equal(data.kpis.conversionRate, 50);
    assert.equal(data.kpis.customers, 2);
    assert.equal(data.kpis.activities, 2);
    assert.equal(data.kpis.pendingFollowUps, 1);
    assert.deepEqual(data.charts.monthlyRevenue, [{ label: '2026-02', revenue: 2150 }]);
    assert.deepEqual(data.charts.quarterlyRevenue, [{ label: '2026-Q1', revenue: 2150 }]);
    assert.equal(data.charts.customerRevenue[0].customer, 'Northstar Ltd');
    assert.equal(data.charts.employeeRevenue[0].employee, 'Anaya Patel');
    assert.equal(data.charts.productRevenue[0].product, 'Sensor');
    assert.deepEqual(data.charts.productQuantities, [{ product: 'Sensor', quantity: 3 }]);
    assert.equal(data.charts.productTrend[0].values[0].revenue, 2150);
    assert.deepEqual(data.charts.customerStatus, [{ status: 'Active', count: 1 }, { status: 'Inactive', count: 1 }]);
    assert.deepEqual(data.charts.customerDistribution, [{ accountType: 'Business', count: 1 }, { accountType: 'Individual', count: 1 }]);
    assert.deepEqual(data.charts.leadConversion, [{ status: 'Converted', count: 3 }, { status: 'Closed - Lost', count: 1 }]);
    assert.deepEqual(data.charts.funnel, [
      { stage: 'New', count: 1 },
      { stage: 'Proposal Sent', count: 1 },
      { stage: 'Won', count: 2 },
      { stage: 'Lost', count: 1 },
    ]);
    assert.equal(data.charts.employeePerformance[0].employee, 'Anaya Patel');
    assert.equal(data.charts.employeePerformance[0].leadsAssigned, 1);
    assert.equal(data.charts.employeePerformance[0].leadsConverted, 1);
    assert.equal(data.charts.employeePerformance[0].activitiesCompleted, 1);
    assert.deepEqual(data.charts.leadSources, [{ source: 'Not recorded', count: 3 }, { source: 'Web', count: 1 }]);
    assert.equal(data.charts.customerAcquisition[0].count, 1);
    assert.equal(data.charts.quotationTrend[0].count, 1);
    assert.equal(data.charts.quotationStatus[1].count, 1);
    assert.deepEqual(data.charts.activityByType, [{ type: 'Call', count: 1 }, { type: 'Email', count: 1 }]);
    assert.deepEqual(data.charts.activityByStatus, [{ status: 'Follow-Up Required', count: 1 }, { status: 'Completed', count: 1 }]);
    assert.deepEqual(data.charts.activityCompletion, [{ status: 'Completed', count: 1 }, { status: 'Pending', count: 1 }]);
    assert.equal(data.charts.activityTrend[0].count, 2);
    assert.equal(data.charts.activityByEmployee[0].employee, 'Anaya Patel');
    assert.equal(data.charts.upcomingFollowUps.length, 1);
    assert.equal(data.charts.activityHeatmap.length, 28);
    assert.equal(data.charts.activityHeatmap.find((day) => day.date === '2026-02-15').count, 1);
  } finally {
    Lead.find = originals.leadFind;
    OPF.find = originals.opfFind;
    Activity.find = originals.activityFind;
    Customer.find = originals.customerFind;
    Employee.find = originals.employeeFind;
    CompanyProfile.findOne = originals.companyFindOne;
  }
});
