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

// 각 월의 값은 { robotId: [name1, name2, ...] } 형식. 이름은 빈 문자열일 수 있음.
// 옛 형식 { robotId: count } 는 빈 이름 배열로 변환.
function migrateMonth(monthObj) {
  const out = {};
  let migrated = false;
  for (const [k, v] of Object.entries(monthObj)) {
    const newKey = LEGACY_ID_MAP[k] || k;
    if (newKey !== k) migrated = true;
    let arr;
    if (typeof v === 'number') {
      arr = new Array(v).fill('');
      migrated = true;
    } else if (Array.isArray(v)) {
      arr = v.map(x => (typeof x === 'string' ? x : ''));
    } else {
      arr = [];
    }
    out[newKey] = (out[newKey] || []).concat(arr);
  }
  return { obj: out, migrated };
}

// ---------- 공유 저장소 (JSONBin) ----------
// 여러 사람이 같은 데이터를 보려면 아래 두 값을 채우세요.
// 비워두면 기존처럼 이 브라우저에만 저장됩니다(localStorage).
const CONFIG = {
  BIN_ID: '6a18154921f9ee59d294c3c9',                              // JSONBin Bin ID
  ACCESS_KEY: '$2a$10$/FHunFgrsW4KmTDQTgwwoux8C2p.JEe.Q/VFoMI8Gp/4rHCwghbnO', // Access Key (Read + Update)
};

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

function useRemote() { return !!(CONFIG.BIN_ID && CONFIG.ACCESS_KEY); }

// 전체 연도 데이터를 메모리에 캐시: { "2026": { 1:{...}, ... }, ... }
let allData = {};
let editing = false; // 이름 편집 중에는 원격 새로고침을 건너뜀

function migrateParsedYear(parsed) {
  const out = emptyYear();
  if (!parsed || typeof parsed !== 'object') return out;
  for (let m = 1; m <= 12; m++) {
    if (parsed[m] && typeof parsed[m] === 'object') {
      out[m] = migrateMonth(parsed[m]).obj;
    }
  }
  if (typeof parsed.goal === 'number' && parsed.goal > 0) {
    out.goal = Math.floor(parsed.goal);
  }
  return out;
}

function getYearData(year) {
  if (useRemote()) return migrateParsedYear(allData[year]);
  const raw = localStorage.getItem(storageKey(year));
  if (!raw) return emptyYear();
  try { return migrateParsedYear(JSON.parse(raw)); }
  catch { return emptyYear(); }
}

function saveYear() {
  if (useRemote()) {
    allData[state.year] = state.data;
    queueRemoteSave();
  } else {
    localStorage.setItem(storageKey(state.year), JSON.stringify(state.data));
  }
}

async function remoteFetchAll() {
  const res = await fetch(`${JSONBIN_BASE}/${CONFIG.BIN_ID}/latest`, {
    headers: { 'X-Access-Key': CONFIG.ACCESS_KEY },
  });
  if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`);
  const json = await res.json();
  return (json && json.record) || {};
}

async function remotePutAll(obj) {
  const res = await fetch(`${JSONBIN_BASE}/${CONFIG.BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Key': CONFIG.ACCESS_KEY,
    },
    body: JSON.stringify(obj),
  });
  if (!res.ok) throw new Error(`저장 실패 (${res.status})`);
}

// 저장 디바운스 + 직렬화: 연속 동작을 묶어 요청 수를 줄이고 마지막 값을 보장.
let saveTimer = null;
let saveInFlight = false;
let savePending = false;

function queueRemoteSave() {
  savePending = true;
  setSyncStatus('saving');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushRemoteSave, 500);
}

async function flushRemoteSave() {
  if (saveInFlight || !savePending) return;
  saveInFlight = true;
  savePending = false;
  try {
    await remotePutAll(allData);
  } catch {
    savePending = true; // 실패하면 다시 시도
  } finally {
    saveInFlight = false;
    if (savePending) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flushRemoteSave, 1500);
      setSyncStatus('error');
    } else {
      setSyncStatus('saved');
    }
  }
}

