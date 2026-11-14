import '../style.css';
import './admin.css';
import { supabase, configured } from '../supabase.js';
import { RANKS, fmt, getRank, el, parseCSV } from '../shared.js';

const $ = (s) => document.querySelector(s);
const MAX_ROWS = 100;

let players = [];
let rankFilter = 'all';
let searchText = '';
let editing = null; // uid yang sedang diedit; null = tambah baru

// ===== Util =====
let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 3500);
}

function rankBadge(score) {
  const r = getRank(score);
  const b = el('span', 'badge', r ? r.short : 'Tanpa rank');
  if (r) b.style.color = r.color;
  return b;
}

// ===== Data =====
async function fetchPlayers() {
  const all = [];
  const size = 1000; // batas default Supabase per request
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from('players')
      .select('uid,name,score,updated_at')
      .order('uid')
      .range(from, from + size - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < size) break;
  }
  return all;
}

async function refreshAll() {
  try {
    players = await fetchPlayers();
  } catch (err) {
    console.error(err);
    toast('Gagal memuat data: ' + err.message, true);
    return;
  }
  renderStats();
  renderTable();
  loadLog();
}

// ===== Render =====
function renderStats() {
  const box = $('#stats');
  box.replaceChildren();
  const add = (label, value, color) => {
    const c = el('div', 'stat');
    const v = el('div', 'stat-value', fmt.format(value));
    if (color) v.style.color = color;
    c.append(v, el('div', 'stat-label', label));
    box.append(c);
  };
  add('Total pemain', players.length);
  for (const r of RANKS) add(r.short, players.filter((p) => getRank(p.score)?.id === r.id).length, r.color);
  add('Tanpa rank', players.filter((p) => !getRank(p.score)).length);
}

function renderTable() {
  const q = searchText.trim().toLowerCase();
  let rows = players
    .filter((p) => {
      if (q && !(p.uid.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))) return false;
      const r = getRank(p.score);
      if (rankFilter === 'none') return !r;
      if (rankFilter !== 'all') return r?.id === rankFilter;
      return true;
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const total = rows.length;
  rows = rows.slice(0, MAX_ROWS);

  const body = $('#players-body');
  body.replaceChildren();
  if (!rows.length) {
    const tr = el('tr');
    const td = el('td', 'empty', 'Tidak ada pemain.');
    td.colSpan = 5;
    tr.append(td);
    body.append(tr);
  }
  for (const p of rows) {
    const tr = el('tr');
    const tdRank = el('td');
    tdRank.append(rankBadge(p.score));

    const tdAct = el('td', 'actions');
    const edit = el('button', 'btn small', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', () => openDialog(p));
    const del = el('button', 'btn small danger', 'Hapus');
    del.type = 'button';
    del.addEventListener('click', () => removePlayer(p));
    tdAct.append(edit, del);

    tr.append(tdRank, el('td', 'mono', p.uid), el('td', '', p.name), el('td', 'num', fmt.format(p.score)), tdAct);
    body.append(tr);
  }
  $('#table-note').textContent =
    total > MAX_ROWS
      ? `Menampilkan ${MAX_ROWS} dari ${fmt.format(total)} pemain. Gunakan pencarian untuk mempersempit.`
      : `${fmt.format(total)} pemain`;
}

async function loadLog() {
  const { data, error } = await supabase.from('score_log').select('*').order('id', { ascending: false }).limit(30);
  const box = $('#log');
  box.replaceChildren();
  if (error || !data.length) {
    box.append(el('li', 'empty', error ? 'Gagal memuat riwayat.' : 'Belum ada riwayat.'));
    return;
  }
  const labels = { create: 'Ditambahkan', update: 'Diubah', delete: 'Dihapus' };
  for (const l of data) {
    const when = new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    const change =
      l.action === 'create' ? `→ ${fmt.format(l.new_score)}`
      : l.action === 'delete' ? `(${fmt.format(l.old_score)})`
      : `${fmt.format(l.old_score)} → ${fmt.format(l.new_score)}`;
    const li = el('li', 'log-row');
    li.append(el('span', 'log-time', when), el('span', 'log-text', `${labels[l.action]}: ${l.name} (${l.uid}) ${change}`));
    box.append(li);
  }
}

// ===== Tambah / edit / hapus =====
function openDialog(p) {
  editing = p ? p.uid : null;
  $('#dialog-title').textContent = p ? 'Edit pemain' : 'Tambah pemain';
  $('#f-uid').value = p?.uid ?? '';
  $('#f-uid').readOnly = Boolean(p);
  $('#f-name').value = p?.name ?? '';
  $('#f-score').value = p?.score ?? 0;
  $('#edit-dialog').showModal();
}

$('#edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const uid = $('#f-uid').value.trim();
  const name = $('#f-name').value.trim();
  const score = parseInt($('#f-score').value, 10);
  if (!uid || !name || !Number.isInteger(score) || score < 0) return toast('Data tidak valid.', true);

  const req =
    editing === null
      ? supabase.from('players').insert({ uid, name, score })
      : supabase.from('players').update({ name, score }).eq('uid', editing);
  const { error } = await req;
  if (error) return toast(error.code === '23505' ? 'UID sudah dipakai.' : error.message, true);

  $('#edit-dialog').close();
  toast('Tersimpan.');
  await refreshAll();
});

$('#cancel-btn').addEventListener('click', () => $('#edit-dialog').close());
$('#add-btn').addEventListener('click', () => openDialog(null));

async function removePlayer(p) {
  if (!confirm(`Hapus ${p.name} (${p.uid})? Tindakan ini tidak bisa dibatalkan.`)) return;
  const { error } = await supabase.from('players').delete().eq('uid', p.uid);
  if (error) return toast(error.message, true);
  toast('Pemain dihapus.');
  await refreshAll();
}

// ===== Tambah/kurangi poin cepat =====
$('#adjust-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const uid = $('#a-uid').value.trim();
  const delta = parseInt($('#a-delta').value, 10);
  if (!uid || !Number.isInteger(delta)) return toast('Isi UID dan jumlah poin (boleh negatif).', true);

  const { data, error } = await supabase.rpc('adjust_score', { p_uid: uid, p_delta: delta });
  if (error) return toast(error.message, true);
  if (data === null) return toast('UID tidak ditemukan.', true);

  toast(`Poin sekarang ${fmt.format(data)}.`);
  e.target.reset();
  await refreshAll();
});

