const Database = require('better-sqlite3');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const configuredDbPath = process.env.SALES_DB_PATH?.trim();

if (process.env.NODE_ENV === 'production' && !configuredDbPath) {
  throw new Error('SALES_DB_PATH must be configured with an absolute path in production.');
}
if (configuredDbPath && !path.isAbsolute(configuredDbPath)) {
  throw new Error('SALES_DB_PATH must be an absolute path.');
}

const dbPath = configuredDbPath || path.join(projectRoot, 'database', 'sales.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.function('regexp', { deterministic: true }, (pattern, value) => (
  value !== null && new RegExp(String(pattern), 'i').test(String(value)) ? 1 : 0
));

const columnDefinitions = {
  activityId: "TEXT NOT NULL DEFAULT ''",
  leadId: "TEXT DEFAULT ''",
  leadSource: "TEXT DEFAULT ''",
  customerName: "TEXT DEFAULT ''",
  contactPerson: "TEXT DEFAULT ''",
  designation: "TEXT DEFAULT ''",
  email: "TEXT DEFAULT ''",
  mobileNo: "TEXT DEFAULT ''",
  sourceOfLead: "TEXT DEFAULT ''",
  customerRequirements: "TEXT DEFAULT ''",
  customerRemarks: "TEXT DEFAULT ''",
  assignedUser: "TEXT DEFAULT ''",
  leadIdLabel: "TEXT DEFAULT ''",
  company: "TEXT DEFAULT ''",
  priority: "TEXT DEFAULT 'Medium'",
  campaign: "TEXT DEFAULT ''",
  activityType: "TEXT DEFAULT ''",
  activityDate: "TEXT DEFAULT ''",
  location: "TEXT DEFAULT ''",
  response: "TEXT DEFAULT ''",
  followUp: "TEXT DEFAULT ''",
  product: "TEXT DEFAULT ''",
  tagResource: "TEXT DEFAULT ''",
  followUpDate: "TEXT DEFAULT ''",
  reminder: "TEXT DEFAULT ''",
  status: "TEXT DEFAULT 'Open'",
  createdBy: "TEXT DEFAULT 'Current User'",
  lastModifiedBy: "TEXT DEFAULT 'Current User'",
  deletedAt: 'TEXT DEFAULT NULL',
  createdAt: 'TEXT',
  updatedAt: 'TEXT',
};

const legacyColumns = {
  activityId: 'activity_id',
  leadId: 'lead_id',
  customerName: 'customer_name',
  contactPerson: 'contact_person',
  mobileNo: 'mobile_no',
  assignedUser: 'assigned_user',
  activityType: 'activity_type',
  activityDate: 'activity_date',
  createdBy: 'created_by',
  lastModifiedBy: 'last_modified_by',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      activityId TEXT NOT NULL DEFAULT '',
      leadId TEXT DEFAULT '',
      leadSource TEXT DEFAULT '',
      customerName TEXT DEFAULT '',
      contactPerson TEXT DEFAULT '',
      designation TEXT DEFAULT '',
      email TEXT DEFAULT '',
      mobileNo TEXT DEFAULT '',
      sourceOfLead TEXT DEFAULT '',
      customerRequirements TEXT DEFAULT '',
      customerRemarks TEXT DEFAULT '',
      assignedUser TEXT DEFAULT '',
      leadIdLabel TEXT DEFAULT '',
      company TEXT DEFAULT '',
      priority TEXT DEFAULT 'Medium',
      campaign TEXT DEFAULT '',
      activityType TEXT DEFAULT '',
      activityDate TEXT DEFAULT '',
      location TEXT DEFAULT '',
      response TEXT DEFAULT '',
      followUp TEXT DEFAULT '',
      product TEXT DEFAULT '',
      tagResource TEXT DEFAULT '',
      followUpDate TEXT DEFAULT '',
      reminder TEXT DEFAULT '',
      status TEXT DEFAULT 'Open',
      createdBy TEXT DEFAULT 'Current User',
      lastModifiedBy TEXT DEFAULT 'Current User',
      deletedAt TEXT DEFAULT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const existingColumns = new Set(db.pragma('table_info(activities)').map((column) => column.name));
  const addedColumns = new Set();
  Object.entries(columnDefinitions).forEach(([name, definition]) => {
    if (existingColumns.has(name)) return;
    db.exec(`ALTER TABLE activities ADD COLUMN "${name}" ${definition}`);
    addedColumns.add(name);
  });

  Object.entries(legacyColumns).forEach(([name, legacyName]) => {
    if (addedColumns.has(name) && existingColumns.has(legacyName)) {
      db.exec(`UPDATE activities SET "${name}" = "${legacyName}"`);
    }
  });

  db.exec(`
    UPDATE activities
    SET createdAt = COALESCE(createdAt, CURRENT_TIMESTAMP),
        updatedAt = COALESCE(updatedAt, CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS activities_activity_id_active_unique
      ON activities(activityId)
      WHERE deletedAt IS NULL AND activityId <> '';
    CREATE INDEX IF NOT EXISTS activities_lead_status_date_idx
      ON activities(leadId, status, activityDate);
    CREATE INDEX IF NOT EXISTS activities_customer_contact_date_idx
      ON activities(customerName, contactPerson, email, mobileNo, activityDate);
    CREATE INDEX IF NOT EXISTS activities_creator_date_response_followup_status_idx
      ON activities(createdBy, activityDate, response, followUpDate, status);
    CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities(createdAt DESC);
  `);
})();

const leadColumnDefinitions = {
  lead_id: 'TEXT',
  company_name: "TEXT NOT NULL DEFAULT ''",
  contact_person: "TEXT DEFAULT 'Not provided'",
  designation: "TEXT DEFAULT ''",
  email: "TEXT DEFAULT 'noemail@noemail.com'",
  mobile: "TEXT DEFAULT '0000000000'",
  source: "TEXT DEFAULT 'Manual'",
  source_of_lead: "TEXT DEFAULT 'Manual'",
  campaign_id: "TEXT DEFAULT ''",
  campaign_name: "TEXT DEFAULT ''",
  open_count: 'INTEGER DEFAULT 0',
  email_open_count: 'INTEGER DEFAULT 0',
  link_clicks: 'INTEGER DEFAULT 0',
  first_opened_at: 'TEXT DEFAULT NULL',
  last_opened_at: 'TEXT DEFAULT NULL',
  first_clicked_at: 'TEXT DEFAULT NULL',
  last_clicked_at: 'TEXT DEFAULT NULL',
  downloads: 'INTEGER DEFAULT 0',
  replies: 'INTEGER DEFAULT 0',
  website_visits: 'INTEGER DEFAULT 0',
  engagement_json: "TEXT DEFAULT '{}'",
  lead_score: 'INTEGER DEFAULT 0',
  priority: "TEXT DEFAULT 'Low'",
  lead_status: "TEXT DEFAULT 'New'",
  calendar_status: "TEXT DEFAULT 'Pending'",
  assigned_to: "TEXT DEFAULT 'Unassigned'",
  created_by: "TEXT DEFAULT 'System'",
  created_date: 'TEXT',
  follow_up_date: "TEXT DEFAULT ''",
  follow_up_time: "TEXT DEFAULT ''",
  demo_date: "TEXT DEFAULT ''",
  demo_time: "TEXT DEFAULT ''",
  meeting_date: "TEXT DEFAULT ''",
  meeting_time: "TEXT DEFAULT ''",
  callback_date: "TEXT DEFAULT ''",
  callback_time: "TEXT DEFAULT ''",
  next_action_date: "TEXT DEFAULT ''",
  next_action_time: "TEXT DEFAULT ''",
  customer_requirements: "TEXT DEFAULT ''",
  remarks: "TEXT DEFAULT ''",
  last_open_time: 'TEXT DEFAULT NULL',
  timeline_json: "TEXT DEFAULT '[]'",
  notes_json: "TEXT DEFAULT '[]'",
  is_converted: 'INTEGER DEFAULT 0',
  is_scrapped: 'INTEGER DEFAULT 0',
  reason: "TEXT DEFAULT ''",
  quotation_id: 'TEXT',
  quotation_type: "TEXT DEFAULT 'rent'",
  products_json: "TEXT DEFAULT '[]'",
  quotation_details_json: "TEXT DEFAULT '{}'",
  customer_id: "TEXT DEFAULT ''",
  created_at: 'TEXT',
  updated_at: 'TEXT',
};

