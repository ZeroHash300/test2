export const RANKS = [
  { id: 'praefect', name: 'Praefect of Aldervane', short: 'Praefect', min: 7500, max: Infinity, color: '#e8b84a' },
  { id: 'sentinel', name: 'Sentinel of Aldervane', short: 'Sentinel', min: 3250, max: 7499, color: '#6fb1ff' },
  { id: 'knight', name: 'Knight of Aldervane', short: 'Knight', min: 200, max: 3249, color: '#9ad08a' },
];
export const TOP_N = 10;

export const fmt = new Intl.NumberFormat('id-ID');

export function getRank(score) {
  return RANKS.find((r) => score >= r.min && score <= r.max) || null;
}

export function rangeLabel(r) {
  return r.max === Infinity ? `${fmt.format(r.min)}+` : `${fmt.format(r.min)} – ${fmt.format(r.max)}`;
}

export function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Parser CSV sederhana (mendukung tanda kutip)
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}