// ===== Impor CSV =====
function parseImport(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  let idx = { uid: 0, name: 1, score: 2 };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  if (head.includes('uid')) {
    idx = { uid: head.indexOf('uid'), name: head.indexOf('name'), score: head.indexOf('score') };
    if (Object.values(idx).some((i) => i < 0)) throw new Error('Header harus berisi uid, name, score.');
    rows.shift();
  }
  const unique = new Map();
  for (const r of rows) {
    const uid = (r[idx.uid] || '').trim();
    const name = (r[idx.name] || '').trim();
    const raw = String(r[idx.score] ?? '').replace(/[^\d-]/g, '');
    const score = Number(raw);
    if (!uid || !name || raw === '' || !Number.isFinite(score) || score < 0) continue;
    unique.set(uid, { uid, name, score });
  }
  return [...unique.values()];
}

$('#import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (f) $('#import-text').value = await f.text();
});

$('#import-btn').addEventListener('click', async () => {
  let rows;
  try {
    rows = parseImport($('#import-text').value);
  } catch (err) {
    return toast(err.message, true);
  }
  if (!rows.length) return toast('Tidak ada baris valid untuk diimpor.', true);
  if (!confirm(`Impor ${fmt.format(rows.length)} pemain? UID yang sudah ada akan ditimpa.`)) return;

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('players').upsert(rows.slice(i, i + 500), { onConflict: 'uid' });
    if (error) return toast(error.message, true);
  }
  $('#import-text').value = '';
  $('#import-file').value = '';
  toast(`${fmt.format(rows.length)} pemain diimpor.`);
  await refreshAll();
});

// ===== Filter & pencarian =====
const filter = $('#rank-filter');
for (const [value, label] of [['all', 'Semua rank'], ...RANKS.map((r) => [r.id, r.short]), ['none', 'Tanpa rank']]) {
  const o = el('option', '', label);
  o.value = value;
  filter.append(o);
}
filter.addEventListener('change', () => { rankFilter = filter.value; renderTable(); });
$('#search').addEventListener('input', (e) => { searchText = e.target.value; renderTable(); });
$('#refresh').addEventListener('click', refreshAll);

// ===== Login / logout =====
function showLogin(message = '') {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-error').textContent = message;
}

async function enter(user) {
  const { data: ok, error } = await supabase.rpc('is_admin');
  if (error || !ok) {
    await supabase.auth.signOut();
    return showLogin('Akun ini bukan admin.');
  }
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#who').textContent = user.email;
  await refreshAll();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $('#l-email').value.trim(),
    password: $('#l-pass').value,
  });
  if (error) return showLogin('Email atau password salah.');
  $('#l-pass').value = '';
  await enter(data.user);
});

$('#logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  players = [];
  showLogin();
});

(async function init() {
  if (!configured) return showLogin('Database belum dikonfigurasi. Lihat .env.example dan README.');
  const { data } = await supabase.auth.getSession();
  if (data.session) await enter(data.session.user);
})();
