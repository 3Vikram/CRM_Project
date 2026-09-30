const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const normalizeSort = (sortBy, sortOrder = 'desc', allowedFields = []) => {
  const safeSortBy = allowedFields.includes(sortBy) ? sortBy : allowedFields[0] || 'createdAt';
  const direction = sortOrder === 'asc' ? 1 : -1;
  return { [safeSortBy]: direction };
};

const normalizeSearch = (value = '') => String(value).trim();

const regexFromSearch = (value = '', flags = 'i') => {
  const trimmed = normalizeSearch(value);
  return trimmed ? new RegExp(escapeRegex(trimmed), flags) : null;
};

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  escapeRegex,
  parsePagination,
  normalizeSort,
  normalizeSearch,
  regexFromSearch,
};
