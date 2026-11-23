const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const customerIdentityKeys = (customer = {}) => {
  const keys = new Set();
  const gstNumber = String(customer.gstNumber || '').trim().toUpperCase();
  if (gstNumber) keys.add(`gst:${gstNumber}`);
  const names = [
    customer.companyName,
    customer.customerName,
    ...(Array.isArray(customer.contacts) ? customer.contacts.map((contact) => contact?.name) : []),
  ];
  names.map(normalizeText).filter(Boolean).forEach((value) => keys.add(`name:${value}`));

  const emails = [
    customer.email,
    ...(Array.isArray(customer.contacts) ? customer.contacts.map((contact) => contact?.email) : []),
  ];
  emails.map(normalizeEmail)
    .filter((value) => value && value !== 'noemail@noemail.com')
    .forEach((value) => keys.add(`email:${value}`));

  const phones = [
    customer.phone,
    ...(Array.isArray(customer.contacts) ? customer.contacts.map((contact) => contact?.phone) : []),
  ];
  phones.map(normalizePhone)
    .filter((value) => value.length >= 7 && !/^0+$/.test(value))
    .forEach((value) => keys.add(`phone:${value}`));

  return Array.from(keys);
};

const exactWhitespaceInsensitive = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const pattern = normalized.split(' ').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  return new RegExp(`^\\s*${pattern}\\s*$`, 'i');
};

const exactPhonePattern = (value) => {
  const digits = normalizePhone(value);
  if (digits.length < 7 || /^0+$/.test(digits)) return null;
  return new RegExp(`^\\D*${digits.split('').join('\\D*')}\\D*$`);
};

const customerDuplicateConditions = (customer = {}) => {
  const conditions = [];
  const names = [
    customer.companyName,
    customer.customerName,
    ...(Array.isArray(customer.contacts) ? customer.contacts.map((contact) => contact?.name) : []),
  ];
  names.map(exactWhitespaceInsensitive).filter(Boolean).forEach((pattern) => {
    conditions.push({ companyName: pattern }, { customerName: pattern }, { 'contacts.name': pattern });
  });

  const emails = [
    customer.email,
    ...(Array.isArray(customer.contacts) ? customer.contacts.map((contact) => contact?.email) : []),
  ].map(normalizeEmail).filter((value) => value && value !== 'noemail@noemail.com');
  emails.forEach((email) => {
    const pattern = new RegExp(`^\\s*${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    conditions.push({ email: pattern }, { 'contacts.email': pattern });
  });

  const phones = [
    customer.phone,
    ...(Array.isArray(customer.contacts) ? customer.contacts.map((contact) => contact?.phone) : []),
  ];
  phones.map(exactPhonePattern).filter(Boolean).forEach((pattern) => {
    conditions.push({ phone: pattern }, { 'contacts.phone': pattern });
  });

  const gstNumber = String(customer.gstNumber || '').trim().toUpperCase();
  if (gstNumber) conditions.push({ gstNumber });
  return conditions;
};

module.exports = {
  customerDuplicateConditions,
  customerIdentityKeys,
  normalizeEmail,
  normalizePhone,
  normalizeText,
};