// 다른 사람이 바꾼 내용을 다시 불러오기 (탭 포커스 / 새로고침 버튼)
async function refreshFromRemote() {
  if (!useRemote()) return;
  if (editing || saveInFlight || savePending) return; // 편집/미저장 중엔 건너뜀
  setSyncStatus('syncing');
  try {
    allData = await remoteFetchAll();
    state.data = getYearData(state.year);
    render();
    setSyncStatus('saved');
  } catch {
    setSyncStatus('error');
  }
}

function setSyncStatus(kind) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  if (!useRemote()) { el.textContent = '이 브라우저에만 저장됨'; el.className = 'sync-status local'; return; }
  const map = {
    saving:  ['저장 중…',   'busy'],
    saved:   ['동기화됨',    'ok'],
    syncing: ['불러오는 중…', 'busy'],
    error:   ['연결 오류',   'err'],
  };
  const [text, cls] = map[kind] || ['', ''];
  el.textContent = text;
  el.className = `sync-status ${cls}`;
}

function getInstances(month, modelId) {
  const v = state.data[month]?.[modelId];
  return Array.isArray(v) ? v : [];
}

function getCount(month, modelId) {
  return getInstances(month, modelId).length;
}

function setInstances(month, modelId, arr) {
  if (!state.data[month]) state.data[month] = {};
  if (arr.length === 0) delete state.data[month][modelId];
  else state.data[month][modelId] = arr;
}

function addInstance(month, modelId, name = '') {
  const arr = getInstances(month, modelId).slice();
  arr.push(name);
  setInstances(month, modelId, arr);
}

function removeInstanceAt(month, modelId, index) {
  const arr = getInstances(month, modelId).slice();
  if (index < 0 || index >= arr.length) return '';
  const [removed] = arr.splice(index, 1);
  setInstances(month, modelId, arr);
  return removed;
}

function setInstanceName(month, modelId, index, name) {
  const arr = getInstances(month, modelId).slice();
  if (index < 0 || index >= arr.length) return;
  arr[index] = name;
  setInstances(month, modelId, arr);
}

// ---------- 렌더링 ----------

function render() {
  renderColumns();
  renderSummary();
}

