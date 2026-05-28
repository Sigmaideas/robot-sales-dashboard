// 새 로봇 모델을 추가하려면 이 배열에 항목을 더하세요.
// id 는 영문 키, name 은 화면에 표시될 이름, icon 은 아이콘 경로, color 는 요약/포인트 색.
const ROBOTS = [
  { id: 'storagy',    name: '스토리지',     icon: 'icons/storagy.png',    color: '#10b981', price:  30_000_000 },
  { id: 'deux',       name: '듀스',         icon: 'icons/deux.png',       color: '#f97316', price:  60_000_000 },
  { id: 'barisbrew',  name: '바리스브루',   icon: 'icons/barisbrew.png',  color: '#3b82f6', price: 110_000_000 },
  { id: 'barisbrewX', name: '바리스브루X',  icon: 'icons/barisbrewX.png', color: '#a855f7', price:  75_000_000 },
];

function formatPrice(won) {
  if (won <= 0) return '';
  const eok = won / 100_000_000;
  if (eok >= 1) {
    const rounded = Math.round(eok * 10) / 10;
    return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1)}억`;
  }
  const cheonman = won / 10_000_000;
  const r = Math.round(cheonman * 10) / 10;
  return `${r % 1 === 0 ? r : r.toFixed(1)}천`;
}

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const state = {
  year: clampYear(new Date().getFullYear()),
  data: emptyYear(), // { 1: { baris: 3, ... }, 2: {...}, ... 12: {...} }
};

function clampYear(y) {
  if (YEARS.includes(y)) return y;
  return 2026;
}

function storageKey(year) { return `salesData.${year}`; }

function emptyYear() {
  const obj = {};
  for (let m = 1; m <= 12; m++) obj[m] = {};
  return obj;
}

// 이전 버전(varis / storage / deuce / baris) 데이터가 있으면 새 ID 로 변환.
const LEGACY_ID_MAP = { varis: 'barisbrew', baris: 'barisbrew', storage: 'storagy', deuce: 'deux' };

function migrateMonth(monthObj) {
  const out = {};
  let migrated = false;
  for (const [k, v] of Object.entries(monthObj)) {
    const newKey = LEGACY_ID_MAP[k] || k;
    if (newKey !== k) migrated = true;
    out[newKey] = (out[newKey] || 0) + v;
  }
  return { obj: out, migrated };
}

function loadYear(year) {
  const raw = localStorage.getItem(storageKey(year));
  if (!raw) return emptyYear();
  try {
    const parsed = JSON.parse(raw);
    const out = emptyYear();
    let anyMigrated = false;
    for (let m = 1; m <= 12; m++) {
      if (parsed[m] && typeof parsed[m] === 'object') {
        const { obj, migrated } = migrateMonth(parsed[m]);
        out[m] = obj;
        if (migrated) anyMigrated = true;
      }
    }
    if (anyMigrated) {
      localStorage.setItem(storageKey(year), JSON.stringify(out));
    }
    return out;
  } catch {
    return emptyYear();
  }
}

function saveYear() {
  localStorage.setItem(storageKey(state.year), JSON.stringify(state.data));
}

function ensureSampleData() {
  if (localStorage.getItem(storageKey(2026))) return;
  const sample = emptyYear();
  sample[1] = { barisbrew: 3, storagy: 2, deux: 1 };
  sample[2] = { barisbrew: 5, storagy: 1, deux: 2, barisbrewX: 1 };
  sample[3] = { barisbrew: 2, storagy: 4 };
  sample[4] = { barisbrew: 6, storagy: 3, deux: 2, barisbrewX: 2 };
  localStorage.setItem(storageKey(2026), JSON.stringify(sample));
}

function getCount(month, modelId) {
  return state.data[month]?.[modelId] || 0;
}

function setCount(month, modelId, count) {
  if (!state.data[month]) state.data[month] = {};
  if (count <= 0) delete state.data[month][modelId];
  else state.data[month][modelId] = count;
}

function addOne(month, modelId) {
  setCount(month, modelId, getCount(month, modelId) + 1);
}

function removeOne(month, modelId) {
  const next = getCount(month, modelId) - 1;
  setCount(month, modelId, next < 0 ? 0 : next);
}

// ---------- 렌더링 ----------

function render() {
  renderColumns();
  renderSummary();
}

function renderColumns() {
  const grid = document.getElementById('months-grid');
  grid.innerHTML = '';

  for (let m = 1; m <= 12; m++) {
    const col = document.createElement('div');
    col.className = 'month-column';

    const dropzone = document.createElement('div');
    dropzone.className = 'dropzone';
    dropzone.dataset.month = String(m);
    dropzone.addEventListener('dragover', onDragOver);
    dropzone.addEventListener('dragleave', onDragLeave);
    dropzone.addEventListener('drop', onDropMonth);

    let total = 0;
    let priceTotal = 0;
    for (const robot of ROBOTS) {
      const count = getCount(m, robot.id);
      total += count;
      priceTotal += count * robot.price;
      for (let i = 0; i < count; i++) {
        const icon = document.createElement('img');
        icon.src = robot.icon;
        icon.alt = robot.name;
        icon.className = 'robot-icon';
        icon.draggable = true;
        icon.dataset.action = 'move';
        icon.dataset.model = robot.id;
        icon.dataset.fromMonth = String(m);
        icon.addEventListener('dragstart', onDragStart);
        icon.addEventListener('dragend', onDragEnd);
        dropzone.appendChild(icon);
      }
    }

    if (priceTotal > 0) {
      const priceEl = document.createElement('div');
      priceEl.className = 'month-price';
      priceEl.textContent = formatPrice(priceTotal);
      dropzone.appendChild(priceEl);
    }

    const label = document.createElement('div');
    label.className = 'month-label';
    label.innerHTML = `${m}월 <span class="count">(${total}대)</span>`;

    col.appendChild(dropzone);
    col.appendChild(label);
    grid.appendChild(col);
  }
}

function renderSummary() {
  const breakdownEl = document.getElementById('summary-breakdown');
  const totalEl = document.getElementById('summary-total');
  const totals = {};
  let grand = 0;
  for (const r of ROBOTS) totals[r.id] = 0;
  for (let m = 1; m <= 12; m++) {
    for (const r of ROBOTS) {
      const c = getCount(m, r.id);
      totals[r.id] += c;
      grand += c;
    }
  }
  breakdownEl.innerHTML = ROBOTS.map(r =>
    `<span class="pill">
       <span class="swatch" style="background:${r.color}"></span>
       <span class="name">${r.name}</span>
       <span class="value">${totals[r.id]}대</span>
     </span>`
  ).join('');
  totalEl.textContent = `총 판매 대수: ${grand}대`;
}

// ---------- 드래그 앤 드롭 ----------

function onDragStart(e) {
  const el = e.currentTarget;
  const payload = {
    action: el.dataset.action,
    model: el.dataset.model,
    fromMonth: el.dataset.fromMonth ? parseInt(el.dataset.fromMonth, 10) : null,
  };
  e.dataTransfer.setData('text/plain', JSON.stringify(payload));
  e.dataTransfer.effectAllowed = payload.action === 'add' ? 'copy' : 'move';
  el.classList.add('dragging');
}

function onDragEnd() {
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function readPayload(e) {
  try { return JSON.parse(e.dataTransfer.getData('text/plain')); }
  catch { return null; }
}

function onDropMonth(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const payload = readPayload(e);
  if (!payload) return;
  const targetMonth = parseInt(e.currentTarget.dataset.month, 10);

  if (payload.action === 'add') {
    addOne(targetMonth, payload.model);
  } else if (payload.action === 'move') {
    if (payload.fromMonth === targetMonth) return;
    removeOne(payload.fromMonth, payload.model);
    addOne(targetMonth, payload.model);
  }
  saveYear();
  render();
}

function onDropPalette(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const payload = readPayload(e);
  if (!payload || payload.action !== 'move') return;
  removeOne(payload.fromMonth, payload.model);
  saveYear();
  render();
}

// ---------- 초기화 / 셋업 ----------

function setupPalette() {
  const list = document.getElementById('palette-list');
  list.innerHTML = '';
  for (const robot of ROBOTS) {
    const item = document.createElement('div');
    item.className = 'palette-item';

    const img = document.createElement('img');
    img.src = robot.icon;
    img.alt = robot.name;
    img.className = 'palette-icon';
    img.draggable = true;
    img.dataset.action = 'add';
    img.dataset.model = robot.id;
    img.addEventListener('dragstart', onDragStart);
    img.addEventListener('dragend', onDragEnd);

    const label = document.createElement('div');
    label.className = 'palette-label';
    label.textContent = robot.name;

    item.appendChild(img);
    item.appendChild(label);
    list.appendChild(item);
  }

  const palette = document.getElementById('palette');
  palette.addEventListener('dragover', onDragOver);
  palette.addEventListener('dragleave', onDragLeave);
  palette.addEventListener('drop', onDropPalette);
}

function setupYearSelector() {
  const sel = document.getElementById('year-select');
  sel.innerHTML = '';
  for (const y of YEARS) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = `${y}년`;
    if (y === state.year) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    state.year = parseInt(sel.value, 10);
    state.data = loadYear(state.year);
    render();
  });
}

function setupResetButton() {
  const overlay = document.getElementById('modal-overlay');
  const yearText = document.getElementById('modal-year-text');

  document.getElementById('reset-btn').addEventListener('click', () => {
    yearText.textContent = `${state.year}년`;
    overlay.classList.add('visible');
  });
  document.getElementById('modal-cancel').addEventListener('click', () => {
    overlay.classList.remove('visible');
  });
  document.getElementById('modal-confirm').addEventListener('click', () => {
    state.data = emptyYear();
    saveYear();
    render();
    overlay.classList.remove('visible');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('visible');
  });
}

function init() {
  ensureSampleData();
  state.data = loadYear(state.year);
  setupYearSelector();
  setupPalette();
  setupResetButton();
  render();
}

init();
