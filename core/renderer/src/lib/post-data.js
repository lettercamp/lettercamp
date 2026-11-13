import { basePath, sitePath } from './urls.js';

export const postAsset = value => typeof value === 'string' && basePath && (value === basePath || value.startsWith(basePath + '/')) ? value : sitePath(value);

export function postDate(value, language = 'en', timeZone = 'UTC') {
  if (!value) return { iso: '', label: '', timestamp: -Infinity };
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.valueOf())) return { iso: '', label: '', timestamp: -Infinity };
  // A calendar date has no time zone; shifting midnight changes its intended day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  return {
    iso: dateOnly ? String(value) : date.toISOString(),
    label: new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', year: 'numeric', timeZone: dateOnly ? 'UTC' : timeZone }).format(date),
    timestamp: date.valueOf(),
  };
}