function renderColumns() {
  const grid = document.getElementById('months-grid');
  grid.innerHTML = '';

  const today = new Date();
  const currentMonth = today.getFullYear() === state.year ? today.getMonth() + 1 : 0;

  for (let m = 1; m <= 12; m++) {
    const col = document.createElement('div');
    col.className = 'month-column';

    const dropzone = document.createElement('div');
    dropzone.className = 'dropzone' + (m === currentMonth ? ' current-month' : '');
    dropzone.dataset.month = String(m);
    dropzone.addEventListener('dragover', onDragOver);
    dropzone.addEventListener('dragleave', onDragLeave);
    dropzone.addEventListener('drop', onDropMonth);

    let total = 0;
    let priceTotal = 0;
    for (const robot of ROBOTS) {
      const names = getInstances(m, robot.id);
      total += names.length;
      priceTotal += names.length * robot.price;
      for (let i = 0; i < names.length; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'instance';

        const icon = document.createElement('img');
        icon.src = robot.icon;
        icon.alt = robot.name;
        icon.className = 'robot-icon';
        icon.draggable = true;
        icon.dataset.action = 'move';
        icon.dataset.model = robot.id;
        icon.dataset.fromMonth = String(m);
        icon.dataset.instanceIndex = String(i);
        icon.addEventListener('dragstart', onDragStart);
        icon.addEventListener('dragend', onDragEnd);
        icon.addEventListener('dblclick', onIconDoubleClick);

        const nameEl = document.createElement('div');
        nameEl.className = 'instance-name';
        nameEl.textContent = names[i] || '';
        nameEl.dataset.month = String(m);
        nameEl.dataset.model = robot.id;
        nameEl.dataset.instanceIndex = String(i);

        wrapper.appendChild(icon);
        wrapper.appendChild(nameEl);
        dropzone.appendChild(wrapper);
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
  const totalPriceEl = document.getElementById('summary-total-price');
  const totals = {};
  let grand = 0;
  let grandPrice = 0;
  for (const r of ROBOTS) totals[r.id] = 0;
  for (let m = 1; m <= 12; m++) {
    for (const r of ROBOTS) {
      const c = getCount(m, r.id);
      totals[r.id] += c;
      grand += c;
      grandPrice += c * r.price;
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
  totalPriceEl.textContent = `총 판매 금액: ${grandPrice.toLocaleString('ko-KR')}원`;
  renderGoalProgress(grand);
}

function renderGoalProgress(current) {
  const input = document.getElementById('goal-input');
  const fill = document.getElementById('goal-progress-fill');
  const text = document.getElementById('goal-progress-text');
  if (!input || !fill || !text) return;

  const goal = Math.max(0, Math.floor(Number(state.data.goal) || 0));
  if (document.activeElement !== input) {
    input.value = goal > 0 ? String(goal) : '';
  }
  if (goal > 0) {
    const pct = Math.max(0, Math.min(1, current / goal)) * 100;
    fill.style.width = pct + '%';
    text.textContent = `${current} / ${goal}대 (${Math.round(pct)}%)`;
  } else {
    fill.style.width = '0%';
    text.textContent = `현재 ${current}대`;
  }
}

// ---------- 드래그 앤 드롭 ----------

function onDragStart(e) {
  const el = e.currentTarget;
  const payload = {
    action: el.dataset.action,
    model: el.dataset.model,
    fromMonth: el.dataset.fromMonth ? parseInt(el.dataset.fromMonth, 10) : null,
    instanceIndex: el.dataset.instanceIndex != null ? parseInt(el.dataset.instanceIndex, 10) : null,
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
    addInstance(targetMonth, payload.model, '');
  } else if (payload.action === 'move') {
    if (payload.fromMonth === targetMonth) return;
    const name = removeInstanceAt(payload.fromMonth, payload.model, payload.instanceIndex);
    addInstance(targetMonth, payload.model, name);
  }
  saveYear();
  render();
}

function onDropPalette(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const payload = readPayload(e);
  if (!payload || payload.action !== 'move') return;
  removeInstanceAt(payload.fromMonth, payload.model, payload.instanceIndex);
  saveYear();
  render();
}

function onIconDoubleClick(e) {
  const icon = e.currentTarget;
  const wrapper = icon.parentElement;
  const nameEl = wrapper.querySelector('.instance-name');
  if (!nameEl) return;
  startEditName(nameEl);
}

function startEditName(nameEl) {
  const month = parseInt(nameEl.dataset.month, 10);
  const model = nameEl.dataset.model;
  const index = parseInt(nameEl.dataset.instanceIndex, 10);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'instance-name-input';
  input.value = nameEl.textContent;
  input.maxLength = 30;

  editing = true;
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    editing = false;
    setInstanceName(month, model, index, input.value.trim());
    saveYear();
    render();
  };
  const cancel = () => {
    if (done) return;
    done = true;
    editing = false;
    render();
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      input.blur();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      input.removeEventListener('blur', commit);
      cancel();
    }
  });

  nameEl.replaceWith(input);
  input.focus();
  input.select();
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
    state.data = getYearData(state.year);
    render();
  });
}

function setupRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;
  btn.addEventListener('click', refreshFromRemote);
}

function setupGoalInput() {
  const input = document.getElementById('goal-input');
  if (!input) return;
  input.addEventListener('input', () => {
    const n = parseInt(input.value, 10);
    state.data.goal = Number.isFinite(n) && n > 0 ? n : 0;
    saveYear();
    renderSummary();
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

async function init() {
  setupYearSelector();
  setupPalette();
  setupResetButton();
  setupRefreshButton();
  setupGoalInput();

  if (useRemote()) {
    setSyncStatus('syncing');
    try { allData = await remoteFetchAll(); }
    catch { setSyncStatus('error'); }
  }
  state.data = getYearData(state.year);
  render();
  if (useRemote()) setSyncStatus('saved');
  else setSyncStatus('local');

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshFromRemote();
  });
  window.addEventListener('focus', refreshFromRemote);
}

init();
