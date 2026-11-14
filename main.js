import './style.css';
import { supabase, configured } from './supabase.js';
import { RANKS, TOP_N, fmt, rangeLabel, el } from './shared.js';

const $ = (sel) => document.querySelector(sel);
const REFRESH_MS = 60_000;

let board = Object.fromEntries(RANKS.map((r) => [r.id, []]));
let activeTab = RANKS[0].id;

// ===== Tabs & papan =====
function renderTabs() {
  const nav = $('#tabs');
  nav.replaceChildren();
  for (const r of RANKS) {
    const btn = el('button', 'tab' + (r.id === activeTab ? ' active' : ''), r.short);
    btn.type = 'button';
    btn.role = 'tab';
    btn.style.setProperty('--c', r.color);
    btn.addEventListener('click', () => {
      activeTab = r.id;
      renderTabs();
      renderBoard();
    });
    nav.append(btn);
  }
}

function renderBoard() {
  const r = RANKS.find((x) => x.id === activeTab);
  const list = board[r.id];
  const total = list[0]?.total ?? 0;

  const info = $('#tab-info');
  info.replaceChildren();
  const title = el('h2', '', r.name);
  title.style.color = r.color;
  info.append(title, el('span', 'range', `Poin ${rangeLabel(r)} • Top ${TOP_N} dari ${fmt.format(total)} pemain`));

  const ol = $('#board');
  ol.replaceChildren();
  if (list.length === 0) {
    ol.append(el('li', 'empty', 'Belum ada pemain di rank ini.'));
    return;
  }
  for (const p of list) {
    const li = el('li', 'row');
    li.append(
      el('span', 'pos' + (p.pos <= 3 ? ` top${p.pos}` : ''), String(p.pos)),
      el('span', 'name', p.name),
      el('span', 'score', fmt.format(p.score)),
    );
    ol.append(li);
  }
}

async function loadBoard() {
  const { data, error } = await supabase.rpc('get_leaderboard');
  if (error) {
    console.error(error);
    if (!$('#board').children.length) $('#board').replaceChildren(el('li', 'empty', 'Gagal memuat data leaderboard.'));
    return;
  }
  board = Object.fromEntries(RANKS.map((r) => [r.id, []]));
  for (const row of data) board[row.rank_id]?.push(row);
  renderBoard();
  $('#updated').textContent = `Diperbarui ${new Date().toLocaleTimeString('id-ID', { timeStyle: 'short' })} • otomatis tiap menit`;
}

// ===== Pencarian UID =====
async function search(query) {
  const box = $('#search-result');
  box.replaceChildren();
  const q = query.trim();
  if (!q) return;

  const { data, error } = await supabase.rpc('lookup_player', { p_uid: q });
  if (error) {
    console.error(error);
    box.append(el('p', 'notfound', 'Terjadi kesalahan, coba lagi nanti.'));
    return;
  }
  const p = data?.[0];
  if (!p) {
    box.append(el('p', 'notfound', `UID "${q}" tidak ditemukan.`));
    return;
  }

  const r = RANKS.find((x) => x.id === p.rank_id) || null;
  const card = el('div', 'result');
  card.append(el('div', 'result-name', p.name));

  if (!r) {
    card.append(el('div', 'result-rank', 'Belum memiliki rank'));
    const need = RANKS[RANKS.length - 1].min;
    card.append(el('div', 'result-detail', `Poin kamu ${fmt.format(p.score)}. Butuh minimal ${fmt.format(need)} poin untuk menjadi ${RANKS[RANKS.length - 1].name}.`));
    box.append(card);
    return;
  }

  const rankEl = el('div', 'result-rank', r.name);
  rankEl.style.color = r.color;
  card.append(rankEl);
  card.append(el('div', 'result-detail', `Poin: ${fmt.format(p.score)} • Posisi #${p.pos} dari ${fmt.format(p.total)} di rank ini`));

  const next = RANKS[RANKS.indexOf(r) - 1];
  card.append(
    el('div', 'result-detail', next ? `${fmt.format(next.min - p.score)} poin lagi menuju ${next.name}` : 'Kamu sudah berada di rank tertinggi. 👑'),
  );

  const jump = el('button', 'link', `Lihat tab ${r.short}`);
  jump.type = 'button';
  jump.addEventListener('click', () => {
    activeTab = r.id;
    renderTabs();
    renderBoard();
    window.scrollTo({ top: $('#tabs').offsetTop - 20, behavior: 'smooth' });
  });
  card.append(jump);
  box.append(card);
}

// ===== Init =====
renderTabs();
renderBoard();

$('#search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  search($('#uid-input').value);
});

if (!configured) {
  $('#board').replaceChildren(el('li', 'empty', 'Database belum dikonfigurasi (lihat README).'));
} else {
  loadBoard();
  setInterval(loadBoard, REFRESH_MS);
}