db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      lead_id TEXT,
      company_name TEXT NOT NULL DEFAULT '',
      contact_person TEXT DEFAULT 'Not provided',
      designation TEXT DEFAULT '',
      email TEXT DEFAULT 'noemail@noemail.com',
      mobile TEXT DEFAULT '0000000000',
      source TEXT DEFAULT 'Manual',
      source_of_lead TEXT DEFAULT 'Manual',
      campaign_id TEXT DEFAULT '',
      campaign_name TEXT DEFAULT '',
      open_count INTEGER DEFAULT 0,
      email_open_count INTEGER DEFAULT 0,
      link_clicks INTEGER DEFAULT 0,
      first_opened_at TEXT DEFAULT NULL,
      last_opened_at TEXT DEFAULT NULL,
      first_clicked_at TEXT DEFAULT NULL,
      last_clicked_at TEXT DEFAULT NULL,
      downloads INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      website_visits INTEGER DEFAULT 0,
      engagement_json TEXT DEFAULT '{}',
      lead_score INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'Low',
      lead_status TEXT DEFAULT 'New',
      calendar_status TEXT DEFAULT 'Pending',
      assigned_to TEXT DEFAULT 'Unassigned',
      created_by TEXT DEFAULT 'System',
      created_date TEXT,
      follow_up_date TEXT DEFAULT '',
      follow_up_time TEXT DEFAULT '',
      demo_date TEXT DEFAULT '',
      demo_time TEXT DEFAULT '',
      meeting_date TEXT DEFAULT '',
      meeting_time TEXT DEFAULT '',
      callback_date TEXT DEFAULT '',
      callback_time TEXT DEFAULT '',
      next_action_date TEXT DEFAULT '',
      next_action_time TEXT DEFAULT '',
      customer_requirements TEXT DEFAULT '',
      remarks TEXT DEFAULT '',
      last_open_time TEXT DEFAULT NULL,
      timeline_json TEXT DEFAULT '[]',
      notes_json TEXT DEFAULT '[]',
      is_converted INTEGER DEFAULT 0,
      is_scrapped INTEGER DEFAULT 0,
      reason TEXT DEFAULT '',
      quotation_id TEXT,
      quotation_type TEXT DEFAULT 'rent',
      products_json TEXT DEFAULT '[]',
      quotation_details_json TEXT DEFAULT '{}',
      customer_id TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const existingColumns = new Set(db.pragma('table_info(leads)').map((column) => column.name));
  const addedCalendarColumns = new Set();
  Object.entries(leadColumnDefinitions).forEach(([name, definition]) => {
    if (!existingColumns.has(name)) {
      db.exec(`ALTER TABLE leads ADD COLUMN "${name}" ${definition}`);
      if (name.endsWith('_date') || name.endsWith('_time')) addedCalendarColumns.add(name);
    }
  });
  const legacyCalendarColumns = {
    follow_up_date: 'followUpDate',
    follow_up_time: 'followUpTime',
    demo_date: 'demoDate',
    demo_time: 'demoTime',
    meeting_date: 'meetingDate',
    meeting_time: 'meetingTime',
    callback_date: 'callbackDate',
    callback_time: 'callbackTime',
    next_action_date: 'nextActionDate',
    next_action_time: 'nextActionTime',
  };
  Object.entries(legacyCalendarColumns).forEach(([column, legacyColumn]) => {
    if (addedCalendarColumns.has(column) && existingColumns.has(legacyColumn)) {
      db.exec(`UPDATE leads SET "${column}" = "${legacyColumn}"`);
    }
  });

  db.exec(`
    UPDATE leads
    SET created_date = COALESCE(created_date, created_at, CURRENT_TIMESTAMP),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP),
        engagement_json = COALESCE(NULLIF(engagement_json, ''), '{}'),
        timeline_json = COALESCE(NULLIF(timeline_json, ''), '[]'),
        notes_json = COALESCE(NULLIF(notes_json, ''), '[]'),
        products_json = COALESCE(NULLIF(products_json, ''), '[]'),
        quotation_details_json = COALESCE(NULLIF(quotation_details_json, ''), '{}');
    CREATE UNIQUE INDEX IF NOT EXISTS leads_lead_id_unique
      ON leads(lead_id)
      WHERE lead_id IS NOT NULL AND lead_id <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS leads_quotation_id_unique
      ON leads(quotation_id)
      WHERE quotation_id IS NOT NULL AND quotation_id <> '';
    CREATE INDEX IF NOT EXISTS leads_status_priority_assignee_created_idx
      ON leads(lead_status, priority, assigned_to, created_date DESC);
    CREATE INDEX IF NOT EXISTS leads_company_email_mobile_idx
      ON leads(company_name, email, mobile, assigned_to, created_date DESC);
    CREATE INDEX IF NOT EXISTS leads_email_nocase_idx ON leads(email COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS leads_campaign_name_nocase_idx ON leads(campaign_name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS leads_calendar_dates_idx
      ON leads(follow_up_date, demo_date, meeting_date, callback_date, next_action_date);
    CREATE TABLE IF NOT EXISTS lead_sequences (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS quotation_sequences (
      prefix TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.prepare(`
    INSERT INTO lead_sequences (name, value)
    VALUES ('lead', COALESCE((
      SELECT MAX(CAST(substr(lead_id, 4) AS INTEGER))
      FROM leads
      WHERE lead_id REGEXP '^LD-[0-9]+$'
    ), 0))
    ON CONFLICT(name) DO UPDATE SET value = MAX(value, excluded.value)
  `).run();
})();

db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_id TEXT UNIQUE,
      company_name TEXT NOT NULL DEFAULT '',
      gst_number TEXT DEFAULT '',
      pan_number TEXT DEFAULT '',
      website TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      state TEXT DEFAULT '',
      bill_to_address_json TEXT DEFAULT '{}',
      ship_to_same_as_billing INTEGER DEFAULT 1,
      ship_to_address_json TEXT DEFAULT '{}',
      contacts_json TEXT DEFAULT '[]',
      customer_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      documents_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'Active',
      calendar_status TEXT DEFAULT 'Pending',
      meeting_date TEXT DEFAULT '',
      meeting_time TEXT DEFAULT '',
      renewal_date TEXT DEFAULT '',
      renewal_time TEXT DEFAULT '',
      contract_expiry_date TEXT DEFAULT '',
      contract_expiry_time TEXT DEFAULT '',
      visit_date TEXT DEFAULT '',
      visit_time TEXT DEFAULT '',
      next_action_date TEXT DEFAULT '',
      next_action_time TEXT DEFAULT '',
      account_type TEXT DEFAULT 'Individual',
      created_by TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
})();

const customerColumnDefinitions = {
  state: "TEXT DEFAULT ''",
  calendar_status: "TEXT DEFAULT 'Pending'",
  ship_to_same_as_billing: 'INTEGER DEFAULT 1',
  meeting_date: "TEXT DEFAULT ''",
  meeting_time: "TEXT DEFAULT ''",
  renewal_date: "TEXT DEFAULT ''",
  renewal_time: "TEXT DEFAULT ''",
  contract_expiry_date: "TEXT DEFAULT ''",
  contract_expiry_time: "TEXT DEFAULT ''",
  visit_date: "TEXT DEFAULT ''",
  visit_time: "TEXT DEFAULT ''",
  next_action_date: "TEXT DEFAULT ''",
  next_action_time: "TEXT DEFAULT ''",
};

db.transaction(() => {
  const existingColumns = new Set(db.pragma('table_info(customers)').map((column) => column.name));
  const addedCalendarColumns = new Set();
  Object.entries(customerColumnDefinitions).forEach(([name, definition]) => {
    if (!existingColumns.has(name)) {
      db.exec(`ALTER TABLE customers ADD COLUMN "${name}" ${definition}`);
      if (name.endsWith('_date') || name.endsWith('_time')) addedCalendarColumns.add(name);
    }
  });
  const legacyCalendarColumns = {
    meeting_date: 'meetingDate',
    meeting_time: 'meetingTime',
    renewal_date: 'renewalDate',
    renewal_time: 'renewalTime',
    contract_expiry_date: 'contractExpiryDate',
    contract_expiry_time: 'contractExpiryTime',
    visit_date: 'visitDate',
    visit_time: 'visitTime',
    next_action_date: 'nextActionDate',
    next_action_time: 'nextActionTime',
  };
  Object.entries(legacyCalendarColumns).forEach(([column, legacyColumn]) => {
    if (addedCalendarColumns.has(column) && existingColumns.has(legacyColumn)) {
      db.exec(`UPDATE customers SET "${column}" = "${legacyColumn}"`);
    }
  });

  db.exec(`
    UPDATE customers
    SET contacts_json = COALESCE(NULLIF(contacts_json, ''), '[]'),
        documents_json = COALESCE(NULLIF(documents_json, ''), '[]'),
        bill_to_address_json = COALESCE(NULLIF(bill_to_address_json, ''), '{}'),
        ship_to_address_json = COALESCE(NULLIF(ship_to_address_json, ''), '{}'),
        calendar_status = COALESCE(NULLIF(calendar_status, ''), 'Pending'),
        ship_to_same_as_billing = COALESCE(ship_to_same_as_billing, 1),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS customers_email_nocase_idx ON customers(email COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS customers_company_status_created_idx
      ON customers(company_name, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS customers_calendar_dates_idx
      ON customers(meeting_date, renewal_date, contract_expiry_date, visit_date, next_action_date);
    CREATE TABLE IF NOT EXISTS customer_sequences (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );
  `);

  const uniqueCustomerIdIndexes = db.pragma('index_list(customers)')
    .filter((index) => index.unique)
    .filter((index) => {
      const escapedName = index.name.replace(/"/g, '""');
      const indexedColumns = db.pragma(`index_info("${escapedName}")`);
      return indexedColumns.length === 1 && indexedColumns[0].name === 'customer_id';
    });
  if (uniqueCustomerIdIndexes.length > 1) {
    uniqueCustomerIdIndexes
      .filter((index) => index.name === 'customers_customer_id_unique')
      .forEach(() => db.exec('DROP INDEX customers_customer_id_unique'));
  } else if (uniqueCustomerIdIndexes.length === 0) {
    db.exec(`
      CREATE UNIQUE INDEX customers_customer_id_unique
      ON customers(customer_id)
      WHERE customer_id IS NOT NULL AND customer_id <> ''
    `);
  }

  db.prepare(`
    INSERT INTO customer_sequences (name, value)
    VALUES ('customer', COALESCE((
      SELECT MAX(CAST(substr(customer_id, 4) AS INTEGER))
      FROM customers
      WHERE customer_id REGEXP '^CI-[0-9]+$'
    ), 0))
    ON CONFLICT(name) DO UPDATE SET value = MAX(value, excluded.value)
  `).run();
})();

db.exec(`
  CREATE TABLE IF NOT EXISTS company_profiles (
    id TEXT PRIMARY KEY,
    company_name TEXT DEFAULT '',
    quotation_format TEXT DEFAULT '',
    profile_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  UPDATE company_profiles
  SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
      updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP),
      profile_json = COALESCE(NULLIF(profile_json, ''), '{}');
  CREATE INDEX IF NOT EXISTS company_profiles_created_at_idx ON company_profiles(created_at DESC);
`);

const employeeColumnDefinitions = {
  password_salt: "TEXT DEFAULT ''",
  contact_no: "TEXT DEFAULT ''",
  joining_date: 'TEXT',
  date_of_join: 'TEXT',
  date_of_birth: 'TEXT',
  profile_photo: "TEXT DEFAULT ''",
  signature: "TEXT DEFAULT ''",
  employee_type: "TEXT DEFAULT ''",
  reporting_to: "TEXT DEFAULT ''",
  order_approval_to: "TEXT DEFAULT ''",
  branch_code: "TEXT DEFAULT ''",
  address: "TEXT DEFAULT ''",
  notes: "TEXT DEFAULT ''",
  created_by: "TEXT DEFAULT 'Admin'",
};

db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      employee_code TEXT,
      official_employee_id TEXT DEFAULT '',
      employee_name TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      email TEXT NOT NULL,
      password_hash TEXT DEFAULT '',
      password_salt TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      contact_no TEXT DEFAULT '',
      designation TEXT DEFAULT '',
      department TEXT DEFAULT 'Sales',
      role TEXT DEFAULT 'Sales Executive',
      status TEXT DEFAULT 'Active',
      joining_date TEXT,
      date_of_join TEXT,
      date_of_birth TEXT,
      profile_photo TEXT DEFAULT '',
      signature TEXT DEFAULT '',
      employee_type TEXT DEFAULT '',
      reporting_to TEXT DEFAULT '',
      order_approval_to TEXT DEFAULT '',
      branch_code TEXT DEFAULT '',
      crud_option TEXT DEFAULT '[]',
      modules_option TEXT DEFAULT '[]',
      permissions_json TEXT DEFAULT '{}',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_by TEXT DEFAULT 'Admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const existingColumns = new Set(db.pragma('table_info(employees)').map((column) => column.name));
  Object.entries(employeeColumnDefinitions).forEach(([name, definition]) => {
    if (!existingColumns.has(name)) {
      db.exec(`ALTER TABLE employees ADD COLUMN "${name}" ${definition}`);
    }
  });
  db.exec(`
    UPDATE employees
    SET full_name = COALESCE(NULLIF(full_name, ''), employee_name),
        email = lower(trim(email)),
        password_hash = COALESCE(password_hash, ''),
        password_salt = COALESCE(password_salt, ''),
        phone = COALESCE(phone, ''),
        contact_no = COALESCE(NULLIF(contact_no, ''), phone, ''),
        joining_date = COALESCE(joining_date, created_at, CURRENT_TIMESTAMP),
        crud_option = COALESCE(NULLIF(crud_option, ''), '[]'),
        modules_option = COALESCE(NULLIF(modules_option, ''), '[]'),
        permissions_json = COALESCE(NULLIF(permissions_json, ''), '{}'),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS employees_email_normalized_unique
      ON employees(lower(email));
    CREATE INDEX IF NOT EXISTS employees_name_role_status_created_idx
      ON employees(employee_name, role, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS employees_department_role_status_created_idx
      ON employees(department, role, status, created_at DESC);
    CREATE TABLE IF NOT EXISTS employee_sequences (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );
  `);
  const uniqueEmployeeCodeIndexes = db.pragma('index_list(employees)')
    .filter((index) => index.unique)
    .filter((index) => {
      const escapedName = index.name.replace(/"/g, '""');
      const indexedColumns = db.pragma(`index_info("${escapedName}")`);
      return indexedColumns.length === 1 && indexedColumns[0].name === 'employee_code';
    });
  if (uniqueEmployeeCodeIndexes.length > 1) {
    uniqueEmployeeCodeIndexes
      .filter((index) => index.name === 'employees_employee_code_unique')
      .forEach(() => db.exec('DROP INDEX employees_employee_code_unique'));
  } else if (uniqueEmployeeCodeIndexes.length === 0) {
    db.exec(`
      CREATE UNIQUE INDEX employees_employee_code_unique
      ON employees(employee_code)
      WHERE employee_code IS NOT NULL AND employee_code <> ''
    `);
  }
  db.prepare(`
    INSERT INTO employee_sequences (name, value)
    VALUES ('employee', COALESCE((
      SELECT MAX(CAST(substr(employee_code, 5) AS INTEGER))
      FROM employees
      WHERE employee_code REGEXP '^EMP-[0-9]+$'
    ), 0))
    ON CONFLICT(name) DO UPDATE SET value = MAX(value, excluded.value)
  `).run();
})();

const locationTableDefinitions = {
  countries: {
    create: `
      CREATE TABLE IF NOT EXISTS countries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT DEFAULT '',
        iso_code TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: {
      code: "TEXT DEFAULT ''",
      iso_code: "TEXT DEFAULT ''",
      created_at: 'TEXT',
      updated_at: 'TEXT',
    },
    backfill: `
      UPDATE countries
      SET code = COALESCE(NULLIF(code, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.code') END, ''),
          iso_code = COALESCE(NULLIF(iso_code, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.isoCode') END, ''),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    `,
  },
  states: {
    create: `
      CREATE TABLE IF NOT EXISTS states (
        id TEXT PRIMARY KEY,
        country_id TEXT,
        name TEXT NOT NULL,
        code TEXT DEFAULT '',
        country_code TEXT DEFAULT '',
        country_name TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: {
      code: "TEXT DEFAULT ''",
      country_code: "TEXT DEFAULT ''",
      country_name: "TEXT DEFAULT ''",
      created_at: 'TEXT',
      updated_at: 'TEXT',
    },
    backfill: `
      UPDATE states
      SET code = COALESCE(NULLIF(code, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.code') END, ''),
          country_code = COALESCE(NULLIF(country_code, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.countryCode') END, ''),
          country_name = COALESCE(NULLIF(country_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.countryName') END, ''),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    `,
  },
  cities: {
    create: `
      CREATE TABLE IF NOT EXISTS cities (
        id TEXT PRIMARY KEY,
        state_id TEXT,
        name TEXT NOT NULL,
        state_code TEXT DEFAULT '',
        state_name TEXT DEFAULT '',
        country_code TEXT DEFAULT '',
        country_name TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: {
      state_code: "TEXT DEFAULT ''",
      state_name: "TEXT DEFAULT ''",
      country_code: "TEXT DEFAULT ''",
      country_name: "TEXT DEFAULT ''",
      created_at: 'TEXT',
      updated_at: 'TEXT',
    },
    backfill: `
      UPDATE cities
      SET state_code = COALESCE(NULLIF(state_code, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.stateCode') END, ''),
          state_name = COALESCE(NULLIF(state_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.stateName') END, ''),
          country_code = COALESCE(NULLIF(country_code, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.countryCode') END, ''),
          country_name = COALESCE(NULLIF(country_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.countryName') END, ''),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    `,
  },
  areas: {
    create: `
      CREATE TABLE IF NOT EXISTS areas (
        id TEXT PRIMARY KEY,
        city_id TEXT,
        name TEXT NOT NULL,
        city_name TEXT DEFAULT '',
        state_name TEXT DEFAULT '',
        country_name TEXT DEFAULT '',
        pincode TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: {
      city_name: "TEXT DEFAULT ''",
      state_name: "TEXT DEFAULT ''",
      country_name: "TEXT DEFAULT ''",
      pincode: "TEXT DEFAULT ''",
      created_at: 'TEXT',
      updated_at: 'TEXT',
    },
    backfill: `
      UPDATE areas
      SET city_name = COALESCE(NULLIF(city_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.cityName') END, ''),
          state_name = COALESCE(NULLIF(state_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.stateName') END, ''),
          country_name = COALESCE(NULLIF(country_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.countryName') END, ''),
          pincode = COALESCE(NULLIF(pincode, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.pincode') END, ''),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    `,
  },
  pincodes: {
    create: `
      CREATE TABLE IF NOT EXISTS pincodes (
        id TEXT PRIMARY KEY,
        area_id TEXT,
        city_id TEXT,
        code TEXT NOT NULL,
        pincode TEXT NOT NULL DEFAULT '',
        area_name TEXT DEFAULT '',
        city_name TEXT DEFAULT '',
        state_name TEXT DEFAULT '',
        country_name TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: {
      area_id: 'TEXT',
      code: "TEXT DEFAULT ''",
      area_name: "TEXT DEFAULT ''",
      city_name: "TEXT DEFAULT ''",
      state_name: "TEXT DEFAULT ''",
      country_name: "TEXT DEFAULT ''",
      created_at: 'TEXT',
      updated_at: 'TEXT',
    },
    backfill: `
      UPDATE pincodes
      SET code = COALESCE(NULLIF(code, ''), pincode, CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.code') END, ''),
          area_name = COALESCE(NULLIF(area_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.areaName') END, ''),
          city_name = COALESCE(NULLIF(city_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.cityName') END, ''),
          state_name = COALESCE(NULLIF(state_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.stateName') END, ''),
          country_name = COALESCE(NULLIF(country_name, ''), CASE WHEN json_valid(data_json) THEN json_extract(data_json, '$.countryName') END, ''),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    `,
  },
};

db.transaction(() => {
  Object.entries(locationTableDefinitions).forEach(([table, definition]) => {
    db.exec(definition.create);
    const existingColumns = new Set(db.pragma(`table_info("${table}")`).map((column) => column.name));
    Object.entries(definition.columns).forEach(([name, columnDefinition]) => {
      if (!existingColumns.has(name)) {
        db.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${columnDefinition}`);
      }
    });
    if (existingColumns.has('data_json')) {
      db.exec(definition.backfill);
    } else {
      db.exec(`
        UPDATE "${table}"
        SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
            updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
      `);
    }
  });
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS countries_name_unique ON countries(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS states_country_id_idx ON states(country_id);
    CREATE INDEX IF NOT EXISTS states_country_name_idx ON states(country_name COLLATE NOCASE, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS cities_state_id_idx ON cities(state_id);
    CREATE INDEX IF NOT EXISTS cities_state_name_idx ON cities(state_name COLLATE NOCASE, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS areas_city_id_idx ON areas(city_id);
    CREATE INDEX IF NOT EXISTS areas_city_name_idx ON areas(city_name COLLATE NOCASE, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS pincodes_area_id_idx ON pincodes(area_id);
    CREATE INDEX IF NOT EXISTS pincodes_area_name_code_idx ON pincodes(area_name COLLATE NOCASE, code);
  `);
})();

db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT DEFAULT '',
      contact_name TEXT NOT NULL,
      designation TEXT DEFAULT '',
      mail TEXT DEFAULT '',
      contact_number TEXT NOT NULL,
      email TEXT NOT NULL,
      employee_id TEXT DEFAULT '',
      employee_email TEXT DEFAULT '',
      employee_name TEXT DEFAULT '',
      batch_name TEXT DEFAULT '',
      batch_number INTEGER,
      batch_id TEXT,
      calendar_status TEXT DEFAULT 'Pending',
      meeting_date TEXT DEFAULT '',
      meeting_time TEXT DEFAULT '',
      call_reminder_date TEXT DEFAULT '',
      call_reminder_time TEXT DEFAULT '',
      birthday TEXT DEFAULT '',
      anniversary TEXT DEFAULT '',
      next_action_date TEXT DEFAULT '',
      next_action_time TEXT DEFAULT '',
      time TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS customer_batches (
      id TEXT PRIMARY KEY,
      batch_name TEXT DEFAULT '',
      batch_number INTEGER,
      employee_id TEXT DEFAULT '',
      employee_email TEXT DEFAULT '',
      employee_name TEXT DEFAULT '',
      customer_count INTEGER NOT NULL DEFAULT 0,
      file_name TEXT DEFAULT '',
      created_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customer_batch_contacts (
      batch_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (batch_id, contact_id),
      FOREIGN KEY (batch_id) REFERENCES customer_batches(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      value INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const contactColumns = new Set(db.pragma('table_info(contacts)').map((column) => column.name));
  const contactCalendarColumns = {
    meeting_date: "TEXT DEFAULT ''",
    meeting_time: "TEXT DEFAULT ''",
    call_reminder_date: "TEXT DEFAULT ''",
    call_reminder_time: "TEXT DEFAULT ''",
    birthday: "TEXT DEFAULT ''",
    anniversary: "TEXT DEFAULT ''",
    next_action_date: "TEXT DEFAULT ''",
    next_action_time: "TEXT DEFAULT ''",
    time: "TEXT DEFAULT ''",
  };
  const addedContactCalendarColumns = new Set();
  Object.entries(contactCalendarColumns).forEach(([name, definition]) => {
    if (contactColumns.has(name)) return;
    db.exec(`ALTER TABLE contacts ADD COLUMN "${name}" ${definition}`);
    addedContactCalendarColumns.add(name);
  });
  const legacyContactCalendarColumns = {
    meeting_date: 'meetingDate',
    meeting_time: 'meetingTime',
    call_reminder_date: 'callReminderDate',
    call_reminder_time: 'callReminderTime',
    birthday: 'birthday',
    anniversary: 'anniversary',
    next_action_date: 'nextActionDate',
    next_action_time: 'nextActionTime',
    time: 'time',
  };
  Object.entries(legacyContactCalendarColumns).forEach(([name, legacyName]) => {
    if (addedContactCalendarColumns.has(name) && contactColumns.has(legacyName)) {
      db.exec(`UPDATE contacts SET "${name}" = "${legacyName}"`);
    }
  });
  if (!contactColumns.has('batch_id')) {
    db.exec('ALTER TABLE contacts ADD COLUMN batch_id TEXT');
  }
  if (!contactColumns.has('created_at')) {
    db.exec('ALTER TABLE contacts ADD COLUMN created_at TEXT');
  }
  if (!contactColumns.has('updated_at')) {
    db.exec('ALTER TABLE contacts ADD COLUMN updated_at TEXT');
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS contacts_calendar_dates_idx
      ON contacts(meeting_date, call_reminder_date, birthday, anniversary, next_action_date);
  `);

  const batchColumns = new Set(db.pragma('table_info(customer_batches)').map((column) => column.name));
  const batchColumnDefinitions = {
    employee_id: "TEXT DEFAULT ''",
    employee_email: "TEXT DEFAULT ''",
    employee_name: "TEXT DEFAULT ''",
    customer_count: 'INTEGER NOT NULL DEFAULT 0',
    file_name: "TEXT DEFAULT ''",
    created_date: 'TEXT',
    updated_at: 'TEXT',
  };
  Object.entries(batchColumnDefinitions).forEach(([name, definition]) => {
    if (!batchColumns.has(name)) {
      db.exec(`ALTER TABLE customer_batches ADD COLUMN "${name}" ${definition}`);
    }
  });

  const counterColumns = new Set(db.pragma('table_info(counters)').map((column) => column.name));
  ['created_at', 'updated_at'].forEach((name) => {
    if (!counterColumns.has(name)) {
      db.exec(`ALTER TABLE counters ADD COLUMN "${name}" TEXT`);
    }
  });

  db.exec(`
    UPDATE contacts
    SET employee_id = COALESCE(employee_id, ''),
        employee_email = lower(trim(COALESCE(employee_email, ''))),
        employee_name = COALESCE(employee_name, ''),
        batch_name = COALESCE(batch_name, ''),
        calendar_status = COALESCE(NULLIF(calendar_status, ''), 'Pending'),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    UPDATE customer_batches
    SET employee_id = COALESCE(employee_id, ''),
        employee_email = lower(trim(COALESCE(employee_email, ''))),
        employee_name = COALESCE(employee_name, ''),
        customer_count = COALESCE(customer_count, 0),
        file_name = COALESCE(file_name, ''),
        created_date = COALESCE(created_date, created_at, CURRENT_TIMESTAMP),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    UPDATE counters
    SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(email COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS contacts_number_idx ON contacts(contact_number);
    CREATE INDEX IF NOT EXISTS contacts_customer_name_idx ON contacts(customer_name COLLATE NOCASE, contact_name COLLATE NOCASE, created_at DESC);
    CREATE INDEX IF NOT EXISTS contacts_batch_idx ON contacts(employee_id, batch_number, batch_id);
    CREATE INDEX IF NOT EXISTS contacts_employee_created_idx ON contacts(employee_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS customer_batches_owner_number_idx ON customer_batches(employee_id, batch_number);
    CREATE INDEX IF NOT EXISTS customer_batch_contacts_contact_idx ON customer_batch_contacts(contact_id);
  `);

  if (batchColumns.has('data_json')) {
    const batches = db.prepare('SELECT id, data_json FROM customer_batches').all();
    const updateBatch = db.prepare(`
      UPDATE customer_batches
      SET employee_id = COALESCE(NULLIF(employee_id, ''), ?),
          employee_email = COALESCE(NULLIF(employee_email, ''), ?),
          employee_name = COALESCE(NULLIF(employee_name, ''), ?),
          customer_count = CASE WHEN customer_count = 0 THEN ? ELSE customer_count END,
          file_name = COALESCE(NULLIF(file_name, ''), ?),
          created_date = COALESCE(created_date, ?),
          updated_at = COALESCE(updated_at, ?)
      WHERE id = ?
    `);
    const insertBatchContact = db.prepare(`
      INSERT OR IGNORE INTO customer_batch_contacts (batch_id, contact_id, position)
      VALUES (?, ?, ?)
    `);
    batches.forEach((batch) => {
      if (!batch.data_json) return;
      let legacy;
      try {
        legacy = JSON.parse(batch.data_json);
      } catch (error) {
        throw new Error(`Cannot migrate customer_batches row ${batch.id}: invalid legacy data_json.`, { cause: error });
      }
      const customers = Array.isArray(legacy.customers) ? legacy.customers : [];
      updateBatch.run(
        String(legacy.employeeId || ''),
        String(legacy.employeeEmail || '').trim().toLowerCase(),
        String(legacy.employeeName || ''),
        Number(legacy.customerCount) || customers.length,
        String(legacy.fileName || ''),
        legacy.createdDate ? String(legacy.createdDate) : null,
        legacy.updatedAt ? String(legacy.updatedAt) : null,
        batch.id,
      );
      customers.forEach((customerId, position) => {
        const id = typeof customerId === 'string'
          ? customerId
          : customerId && typeof customerId === 'object'
            ? String(customerId.$oid || customerId.toString?.() || '')
            : '';
        if (id) insertBatchContact.run(batch.id, id, position);
      });
    });
  }

  db.exec(`
    UPDATE contacts
    SET batch_id = (
      SELECT batch_id FROM customer_batch_contacts
      WHERE contact_id = contacts.id
      ORDER BY position LIMIT 1
    )
    WHERE (batch_id IS NULL OR batch_id = '')
      AND EXISTS (SELECT 1 FROM customer_batch_contacts WHERE contact_id = contacts.id);
    UPDATE customer_batches
    SET customer_count = (
      SELECT COUNT(*) FROM customer_batch_contacts WHERE batch_id = customer_batches.id
    )
    WHERE customer_count = 0
      AND EXISTS (SELECT 1 FROM customer_batch_contacts WHERE batch_id = customer_batches.id);
  `);
})();

db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      created_by TEXT DEFAULT 'Admin',
      supplier_name TEXT NOT NULL,
      gst_number TEXT DEFAULT '',
      category TEXT NOT NULL,
      payment_terms TEXT NOT NULL,
      address_line_1 TEXT NOT NULL,
      country TEXT NOT NULL,
      state TEXT NOT NULL,
      city TEXT DEFAULT '',
      pin_code TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      bank_address TEXT DEFAULT '',
      account_holder TEXT DEFAULT '',
      account_number TEXT DEFAULT '',
      ifsc_code TEXT DEFAULT '',
      login_email_id TEXT DEFAULT '',
      login_password TEXT DEFAULT '',
      contact_type TEXT DEFAULT '',
      contact_name TEXT DEFAULT '',
      designation TEXT DEFAULT '',
      email_id TEXT DEFAULT '',
      contact_number TEXT DEFAULT '',
      product TEXT DEFAULT '',
      calendar_status TEXT DEFAULT 'Pending',
      delivery_date TEXT DEFAULT '',
      delivery_time TEXT DEFAULT '',
      payment_reminder_date TEXT DEFAULT '',
      payment_reminder_time TEXT DEFAULT '',
      follow_up_date TEXT DEFAULT '',
      follow_up_time TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS opfs (
      id TEXT PRIMARY KEY,
      opf_no TEXT NOT NULL,
      quotation_number TEXT NOT NULL,
      quotation_id TEXT DEFAULT '',
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      contact_person TEXT DEFAULT '',
      supplier_name TEXT NOT NULL,
      supplier_contact_person TEXT DEFAULT '',
      product TEXT NOT NULL,
      description TEXT DEFAULT '',
      quantity REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      vendor_price REAL DEFAULT 0,
      revenue REAL,
      margin REAL,
      tax TEXT DEFAULT '',
      part_no TEXT DEFAULT '',
      start_date TEXT,
      end_date TEXT,
      service_name TEXT DEFAULT '',
      service_cost REAL DEFAULT 0,
      service_tax REAL DEFAULT 0,
      freight_name TEXT DEFAULT '',
      freight_cost REAL DEFAULT 0,
      freight_tax REAL DEFAULT 0,
      wht REAL DEFAULT 0,
      conversion_rate REAL DEFAULT 1,
      vendor_currency TEXT DEFAULT 'INR',
      eta TEXT,
      customer_po_no TEXT DEFAULT '',
      customer_po_date TEXT,
      amc TEXT DEFAULT '',
      amc_renewal_date TEXT,
      notes TEXT DEFAULT '',
      customer_payment_terms TEXT DEFAULT '',
      supplier_payment_terms TEXT DEFAULT '',
      enduser_name TEXT DEFAULT '',
      enduser_email TEXT DEFAULT '',
      enduser_contact TEXT DEFAULT '',
      enduser_address TEXT DEFAULT '',
      bill_to_address TEXT DEFAULT '',
      ship_to_address TEXT DEFAULT '',
      po_file_json TEXT,
      customer_po_file_json TEXT,
      additional_document_json TEXT,
      uploaded_documents_json TEXT DEFAULT '[]',
      created_by TEXT DEFAULT 'Admin',
      created_date TEXT,
      renewal_date TEXT,
      approval_status TEXT DEFAULT 'Pending',
      data_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS opf_sequences (
      prefix TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );
  `);

  const supplierColumns = new Set(db.pragma('table_info(suppliers)').map((column) => column.name));
  const supplierCalendarColumns = {
    delivery_date: "TEXT DEFAULT ''",
    delivery_time: "TEXT DEFAULT ''",
    payment_reminder_date: "TEXT DEFAULT ''",
    payment_reminder_time: "TEXT DEFAULT ''",
    follow_up_date: "TEXT DEFAULT ''",
    follow_up_time: "TEXT DEFAULT ''",
  };
  const addedSupplierCalendarColumns = new Set();
  Object.entries(supplierCalendarColumns).forEach(([name, definition]) => {
    if (supplierColumns.has(name)) return;
    db.exec(`ALTER TABLE suppliers ADD COLUMN "${name}" ${definition}`);
    addedSupplierCalendarColumns.add(name);
  });
  const legacySupplierCalendarColumns = {
    delivery_date: 'deliveryDate',
    delivery_time: 'deliveryTime',
    payment_reminder_date: 'paymentReminderDate',
    payment_reminder_time: 'paymentReminderTime',
    follow_up_date: 'followUpDate',
    follow_up_time: 'followUpTime',
  };
  Object.entries(legacySupplierCalendarColumns).forEach(([name, legacyName]) => {
    if (addedSupplierCalendarColumns.has(name) && supplierColumns.has(legacyName)) {
      db.exec(`UPDATE suppliers SET "${name}" = "${legacyName}"`);
    }
  });
  db.exec(`
    CREATE INDEX IF NOT EXISTS suppliers_calendar_dates_idx
      ON suppliers(delivery_date, payment_reminder_date, follow_up_date);
  `);

  const existingSupplierColumns = new Set(db.pragma('table_info(suppliers)').map(({ name }) => name));
  const supplierColumnDefinitions = {
    bank_name: "TEXT DEFAULT ''",
    bank_address: "TEXT DEFAULT ''",
    account_holder: "TEXT DEFAULT ''",
    account_number: "TEXT DEFAULT ''",
    ifsc_code: "TEXT DEFAULT ''",
    login_email_id: "TEXT DEFAULT ''",
    login_password: "TEXT DEFAULT ''",
    contact_type: "TEXT DEFAULT ''",
    calendar_status: "TEXT DEFAULT 'Pending'",
    created_at: 'TEXT',
    updated_at: 'TEXT',
  };
  Object.entries(supplierColumnDefinitions).forEach(([name, definition]) => {
    if (!existingSupplierColumns.has(name)) {
      db.exec(`ALTER TABLE suppliers ADD COLUMN "${name}" ${definition}`);
    }
  });

  const opfColumns = new Set(db.pragma('table_info(opfs)').map(({ name }) => name));
  const opfColumnDefinitions = {
    quotation_id: "TEXT DEFAULT ''",
    customer_id: 'TEXT',
    contact_person: "TEXT DEFAULT ''",
    supplier_contact_person: "TEXT DEFAULT ''",
    description: "TEXT DEFAULT ''",
    quantity: 'REAL DEFAULT 0',
    unit_price: 'REAL DEFAULT 0',
    vendor_price: 'REAL DEFAULT 0',
    revenue: 'REAL',
    margin: 'REAL',
    tax: "TEXT DEFAULT ''",
    part_no: "TEXT DEFAULT ''",
    start_date: 'TEXT',
    end_date: 'TEXT',
    service_name: "TEXT DEFAULT ''",
    service_cost: 'REAL DEFAULT 0',
    service_tax: 'REAL DEFAULT 0',
    freight_name: "TEXT DEFAULT ''",
    freight_cost: 'REAL DEFAULT 0',
    freight_tax: 'REAL DEFAULT 0',
    wht: 'REAL DEFAULT 0',
    conversion_rate: 'REAL DEFAULT 1',
    vendor_currency: "TEXT DEFAULT 'INR'",
    eta: 'TEXT',
    customer_po_no: "TEXT DEFAULT ''",
    customer_po_date: 'TEXT',
    amc: "TEXT DEFAULT ''",
    amc_renewal_date: 'TEXT',
    notes: "TEXT DEFAULT ''",
    customer_payment_terms: "TEXT DEFAULT ''",
    supplier_payment_terms: "TEXT DEFAULT ''",
    enduser_name: "TEXT DEFAULT ''",
    enduser_email: "TEXT DEFAULT ''",
    enduser_contact: "TEXT DEFAULT ''",
    enduser_address: "TEXT DEFAULT ''",
    bill_to_address: "TEXT DEFAULT ''",
    ship_to_address: "TEXT DEFAULT ''",
    po_file_json: 'TEXT',
    customer_po_file_json: 'TEXT',
    additional_document_json: 'TEXT',
    uploaded_documents_json: "TEXT DEFAULT '[]'",
    created_by: "TEXT DEFAULT 'Admin'",
    created_date: 'TEXT',
    renewal_date: 'TEXT',
    data_json: "TEXT DEFAULT '{}'",
  };
  const addedOpfColumns = new Set();
  Object.entries(opfColumnDefinitions).forEach(([name, definition]) => {
    if (!opfColumns.has(name)) {
      db.exec(`ALTER TABLE opfs ADD COLUMN "${name}" ${definition}`);
      addedOpfColumns.add(name);
    }
  });

  if (addedOpfColumns.size && opfColumns.has('data_json')) {
    const backfill = db.prepare(`
      UPDATE opfs SET
        quotation_id = COALESCE(?, quotation_id),
        customer_id = COALESCE(?, customer_id),
        contact_person = COALESCE(?, contact_person),
        supplier_contact_person = COALESCE(?, supplier_contact_person),
        description = COALESCE(?, description),
        quantity = COALESCE(?, quantity),
        unit_price = COALESCE(?, unit_price),
        vendor_price = COALESCE(?, vendor_price),
        revenue = COALESCE(?, revenue),
        margin = COALESCE(?, margin),
        tax = COALESCE(?, tax),
        part_no = COALESCE(?, part_no),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        service_name = COALESCE(?, service_name),
        service_cost = COALESCE(?, service_cost),
        service_tax = COALESCE(?, service_tax),
        freight_name = COALESCE(?, freight_name),
        freight_cost = COALESCE(?, freight_cost),
        freight_tax = COALESCE(?, freight_tax),
        wht = COALESCE(?, wht),
        conversion_rate = COALESCE(?, conversion_rate),
        vendor_currency = COALESCE(?, vendor_currency),
        eta = COALESCE(?, eta),
        customer_po_no = COALESCE(?, customer_po_no),
        customer_po_date = COALESCE(?, customer_po_date),
        amc = COALESCE(?, amc),
        amc_renewal_date = COALESCE(?, amc_renewal_date),
        notes = COALESCE(?, notes),
        customer_payment_terms = COALESCE(?, customer_payment_terms),
        supplier_payment_terms = COALESCE(?, supplier_payment_terms),
        enduser_name = COALESCE(?, enduser_name),
        enduser_email = COALESCE(?, enduser_email),
        enduser_contact = COALESCE(?, enduser_contact),
        enduser_address = COALESCE(?, enduser_address),
        bill_to_address = COALESCE(?, bill_to_address),
        ship_to_address = COALESCE(?, ship_to_address),
        po_file_json = COALESCE(?, po_file_json),
        customer_po_file_json = COALESCE(?, customer_po_file_json),
        additional_document_json = COALESCE(?, additional_document_json),
        uploaded_documents_json = COALESCE(?, uploaded_documents_json),
        created_by = COALESCE(?, created_by),
        created_date = COALESCE(?, created_date),
        renewal_date = COALESCE(?, renewal_date)
      WHERE id = ?
    `);
    const legacyFields = [
      ['quotation_id', 'quotationId'], ['customer_id', 'customerId'],
      ['contact_person', 'contactPerson'], ['supplier_contact_person', 'supplierContactPerson'],
      ['description', 'description'], ['quantity', 'quantity'], ['unit_price', 'unitPrice'],
      ['vendor_price', 'vendorPrice'], ['revenue', 'revenue'], ['margin', 'margin'],
      ['tax', 'tax'], ['part_no', 'partNo'], ['start_date', 'startDate'],
      ['end_date', 'endDate'], ['service_name', 'serviceName'], ['service_cost', 'serviceCost'],
      ['service_tax', 'serviceTax'], ['freight_name', 'freightName'], ['freight_cost', 'freightCost'],
      ['freight_tax', 'freightTax'], ['wht', 'wht'], ['conversion_rate', 'conversionRate'],
      ['vendor_currency', 'vendorCurrency'], ['eta', 'eta'], ['customer_po_no', 'customerPONo'],
      ['customer_po_date', 'customerPODate'], ['amc', 'amc'], ['amc_renewal_date', 'amcRenewalDate'],
      ['notes', 'notes'], ['customer_payment_terms', 'customerPaymentTerms'],
      ['supplier_payment_terms', 'supplierPaymentTerms'], ['enduser_name', 'enduserName'],
      ['enduser_email', 'enduserEmail'], ['enduser_contact', 'enduserContact'],
      ['enduser_address', 'enduserAddress'], ['bill_to_address', 'billToAddress'],
      ['ship_to_address', 'shipToAddress'], ['po_file_json', 'poFile'],
      ['customer_po_file_json', 'customerPOFile'], ['additional_document_json', 'additionalDocument'],
      ['uploaded_documents_json', 'uploadedDocuments'], ['created_by', 'createdBy'],
      ['created_date', 'createdDate'], ['renewal_date', 'renewalDate'],
    ];
    const legacyRows = db.prepare('SELECT id, data_json FROM opfs').all();
    for (const row of legacyRows) {
      let legacy;
      try {
        legacy = JSON.parse(row.data_json || '{}');
      } catch (error) {
        throw new Error(`Cannot migrate OPF row ${row.id}: invalid data_json.`, { cause: error });
      }
      const values = legacyFields.map(([column, field]) => {
        if (!addedOpfColumns.has(column) || legacy[field] === undefined || legacy[field] === null) return null;
        const value = legacy[field];
        return column.endsWith('_json') ? JSON.stringify(value) : value instanceof Date ? value.toISOString() : value;
      });
      backfill.run(...values, row.id);
    }
  }

  db.exec(`
    UPDATE suppliers
    SET created_by = COALESCE(NULLIF(created_by, ''), 'Admin'),
        calendar_status = COALESCE(NULLIF(calendar_status, ''), 'Pending'),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    UPDATE opfs
    SET created_by = COALESCE(NULLIF(created_by, ''), 'Admin'),
        approval_status = COALESCE(NULLIF(approval_status, ''), 'Pending'),
        uploaded_documents_json = COALESCE(uploaded_documents_json, '[]'),
        data_json = COALESCE(data_json, '{}'),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS suppliers_supplier_id_unique
      ON suppliers(supplier_id) WHERE supplier_id IS NOT NULL AND supplier_id <> '';
    CREATE INDEX IF NOT EXISTS suppliers_search_idx
      ON suppliers(supplier_name COLLATE NOCASE, contact_name COLLATE NOCASE, email_id COLLATE NOCASE, contact_number, product COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS suppliers_creator_product_created_idx
      ON suppliers(created_by COLLATE NOCASE, product COLLATE NOCASE, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS opfs_opf_no_unique ON opfs(opf_no);
    CREATE INDEX IF NOT EXISTS opfs_customer_creator_status_date_idx
      ON opfs(customer_name COLLATE NOCASE, created_by COLLATE NOCASE, approval_status, created_date DESC);
    CREATE INDEX IF NOT EXISTS opfs_report_filters_idx
      ON opfs(created_by COLLATE NOCASE, customer_name COLLATE NOCASE, product COLLATE NOCASE, created_date DESC);
    CREATE INDEX IF NOT EXISTS opfs_product_created_date_idx
      ON opfs(product COLLATE NOCASE, created_date DESC);
    CREATE INDEX IF NOT EXISTS opfs_renewal_date_idx ON opfs(renewal_date);
  `);
})();

db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mail_campaigns (
      id TEXT PRIMARY KEY,
      campaign_id TEXT UNIQUE,
      campaign_name TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      campaign_type TEXT DEFAULT 'Promotional',
      priority TEXT DEFAULT 'Medium',
      image_alignment TEXT DEFAULT 'Image Before Text',
      tags_json TEXT DEFAULT '[]',
      recipient_modules_json TEXT DEFAULT '[]',
      recipient_group_json TEXT DEFAULT '[]',
      recipient_emails_json TEXT DEFAULT '[]',
      batch_name TEXT DEFAULT '',
      batch_number INTEGER,
      batch_id TEXT,
      employee_id TEXT DEFAULT '',
      employee_name TEXT DEFAULT '',
      recipient_count INTEGER DEFAULT 0,
      campaign_body TEXT DEFAULT '',
      footer TEXT DEFAULT '',
      image TEXT DEFAULT '',
      attachments_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'Draft',
      calendar_status TEXT DEFAULT 'Pending',
      opens INTEGER DEFAULT 0,
      unique_opens INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_by TEXT DEFAULT 'Admin',
      created_date TEXT DEFAULT '',
      scheduled_date TEXT DEFAULT '',
      scheduled_time TEXT DEFAULT '',
      timezone TEXT DEFAULT 'UTC',
      sent_date TEXT DEFAULT '',
      test_email TEXT DEFAULT '',
      delivery_results_json TEXT DEFAULT '[]',
      deleted_at TEXT,
      data_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mail_campaign_groups (
      group_id TEXT PRIMARY KEY,
      campaign_row_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (campaign_row_id) REFERENCES mail_campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS campaign_group_contacts (
      group_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (group_id, contact_id),
      FOREIGN KEY (group_id) REFERENCES mail_campaign_groups(group_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      campaign_name TEXT DEFAULT '',
      recipient TEXT DEFAULT '',
      recipient_email TEXT NOT NULL,
      status TEXT DEFAULT 'Failed',
      sent_at TEXT,
      error_message TEXT DEFAULT '',
      sender_email TEXT DEFAULT '',
      tracking_id TEXT,
      tracking_token TEXT,
      opened_at TEXT,
      open_count INTEGER NOT NULL DEFAULT 0,
      first_opened_at TEXT,
      last_opened_at TEXT,
      clicked_at TEXT,
      click_count INTEGER NOT NULL DEFAULT 0,
      first_clicked_at TEXT,
      last_clicked_at TEXT,
      lead_created INTEGER NOT NULL DEFAULT 0,
      lead_id TEXT DEFAULT '',
      data_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const campaignColumns = new Set(db.pragma('table_info(mail_campaigns)').map(({ name }) => name));
  const campaignColumnDefinitions = {
    campaign_id: 'TEXT',
    subject: "TEXT NOT NULL DEFAULT ''",
    campaign_type: "TEXT DEFAULT 'Promotional'",
    priority: "TEXT DEFAULT 'Medium'",
    image_alignment: "TEXT DEFAULT 'Image Before Text'",
    tags_json: "TEXT DEFAULT '[]'",
    recipient_modules_json: "TEXT DEFAULT '[]'",
    recipient_group_json: "TEXT DEFAULT '[]'",
    recipient_emails_json: "TEXT DEFAULT '[]'",
    batch_name: "TEXT DEFAULT ''",
    batch_number: 'INTEGER',
    batch_id: 'TEXT',
    employee_id: "TEXT DEFAULT ''",
    employee_name: "TEXT DEFAULT ''",
    recipient_count: 'INTEGER DEFAULT 0',
    campaign_body: "TEXT DEFAULT ''",
    footer: "TEXT DEFAULT ''",
    image: "TEXT DEFAULT ''",
    attachments_json: "TEXT DEFAULT '[]'",
    calendar_status: "TEXT DEFAULT 'Pending'",
    opens: 'INTEGER DEFAULT 0',
    unique_opens: 'INTEGER DEFAULT 0',
    clicks: 'INTEGER DEFAULT 0',
    created_by: "TEXT DEFAULT 'Admin'",
    created_date: "TEXT DEFAULT ''",
    scheduled_date: "TEXT DEFAULT ''",
    scheduled_time: "TEXT DEFAULT ''",
    timezone: "TEXT DEFAULT 'UTC'",
    sent_date: "TEXT DEFAULT ''",
    test_email: "TEXT DEFAULT ''",
    delivery_results_json: "TEXT DEFAULT '[]'",
    deleted_at: 'TEXT',
    data_json: "TEXT DEFAULT '{}'",
  };
  const addedCampaignColumns = new Set();
  Object.entries(campaignColumnDefinitions).forEach(([name, definition]) => {
    if (campaignColumns.has(name)) return;
    db.exec(`ALTER TABLE mail_campaigns ADD COLUMN "${name}" ${definition}`);
    addedCampaignColumns.add(name);
  });

  const emailColumns = new Set(db.pragma('table_info(email_logs)').map(({ name }) => name));
  const emailColumnDefinitions = {
    campaign_id: 'TEXT',
    campaign_name: "TEXT DEFAULT ''",
    recipient: "TEXT DEFAULT ''",
    recipient_email: "TEXT DEFAULT ''",
    sent_at: 'TEXT',
    error_message: "TEXT DEFAULT ''",
    sender_email: "TEXT DEFAULT ''",
    tracking_id: 'TEXT',
    tracking_token: 'TEXT',
    opened_at: 'TEXT',
    open_count: 'INTEGER NOT NULL DEFAULT 0',
    first_opened_at: 'TEXT',
    last_opened_at: 'TEXT',
    clicked_at: 'TEXT',
    click_count: 'INTEGER NOT NULL DEFAULT 0',
    first_clicked_at: 'TEXT',
    last_clicked_at: 'TEXT',
    lead_created: 'INTEGER NOT NULL DEFAULT 0',
    lead_id: "TEXT DEFAULT ''",
    updated_at: 'TEXT',
  };
  Object.entries(emailColumnDefinitions).forEach(([name, definition]) => {
    if (!emailColumns.has(name)) db.exec(`ALTER TABLE email_logs ADD COLUMN "${name}" ${definition}`);
  });

  if (addedCampaignColumns.size && campaignColumns.has('data_json')) {
    const rows = db.prepare('SELECT id, data_json FROM mail_campaigns').all();
    const updateCampaign = db.prepare(`
      UPDATE mail_campaigns SET
        campaign_id = COALESCE(?, campaign_id),
        campaign_name = COALESCE(?, campaign_name),
        subject = COALESCE(?, subject),
        campaign_type = COALESCE(?, campaign_type),
        priority = COALESCE(?, priority),
        image_alignment = COALESCE(?, image_alignment),
        tags_json = COALESCE(?, tags_json),
        recipient_modules_json = COALESCE(?, recipient_modules_json),
        recipient_group_json = COALESCE(?, recipient_group_json),
        recipient_emails_json = COALESCE(?, recipient_emails_json),
        batch_name = COALESCE(?, batch_name),
        batch_number = COALESCE(?, batch_number),
        batch_id = COALESCE(?, batch_id),
        employee_id = COALESCE(?, employee_id),
        employee_name = COALESCE(?, employee_name),
        recipient_count = COALESCE(?, recipient_count),
        campaign_body = COALESCE(?, campaign_body),
        footer = COALESCE(?, footer),
        image = COALESCE(?, image),
        attachments_json = COALESCE(?, attachments_json),
        status = COALESCE(?, status),
        calendar_status = COALESCE(?, calendar_status),
        opens = COALESCE(?, opens),
        unique_opens = COALESCE(?, unique_opens),
        clicks = COALESCE(?, clicks),
        created_by = COALESCE(?, created_by),
        created_date = COALESCE(?, created_date),
        scheduled_date = COALESCE(?, scheduled_date),
        scheduled_time = COALESCE(?, scheduled_time),
        timezone = COALESCE(?, timezone),
        sent_date = COALESCE(?, sent_date),
        test_email = COALESCE(?, test_email),
        delivery_results_json = COALESCE(?, delivery_results_json),
        deleted_at = COALESCE(?, deleted_at)
      WHERE id = ?
    `);
    const campaignFields = [
      ['campaign_id', 'campaignId'], ['campaign_name', 'campaignName'], ['subject', 'subject'],
      ['campaign_type', 'campaignType'], ['priority', 'priority'], ['image_alignment', 'imageAlignment'],
      ['tags_json', 'tags'], ['recipient_modules_json', 'recipientModules'], ['recipient_group_json', 'recipientGroup'],
      ['recipient_emails_json', 'recipientEmails'], ['batch_name', 'batchName'], ['batch_number', 'batchNumber'],
      ['batch_id', 'batchId'], ['employee_id', 'employeeId'], ['employee_name', 'employeeName'],
      ['recipient_count', 'recipientCount'], ['campaign_body', 'campaignBody'], ['footer', 'footer'],
      ['image', 'image'], ['attachments_json', 'attachments'], ['status', 'status'],
      ['calendar_status', 'calendarStatus'], ['opens', 'opens'], ['unique_opens', 'uniqueOpens'],
      ['clicks', 'clicks'], ['created_by', 'createdBy'], ['created_date', 'createdDate'],
      ['scheduled_date', 'scheduledDate'], ['scheduled_time', 'scheduledTime'], ['timezone', 'timezone'],
      ['sent_date', 'sentDate'], ['test_email', 'testEmail'], ['delivery_results_json', 'deliveryResults'],
      ['deleted_at', 'deletedAt'],
    ];
    for (const row of rows) {
      let legacy;
      try {
        legacy = JSON.parse(row.data_json || '{}');
      } catch (error) {
        throw new Error(`Cannot migrate mail_campaigns row ${row.id}: invalid data_json.`, { cause: error });
      }
      const values = campaignFields.map(([column, field]) => (
        addedCampaignColumns.has(column) && legacy[field] !== undefined && legacy[field] !== null
          ? column.endsWith('_json') ? JSON.stringify(legacy[field]) : legacy[field] instanceof Date ? legacy[field].toISOString() : legacy[field]
          : null
      ));
      updateCampaign.run(...values, row.id);

      if (addedCampaignColumns.has('campaign_id') && Array.isArray(legacy.campaignGroups)) {
        const insertGroup = db.prepare(`
          INSERT OR IGNORE INTO mail_campaign_groups (group_id, campaign_row_id, position, data_json)
          VALUES (?, ?, ?, ?)
        `);
        const insertContact = db.prepare(`
          INSERT OR IGNORE INTO campaign_group_contacts (group_id, contact_id, position)
          VALUES (?, ?, ?)
        `);
        legacy.campaignGroups.forEach((group, position) => {
          const groupId = String(group._id || `${row.id}-group-${position}`);
          insertGroup.run(groupId, row.id, position, JSON.stringify(group));
          (Array.isArray(group.contactIds) ? group.contactIds : []).forEach((contactId, contactPosition) => {
            insertContact.run(groupId, String(contactId), contactPosition);
          });
        });
      }
    }
  }

  if (emailColumns.has('data_json')) {
    const rows = db.prepare('SELECT id, data_json, recipient, status, created_at FROM email_logs WHERE campaign_id IS NULL').all();
    const updateLog = db.prepare(`
      UPDATE email_logs SET campaign_id = ?, campaign_name = ?, recipient_email = ?,
        status = ?, sent_at = ?, error_message = ?, sender_email = ?, tracking_id = ?,
        tracking_token = ?, opened_at = ?, open_count = ?, first_opened_at = ?,
        last_opened_at = ?, clicked_at = ?, click_count = ?, first_clicked_at = ?,
        last_clicked_at = ?, lead_created = ?, lead_id = ?, updated_at = ?
      WHERE id = ?
    `);
    for (const row of rows) {
      let legacy;
      try {
        legacy = JSON.parse(row.data_json || '{}');
      } catch (error) {
        throw new Error(`Cannot migrate email_logs row ${row.id}: invalid data_json.`, { cause: error });
      }
      if (!legacy.campaignId) continue;
      const sentAt = legacy.sentAt instanceof Date ? legacy.sentAt.toISOString() : legacy.sentAt || row.created_at;
      updateLog.run(
        String(legacy.campaignId),
        String(legacy.campaignName || ''),
        String(legacy.recipientEmail || row.recipient || ''),
        legacy.status || row.status || 'Failed',
        sentAt,
        String(legacy.errorMessage || ''),
        String(legacy.senderEmail || ''),
        legacy.trackingId || null,
        legacy.trackingToken || null,
        legacy.openedAt || null,
        Number(legacy.openCount) || 0,
        legacy.firstOpenedAt || null,
        legacy.lastOpenedAt || null,
        legacy.clickedAt || null,
        Number(legacy.clickCount) || 0,
        legacy.firstClickedAt || null,
        legacy.lastClickedAt || null,
        legacy.leadCreated ? 1 : 0,
        String(legacy.leadId || ''),
        legacy.updatedAt || row.created_at,
        row.id,
      );
    }
  }

  db.exec(`
    UPDATE mail_campaigns SET
      campaign_id = NULLIF(campaign_id, ''),
      campaign_name = COALESCE(campaign_name, ''),
      subject = COALESCE(subject, ''),
      status = COALESCE(NULLIF(status, ''), 'Draft'),
      calendar_status = COALESCE(NULLIF(calendar_status, ''), 'Pending'),
      created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
      updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    UPDATE email_logs SET
      recipient_email = COALESCE(NULLIF(recipient_email, ''), recipient, ''),
      status = COALESCE(NULLIF(status, ''), 'Failed'),
      sent_at = COALESCE(sent_at, created_at, CURRENT_TIMESTAMP),
      open_count = COALESCE(open_count, 0),
      click_count = COALESCE(click_count, 0),
      lead_created = COALESCE(lead_created, 0),
      updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS mail_campaigns_campaign_id_unique
      ON mail_campaigns(campaign_id) WHERE campaign_id IS NOT NULL AND campaign_id <> '';
    CREATE INDEX IF NOT EXISTS mail_campaigns_status_schedule_idx
      ON mail_campaigns(status, scheduled_date, scheduled_time);
    CREATE INDEX IF NOT EXISTS mail_campaigns_created_idx
      ON mail_campaigns(created_at DESC);
    CREATE INDEX IF NOT EXISTS mail_campaigns_owner_status_idx
      ON mail_campaigns(created_by COLLATE NOCASE, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS mail_campaign_groups_campaign_position_idx
      ON mail_campaign_groups(campaign_row_id, position);
    CREATE INDEX IF NOT EXISTS campaign_group_contacts_contact_idx
      ON campaign_group_contacts(contact_id);
    CREATE INDEX IF NOT EXISTS email_logs_campaign_sent_idx
      ON email_logs(campaign_id, sent_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS email_logs_tracking_id_unique
      ON email_logs(tracking_id) WHERE tracking_id IS NOT NULL AND tracking_id <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS email_logs_tracking_token_unique
      ON email_logs(tracking_token) WHERE tracking_token IS NOT NULL AND tracking_token <> '';
    CREATE INDEX IF NOT EXISTS email_logs_campaign_recipient_sent_idx
      ON email_logs(campaign_id, recipient_email COLLATE NOCASE, sent_at DESC);
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS email_logs_campaign_insert_guard
    BEFORE INSERT ON email_logs
    WHEN NEW.campaign_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM mail_campaigns WHERE campaign_id = NEW.campaign_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'email log campaign does not exist');
    END;
    CREATE TRIGGER IF NOT EXISTS email_logs_campaign_update_guard
    BEFORE UPDATE OF campaign_id ON email_logs
    WHEN NEW.campaign_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM mail_campaigns WHERE campaign_id = NEW.campaign_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'email log campaign does not exist');
    END;
  `);
})();

module.exports = { db, dbPath };
