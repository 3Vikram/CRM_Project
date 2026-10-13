const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { db } = require('../utils/salesDatabase');

const argumentsSet = new Set(process.argv.slice(2));
const unknownArguments = [...argumentsSet].filter((argument) => !['--dry-run', '--apply'].includes(argument));
if (unknownArguments.length || (argumentsSet.has('--dry-run') && argumentsSet.has('--apply'))) {
  console.error('Usage: node sales/backend/scripts/import-leads-from-mongo.js [--dry-run | --apply]');
  process.exit(2);
}

const applyChanges = argumentsSet.has('--apply');

const getOptionalString = (value) => (value === undefined || value === null ? undefined : String(value));

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be configured in sales/backend/.env before importing.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.db.collection('leads');
  const existingRows = db.prepare('SELECT id, lead_id AS leadId, quotation_id AS quotationId FROM leads').all();
  const existingIds = new Set(existingRows.map((row) => row.id));
  const existingLeadIds = new Set(existingRows.map((row) => row.leadId).filter(Boolean));
  const existingQuotationIds = new Set(existingRows.map((row) => row.quotationId).filter(Boolean));
  const sourceIds = new Set();
  const sourceLeadIds = new Set();
  const sourceQuotationIds = new Set();
  const counts = { scanned: 0, inserted: 0, alreadyPresent: 0, conflicts: 0 };

  for await (const document of collection.find({})) {
    counts.scanned += 1;
    const id = getOptionalString(document._id);
    const leadId = getOptionalString(document.leadId);
    const quotationId = getOptionalString(document.quotationId);

    if (!id || sourceIds.has(id)) {
      counts.conflicts += 1;
      continue;
    }
    sourceIds.add(id);

    if (existingIds.has(id)) {
      const existingRecord = Lead.inspectImportRecord({ ...document, _id: id });
      if (existingRecord.identical) counts.alreadyPresent += 1;
      else counts.conflicts += 1;
      continue;
    }

    if ((leadId && (existingLeadIds.has(leadId) || sourceLeadIds.has(leadId)))
      || (quotationId && (existingQuotationIds.has(quotationId) || sourceQuotationIds.has(quotationId)))) {
      counts.conflicts += 1;
      continue;
    }

    if (leadId) sourceLeadIds.add(leadId);
    if (quotationId) sourceQuotationIds.add(quotationId);

    if (!applyChanges) {
      counts.inserted += 1;
      existingIds.add(id);
      if (leadId) existingLeadIds.add(leadId);
      if (quotationId) existingQuotationIds.add(quotationId);
      continue;
    }

    const result = Lead.importRecord({ ...document, _id: id });
    if (result.status === 'inserted') {
      counts.inserted += 1;
      existingIds.add(id);
      if (leadId) existingLeadIds.add(leadId);
      if (quotationId) existingQuotationIds.add(quotationId);
    } else if (result.status === 'exists') {
      counts.alreadyPresent += 1;
    } else {
      counts.conflicts += 1;
    }
  }

  console.log(`${applyChanges ? 'Copy' : 'Dry run'} complete.`, counts);
  if (counts.conflicts) {
    console.error('Some source records conflict with SQLite IDs; no conflicting record was overwritten.');
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = process.env.MONGO_URI
      ? message.replaceAll(process.env.MONGO_URI, '[redacted MONGO_URI]')
      : message;
    console.error('Lead import failed:', safeMessage);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    db.close();
  });
