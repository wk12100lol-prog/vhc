const API = 'https://vexcoin.xo.je/api';
const STORE = window.localStorage;
let token = STORE.getItem('vhc_token') || '';
let wallet = STORE.getItem('vhc_wallet') || '';
let loginName = STORE.getItem('vhc_login') || '';
let userBalance = '0';

// Mining state
let mining = false;
let miningHashCount = 0;
let miningStartTime = 0;
let miningBlocks = 0;
let miningWorkers = [];
let miningThreads = parseInt(STORE.getItem('vhc_threads')) || 4;
let miningJobData = null;
let miningJobId = 0;
let batterySave = true;
let batteryLow = false;

// Hashrate chart
let chartPoints = [];
let chartInterval = null;

// Pull to refresh
let pullStartY = 0;
let pulling = false;

// ====================== API ======================
async function apiCall(endpoint, data) {
  const url = API.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
      credentials: 'include',
      signal: AbortSignal.timeout(20000)
    });
    const text = await res.text().catch(() => '');
    if (!res.ok || text.includes('<html') || text.includes('aes.js')) {
      if (text.includes('<html') || text.includes('aes.js')) {
        return { success: false, error: 'Blad serwera - odswiez apke (infinityfree challenge)' };
      }
      try { const j = JSON.parse(text); return { success: false, error: j.error || text }; }
      catch { return { success: false, error: text || 'HTTP ' + res.status }; }
    }
    try { return JSON.parse(text); }
    catch { return { success: false, error: 'Blad parsowania odpowiedzi' }; }
  } catch(e) {
    return { success: false, error: e.name === 'TimeoutError' ? 'Timeout' : 'Blad: ' + e.message };
  }
}

// ====================== Toast ======================
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
  updateMiningStats();
}

// ====================== Settings ======================
function loadSettings() {
  const s = STORE.getItem('vhc_settings');
  return s ? JSON.parse(s) : { autoMine: false, batterySave: true, vibrate: true, sound: true, pin: false };
}

function saveSettings() {
  const settings = {
    autoMine: document.getElementById('autoMineToggle').checked,
    batterySave: document.getElementById('batterySaveToggle').checked,
    vibrate: document.getElementById('vibrateToggle').checked,
    sound: document.getElementById('soundToggle').checked,
    pin: document.getElementById('pinToggle').checked
  };
  STORE.setItem('vhc_settings', JSON.stringify(settings));
  batterySave = settings.batterySave;
  if (settings.pin && !STORE.getItem('vhc_app_pin')) {
    const p = prompt('Ustaw PIN (4 cyfry):');
    if (p && /^\d{4}$/.test(p)) STORE.setItem('vhc_app_pin', p);
    else { settings.pin = false; document.getElementById('pinToggle').checked = false; }
  }
  if (!settings.pin) STORE.removeItem('vhc_app_pin');
}

function applySettings() {
  const settings = loadSettings();
  document.getElementById('autoMineToggle').checked = settings.autoMine;
  document.getElementById('batterySaveToggle').checked = settings.batterySave;
  document.getElementById('vibrateToggle').checked = settings.vibrate;
  document.getElementById('soundToggle').checked = settings.sound;
  document.getElementById('pinToggle').checked = settings.pin;
  batterySave = settings.batterySave;
}

// ====================== Battery ======================
async function initBattery() {
  try {
    const batt = await navigator.getBattery();
    const update = () => {
      batteryLow = batt.level < 0.2 && batt.level >= 0;
      document.getElementById('batteryMode').textContent = batteryLow ? '\u26A0 Oszczedzanie' : '\u26A1';
      if (batteryLow && mining && batterySave) {
        setThreads(Math.max(1, Math.floor(miningThreads / 2)));
      }
    };
    batt.addEventListener('levelchange', update);
    batt.addEventListener('chargingchange', update);
    update();
  } catch(e) { document.getElementById('batteryMode').textContent = '\u26A1 Pelna'; }
}

// ====================== Auth ======================
let isRegister = false;

function toggleAuthMode() {
  isRegister = !isRegister;
  document.getElementById('authTitle').textContent = isRegister ? 'Rejestracja' : 'Zaloguj sie';
  document.getElementById('authSub').textContent = isRegister ? 'Utworz konto VHC' : 'Wprowadz dane do panelu VHC';
  document.getElementById('authBtn').textContent = isRegister ? 'Zarejestruj sie' : 'Zaloguj sie';
  document.getElementById('authToggleText').textContent = isRegister ? 'Masz juz konto?' : 'Nie masz konta?';
  document.getElementById('authToggleLink').textContent = isRegister ? 'Zaloguj sie' : 'Zarejestruj sie';
  document.getElementById('emailGroup').style.display = isRegister ? '' : 'none';
  document.getElementById('confirmGroup').style.display = isRegister ? '' : 'none';
  hideAuthMsg();
}

function hideAuthMsg() {
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authSuccess').style.display = 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg; el.style.display = 'block';
}

function showAuthSuccess(msg) {
  const el = document.getElementById('authSuccess');
  el.textContent = msg; el.style.display = 'block';
}

async function handleAuth() {
  hideAuthMsg();
  const login = document.getElementById('authLogin').value.trim();
  const password = document.getElementById('authPassword').value;

  if (isRegister) {
    const email = document.getElementById('authEmail').value.trim();
    const confirm = document.getElementById('authConfirm').value;
    if (!login || !email || !password || !confirm) { showAuthError('Wypelnij wszystkie pola'); return; }
    if (password !== confirm) { showAuthError('Hasla nie sa zgodne'); return; }
    if (password.length < 6) { showAuthError('Haslo min. 6 znakow'); return; }

    document.getElementById('authBtn').disabled = true;
    document.getElementById('authBtn').textContent = 'Rejestracja...';
    const result = await apiCall('register.php', { login, email, password });
    document.getElementById('authBtn').disabled = false;
    document.getElementById('authBtn').textContent = 'Zarejestruj sie';

    if (result.success) {
      showAuthSuccess('Konto utworzone! Adres: ' + result.wallet + '. Za chwile zostaniesz przekierowany.');
      setTimeout(() => { isRegister = false; toggleAuthMode(); document.getElementById('authLogin').value = login; }, 2000);
    } else {
      showAuthError(result.error || 'Blad rejestracji');
    }
    return;
  }

  if (!login || !password) { showAuthError('Wypelnij wszystkie pola'); return; }

  document.getElementById('authBtn').disabled = true;
  document.getElementById('authBtn').textContent = 'Logowanie...';
  const result = await apiCall('login.php', { login, password });
  document.getElementById('authBtn').disabled = false;
  document.getElementById('authBtn').textContent = 'Zaloguj sie';

  if (result.success && result.user) {
    token = result.token;
    wallet = result.user.wallet || '';
    loginName = result.user.login || '';
    STORE.setItem('vhc_token', token);
    STORE.setItem('vhc_wallet', wallet);
    STORE.setItem('vhc_login', loginName);
    // Add to wallet list
    addWalletToStore(wallet, loginName);
    enterApp();
  } else {
    showAuthError(result.error || 'Blad logowania');
  }
}

function logout() {
  if (mining) stopMining();
  const settings = loadSettings();
  if (settings.autoMine) { settings.autoMine = false; STORE.setItem('vhc_settings', JSON.stringify(settings)); }
  token = ''; wallet = ''; loginName = '';
  STORE.removeItem('vhc_token'); STORE.removeItem('vhc_wallet'); STORE.removeItem('vhc_login');
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('authLogin').value = '';
  document.getElementById('authPassword').value = '';
}

function logoutFromPin() {
  STORE.removeItem('vhc_app_pin');
  document.getElementById('pinScreen').style.display = 'none';
  logout();
}

// ====================== PIN Lock ======================
function checkPinLock() {
  const settings = loadSettings();
  const pin = STORE.getItem('vhc_app_pin');
  if (settings.pin && pin) {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('pinScreen').style.display = 'flex';
  } else {
    if (token && wallet) enterApp();
  }
}

function unlockApp() {
  const input = document.getElementById('pinInput').value.trim();
  const stored = STORE.getItem('vhc_app_pin');
  if (input === stored) {
    document.getElementById('pinScreen').style.display = 'none';
    document.getElementById('pinError').style.display = 'none';
    document.getElementById('pinInput').value = '';
    enterApp();
  } else {
    document.getElementById('pinError').textContent = 'Zly PIN';
    document.getElementById('pinError').style.display = 'block';
    document.getElementById('pinInput').value = '';
  }
}

// ====================== Multi-wallet ======================
function loadWalletList() {
  const raw = STORE.getItem('vhc_wallet_list');
  return raw ? JSON.parse(raw) : [];
}

function saveWalletList(list) {
  STORE.setItem('vhc_wallet_list', JSON.stringify(list));
}

function addWalletToStore(addr, label) {
  const list = loadWalletList();
  if (!list.find(w => w.addr === addr)) {
    list.push({ addr, label: label || addr.substring(0, 10) + '...', added: Date.now() });
    saveWalletList(list);
  }
}

function importWallet() {
  const addr = document.getElementById('importWalletAddr').value.trim();
  if (!addr || addr.length < 10) { toast('Nieprawidlowy adres'); return; }
  addWalletToStore(addr, addr.substring(0, 10) + '...');
  document.getElementById('importWalletAddr').value = '';
  renderWalletList();
  toast('Portfel dodany');
}

function removeWallet(addr) {
  if (addr === wallet) { toast('Nie mozesz usunac aktywnego portfela'); return; }
  let list = loadWalletList();
  list = list.filter(w => w.addr !== addr);
  saveWalletList(list);
  renderWalletList();
}

function switchWallet(addr) {
  wallet = addr;
  token = '';
  STORE.setItem('vhc_wallet', addr);
  STORE.removeItem('vhc_token');
  loadDashboard();
  loadWalletHistory();
  renderWalletList();
  toast('Przelaczono na ' + addr.substring(0, 10) + '...');
}

async function renderWalletList() {
  const el = document.getElementById('walletList');
  const list = loadWalletList();
  if (!list.length) { el.innerHTML = '<div class="empty">Brak zapisanych portfeli</div>'; return; }
  el.innerHTML = '';
  for (const w of list) {
    const isCurrent = w.addr === wallet;
    const d = document.createElement('div');
    d.className = 'wallet-item' + (isCurrent ? ' current' : '');
    // Try to get balance
    let bal = '?';
    try {
      const res = await apiCall('user.php', { wallet: w.addr });
      if (res.success && res.user) bal = parseFloat(res.user.balance).toFixed(2);
    } catch(e) {}
    d.innerHTML = `
      <div>
        <div class="wallet-addr">${w.label}</div>
        <div class="wallet-info">${shorten(w.addr, 10)}</div>
        <div class="wallet-bal">${bal} VHC ${isCurrent ? '(aktualny)' : ''}</div>
      </div>
      <div style="display:flex;gap:6px;">
        ${isCurrent ? '' : '<span class="wallet-action" onclick="switchWallet(\'' + w.addr + '\')" style="color:var(--accent);">\u21AA</span>'}
        <span class="wallet-action" onclick="removeWallet(\'' + w.addr + '\')">\u2716</span>
      </div>
    `;
    el.appendChild(d);
  }
}

// ====================== Share ======================
function shareWallet() {
  if (navigator.share) {
    navigator.share({ title: 'VHC Wallet', text: 'Moje konto VHC: ' + wallet, url: 'https://vexcoin.xo.je' })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(wallet).then(() => toast('Skopiowano adres!')).catch(() => toast(wallet));
  }
}

// ====================== Enter App ======================
function enterApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.add('active');
  document.getElementById('settingsLogin').textContent = loginName;
  document.getElementById('settingsWallet').textContent = wallet;
  applySettings();
  renderWalletList();
  initBattery();
  loadDashboard();
  loadWalletHistory();

  const settings = loadSettings();
  if (settings.autoMine && !mining) startMining();
}

// ====================== Navigation ======================
document.querySelectorAll('.app-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.app-nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.page).classList.add('active');
    if (btn.dataset.page === 'pageSend') loadWalletHistory();
    if (btn.dataset.page === 'pageCards') showCards();
    if (btn.dataset.page === 'pageSettings') renderWalletList();
    if (btn.dataset.page === 'pageMining') updateChart();
    document.getElementById('appContent').scrollTop = 0;
  });
});

// ====================== Pull to Refresh ======================
const content = document.getElementById('appContent');
content.addEventListener('touchstart', e => {
  if (content.scrollTop <= 0) { pullStartY = e.touches[0].clientY; pulling = true; }
}, { passive: true });
content.addEventListener('touchmove', e => {
  if (!pulling) return;
  const dist = e.touches[0].clientY - pullStartY;
  if (dist > 60 && content.scrollTop <= 0) {
    document.getElementById('pullIndicator').classList.add('show');
  }
}, { passive: true });
content.addEventListener('touchend', e => {
  if (document.getElementById('pullIndicator').classList.contains('show')) {
    document.getElementById('pullIndicator').classList.remove('show');
    loadDashboard();
    toast('Odswiezono');
  }
  pulling = false;
}, { passive: true });

// ====================== Dashboard ======================
async function loadDashboard() {
  if (!wallet) return;
  const [userData, blockchainInfo] = await Promise.all([
    apiCall('user.php', { wallet }),
    apiCall('blockchain.php', { action: 'info' })
  ]);

  if (userData.success && userData.user) {
    const u = userData.user;
    userBalance = u.balance || '0';
    document.getElementById('balanceAmount').textContent = parseFloat(u.balance).toFixed(8) + ' VHC';
    document.getElementById('walletAddress').textContent = u.wallet || '-';
    document.getElementById('statMined').textContent = u.blocks_mined || 0;
    document.getElementById('statTX').textContent = u.transactions_count || 0;
  }

  if (blockchainInfo.success && blockchainInfo.data) {
    const d = blockchainInfo.data;
    document.getElementById('statBlocks').textContent = d.block_count ?? '-';
    document.getElementById('statDifficulty').textContent = d.current_difficulty ?? '-';
    document.getElementById('headerDifficulty').textContent = 'D: ' + (d.current_difficulty ?? '-');
  }

  loadTransactions();
}

async function loadTransactions() {
  const result = await apiCall('transactions.php', { wallet, limit: 10 });
  const el = document.getElementById('txList');
  if (!result.success || !result.transactions || result.transactions.length === 0) {
    el.innerHTML = '<div class="empty">Brak transakcji</div>';
    return;
  }
  el.innerHTML = '';
  result.transactions.forEach(tx => {
    const isSend = tx.sender === wallet;
    const d = document.createElement('div');
    d.className = 'tx-item';
    const ts = tx.timestamp ? new Date(parseInt(tx.timestamp) * 1000).toLocaleString('pl-PL') : '-';
    const other = isSend ? tx.receiver : tx.sender;
    // Check for stored note
    const noteKey = 'txnote_' + tx.hash;
    const note = STORE.getItem(noteKey);
    d.innerHTML = `
      <div>
        <div class="tx-amount ${isSend ? 'minus' : 'plus'}">${isSend ? '-' : '+'} ${parseFloat(tx.amount).toFixed(8)}</div>
        <div class="tx-addr">${shorten(other)}</div>
        ${note ? '<div class="tx-note">' + note + '</div>' : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--accent);">${isSend ? 'Wyslano' : 'Otrzymano'}</div>
        <div class="tx-date">${ts}</div>
      </div>
    `;
    el.appendChild(d);
  });
}

async function loadWalletHistory() {
  if (!wallet) return;
  const result = await apiCall('transactions.php', { wallet, limit: 20 });
  const el = document.getElementById('txHistory');
  if (!result.success || !result.transactions || result.transactions.length === 0) {
    el.innerHTML = '<div class="empty">Brak transakcji</div>';
    return;
  }
  el.innerHTML = '';
  result.transactions.forEach(tx => {
    const isSend = tx.sender === wallet;
    const d = document.createElement('div');
    d.className = 'tx-item';
    const ts = tx.timestamp ? new Date(parseInt(tx.timestamp) * 1000).toLocaleString('pl-PL') : '-';
    const other = isSend ? tx.receiver : tx.sender;
    const noteKey = 'txnote_' + tx.hash;
    const note = STORE.getItem(noteKey);
    d.innerHTML = `
      <div>
        <div class="tx-amount ${isSend ? 'minus' : 'plus'}">${isSend ? '-' : '+'} ${parseFloat(tx.amount).toFixed(8)}</div>
        <div class="tx-addr">${shorten(other)}</div>
        ${note ? '<div class="tx-note">' + note + '</div>' : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--text-muted);">${ts}</div>
      </div>
    `;
    el.appendChild(d);
  });
}

function shorten(hash, len = 8) {
  if (!hash || hash.length <= len * 2) return hash || '-';
  return hash.substring(0, len) + '...' + hash.substring(hash.length - len);
}

// ====================== Send ======================
async function sendCoins() {
  const receiver = document.getElementById('sendAddr').value.trim();
  const amount = parseFloat(document.getElementById('sendAmount').value);
  const password = document.getElementById('sendPass').value;
  const note = document.getElementById('sendNote').value.trim();

  if (!receiver || !amount || amount <= 0 || !password) {
    toast('Wypelnij wszystkie pola'); return;
  }

  const btn = document.querySelector('#pageSend .btn-primary');
  btn.disabled = true; btn.textContent = 'Wysylanie...';

  const result = await apiCall('transfer.php', { sender: wallet, receiver, amount, password });

  btn.disabled = false; btn.textContent = 'Wyslij';

  if (result.success) {
    toast('Transakcja wyslana!');
    if (note && result.tx_hash) {
      STORE.setItem('txnote_' + result.tx_hash, note);
    }
    document.getElementById('sendAddr').value = '';
    document.getElementById('sendAmount').value = '';
    document.getElementById('sendPass').value = '';
    document.getElementById('sendNote').value = '';
    loadDashboard();
    loadWalletHistory();
  } else {
    toast(result.error || 'Blad');
  }
}

// ====================== Mining (Multi-thread SHA-256) ======================
const WORKER_CHUNK = 50000;

function createWorkerCode() {
  return `
    self.onmessage = function(e) {
      const { header, difficulty, startNonce, workerId } = e.data;
      let nonce = startNonce;
      const max = startNonce + ${WORKER_CHUNK};
      const prefix = '0'.repeat(difficulty);

      while (nonce < max) {
        const data = header + '|' + nonce;
        const hash = sha256js(data);
        if (hash.startsWith(prefix)) {
          self.postMessage({ found: true, nonce, hash, workerId });
          return;
        }
        nonce++;
      }
      self.postMessage({ found: false, nonce: startNonce, workerId });
    };

    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    function sigma0(x) { return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22); }
    function sigma1(x) { return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25); }
    function gamma0(x) { return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3); }
    function gamma1(x) { return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10); }
    function ch(x, y, z) { return (x & y) ^ (~x & z); }
    function maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }

    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];

    function sha256js(data) {
      const len = data.length;
      const ml = len * 8;
      const totalLen = ((len + 9 + 63) >>> 6) << 6;
      const blocks = [];
      for (let i = 0; i < totalLen; i += 64) {
        const block = new Uint32Array(16);
        for (let j = 0; j < 16; j++) {
          let w = 0;
          for (let k = 0; k < 4; k++) {
            const idx = i + j * 4 + k;
            w = (w << 8) | (idx < len ? data.charCodeAt(idx) : (idx === len ? 0x80 : 0));
          }
          if (i + j * 4 + 3 >= len + 8 && i + j * 4 >= len + 1) {
            if (i + j * 4 === totalLen - 8) w = ml >>> 24;
            else if (i + j * 4 === totalLen - 7) w = (ml >>> 16) & 0xff;
            else if (i + j * 4 === totalLen - 6) w = (ml >>> 8) & 0xff;
            else if (i + j * 4 === totalLen - 5) w = ml & 0xff;
          }
          block[j] = w;
        }
        blocks.push(block);
      }

      let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
      let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

      for (let b = 0; b < blocks.length; b++) {
        const W = new Uint32Array(64);
        for (let t = 0; t < 16; t++) W[t] = blocks[b][t];
        for (let t = 16; t < 64; t++) {
          W[t] = (gamma1(W[t-2]) + W[t-7] + gamma0(W[t-15]) + W[t-16]) >>> 0;
        }
        let a = H0, b2 = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
        for (let t = 0; t < 64; t++) {
          const T1 = (h + sigma1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0;
          const T2 = (sigma0(a) + maj(a, b2, c)) >>> 0;
          h = g; g = f; f = e; e = (d + T1) >>> 0;
          d = c; c = b2; b2 = a; a = (T1 + T2) >>> 0;
        }
        H0 = (H0 + a) >>> 0; H1 = (H1 + b2) >>> 0;
        H2 = (H2 + c) >>> 0; H3 = (H3 + d) >>> 0;
        H4 = (H4 + e) >>> 0; H5 = (H5 + f) >>> 0;
        H6 = (H6 + g) >>> 0; H7 = (H7 + h) >>> 0;
      }

      const hex = (n) => (n >>> 24).toString(16).padStart(2,'0') +
        ((n>>>16)&0xff).toString(16).padStart(2,'0') +
        ((n>>>8)&0xff).toString(16).padStart(2,'0') +
        (n&0xff).toString(16).padStart(2,'0');
      return hex(H0) + hex(H1) + hex(H2) + hex(H3) + hex(H4) + hex(H5) + hex(H6) + hex(H7);
    }
  `;
}

function createWorker() {
  const blob = new Blob([createWorkerCode()], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

function stopWorker(w) {
  try { w.terminate(); } catch(e) {}
}

function setThreads(n) {
  miningThreads = n;
  STORE.setItem('vhc_threads', String(n));
  document.getElementById('miningThreads').textContent = n;
}

function showThreadPicker() {
  const container = document.getElementById('miningBtn').parentElement;
  const existing = document.querySelector('.thread-picker');
  if (existing) { existing.remove(); return; }
  const picker = document.createElement('div');
  picker.className = 'thread-picker';
  for (let i = 1; i <= 8; i *= 2) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = i === miningThreads ? 'active' : '';
    btn.onclick = () => { setThreads(i); document.querySelectorAll('.thread-picker button').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
    picker.appendChild(btn);
  }
  container.parentElement.insertBefore(picker, container.nextSibling);
}

function playBlockSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
}

function vibrateBlock() {
  try { navigator.vibrate([100, 50, 200]); } catch(e) {}
}

async function startMining() {
  mining = true;
  miningHashCount = 0;
  miningBlocks = 0;
  miningStartTime = Date.now();
  chartPoints = [];
  document.getElementById('miningIcon').className = 'mining-icon mining';
  document.getElementById('miningStatus').textContent = 'Kopanie...';
  document.getElementById('miningDetail').textContent = 'Szukam bloku...';
  document.getElementById('miningBtn').textContent = '\u25A0 Stop';
  document.getElementById('miningBtn').className = 'btn btn-danger';

  // Start chart updates
  if (chartInterval) clearInterval(chartInterval);
  chartInterval = setInterval(recordChartPoint, 2000);

  mineLoop();
}

async function mineLoop() {
  if (!mining) return;

  const jobResult = await apiCall('mine.php', { action: 'get_job', wallet });
  if (!jobResult.success || !jobResult.job) {
    document.getElementById('miningDetail').textContent = 'Blad pobierania zadania. Ponawiam...';
    setTimeout(mineLoop, 3000);
    return;
  }

  const job = jobResult.job;
  const difficulty = job.difficulty || 4;
  miningJobData = job;
  miningJobId = job.block_index || 0;

  document.getElementById('miningDetail').textContent =
    'Blok #' + (job.block_index || '?') + ' | trudnosc ' + difficulty;

  const txs = job.transactions || [];
  const txJson = JSON.stringify(txs);
  const header = (job.block_index || 0) + '|' + (job.previous_hash || '') + '|' +
    (job.timestamp || 0) + '|' + txJson + '|' + wallet + '|1|' + difficulty;

  // Use active threads (reduce if battery low)
  let activeThreads = miningThreads;
  if (batteryLow && batterySave) activeThreads = Math.max(1, Math.floor(activeThreads / 2));

  const chunkSize = WORKER_CHUNK;
  let nonceBase = 0;
  let found = false;

  while (mining && !found) {
    // Spawn workers
    const workers = [];
    const promises = [];

    for (let i = 0; i < activeThreads; i++) {
      const w = createWorker();
      workers.push(w);
      const start = nonceBase + i * chunkSize;
      promises.push(new Promise(resolve => {
        w.onmessage = (e) => {
          if (e.data.found) {
            resolve(e.data);
          } else {
            miningHashCount += chunkSize;
            updateMiningStats();
            resolve(null);
          }
        };
        w.postMessage({ header, difficulty, startNonce: start, workerId: i });
      }));
    }

    const results = await Promise.race([
      Promise.all(promises),
      new Promise(r => setTimeout(() => r('timeout'), 8000))
    ]);

    // Terminate all
    workers.forEach(stopWorker);

    if (results === 'timeout') {
      nonceBase += activeThreads * chunkSize;
      updateMiningStats();
      continue;
    }

    // Check for found
    for (const r of results) {
      if (r && r.found) {
        found = true;
        await submitBlock(job, header, r.nonce, r.hash);
        if (mining) { mineLoop(); return; }
        break;
      }
    }

    if (!found) {
      nonceBase += activeThreads * chunkSize;
      updateMiningStats();
    }
  }

  if (mining) mineLoop();
}

async function submitBlock(job, header, nonce, hash) {
  const txs = job.transactions || [];
  const blockData = {
    block_index: job.block_index,
    previous_hash: job.previous_hash,
    timestamp: job.timestamp,
    transactions: txs,
    miner: wallet,
    reward: 1,
    difficulty: job.difficulty || 4,
    nonce: nonce,
    hash: hash
  };

  document.getElementById('miningDetail').textContent = 'Blok znaleziony! Wysylanie...';
  const submitResult = await apiCall('mine.php', { action: 'submit_block', block: JSON.stringify(blockData) });

  if (submitResult.success) {
    miningBlocks++;
    updateMiningStats();
    toast('Blok #' + job.block_index + ' zaakceptowany! +1 VHC');
    document.getElementById('miningDetail').textContent = 'Blok ZAAKCEPTOWANY!';
    // Play sound + vibrate
    const settings = loadSettings();
    if (settings.sound) playBlockSound();
    if (settings.vibrate) vibrateBlock();
  } else {
    document.getElementById('miningDetail').textContent = 'Blok odrzucony: ' + (submitResult.error || '?');
  }
  await sleep(1000);
}

function updateMiningStats() {
  const elapsed = (Date.now() - miningStartTime) / 1000;
  const hr = elapsed > 0 ? miningHashCount / elapsed : 0;
  document.getElementById('hashCount').textContent = miningHashCount;
  document.getElementById('hashRate').textContent = (hr / 1000).toFixed(1);
  document.getElementById('blocksFound').textContent = miningBlocks;
  document.getElementById('miningThreads').textContent = miningThreads;
  document.getElementById('miningProgress').style.width = Math.min(100, (miningHashCount % 100000) / 1000) + '%';

  const settings = loadSettings();
  document.getElementById('autoMiningLabel').textContent = settings.autoMine ? 'Auto: wl.' : 'Auto: wyl.';
}

function recordChartPoint() {
  if (!mining) return;
  const elapsed = (Date.now() - miningStartTime) / 1000;
  const hr = elapsed > 0 ? miningHashCount / elapsed : 0;
  chartPoints.push(hr / 1000);
  if (chartPoints.length > 30) chartPoints.shift();
  updateChart();
}

function updateChart() {
  const canvas = document.getElementById('hashChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!chartPoints.length) {
    ctx.fillStyle = '#64748b'; ctx.font = '12px monospace';
    ctx.textAlign = 'center'; ctx.fillText('Brak danych', w/2, h/2);
    return;
  }

  const max = Math.max(...chartPoints, 1);
  const pad = 20;
  const gw = w - pad * 2;
  const gh = h - pad * 2;

  // Grid lines
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = pad + (gh / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y);
    ctx.stroke();
    ctx.fillStyle = '#64748b'; ctx.font = '8px monospace';
    ctx.textAlign = 'right'; ctx.fillText((max * (1 - i/4)).toFixed(1), pad - 4, y + 3);
  }

  // Line
  if (chartPoints.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#00d4aa'; ctx.lineWidth = 2;
    for (let i = 0; i < chartPoints.length; i++) {
      const x = pad + (i / (chartPoints.length - 1)) * gw;
      const y = pad + gh - (chartPoints[i] / max) * gh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill
    ctx.lineTo(w - pad, pad + gh);
    ctx.lineTo(pad, pad + gh);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,212,170,0.1)';
    ctx.fill();
  }

  // Current value
  const cur = chartPoints[chartPoints.length - 1];
  ctx.fillStyle = '#00d4aa'; ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(cur.toFixed(1) + ' kH/s', pad, 14);
}

function stopMining() {
  mining = false;
  miningWorkers.forEach(stopWorker);
  miningWorkers = [];
  if (chartInterval) { clearInterval(chartInterval); chartInterval = null; }
  document.getElementById('miningIcon').className = 'mining-icon';
  document.getElementById('miningStatus').textContent = 'Zatrzymana';
  document.getElementById('miningDetail').textContent = 'Kliknij Start, aby rozpoczac';
  document.getElementById('miningBtn').textContent = '\u25B6 Start';
  document.getElementById('miningBtn').className = 'btn btn-primary';
}

function toggleMining() {
  if (mining) { stopMining(); }
  else { startMining(); }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ====================== Karty platnicze VHC ======================
function formatCardNum(n) {
  return n.replace(/(.{4})/g, '$1 ').trim();
}

function loadPaymentCards() {
  const raw = STORE.getItem('vhc_cards');
  return raw ? JSON.parse(raw) : [];
}

function savePaymentCards(cards) {
  STORE.setItem('vhc_cards', JSON.stringify(cards));
}

async function createPaymentCard() {
  const pin = document.getElementById('cardPin').value.trim();
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    toast('PIN musi miec 4 cyfry'); return;
  }

  const user = await apiCall('user.php', { wallet });
  if (!user.success || !user.user || parseFloat(user.user.balance) < 0.1) {
    toast('Potrzebujesz 0.1 VHC'); return;
  }

  const num = Array.from({length:16}, () => Math.floor(Math.random() * 10)).join('');
  const expMM = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const expYY = String(new Date().getFullYear() + 2).slice(-2);
  const cvv = String(Math.floor(Math.random() * 900) + 100);
  const id = 'CARD-' + num.slice(-4);

  const card = {
    id, number: num, exp: expMM + '/' + expYY, cvv, pin,
    balance: 0, status: 'active', created: Date.now()
  };

  const cards = loadPaymentCards();
  cards.unshift(card);
  savePaymentCards(cards);

  showCards();
  toast('Karta ' + formatCardNum(num) + ' utworzona!');
  loadDashboard();
}

function showCards() {
  const el = document.getElementById('cardList');
  const cards = loadPaymentCards();
  if (!cards.length) {
    el.innerHTML = '<div class="empty">Brak kart. Utworz pierwsza!</div>';
    return;
  }
  el.innerHTML = '';
  cards.forEach(c => {
    const d = document.createElement('div');
    d.className = 'payment-card';
    const masked = c.number.replace(/\d(?=\d{4})/g, '\u2022').replace(/(.{4})/g, '$1 ').trim();
    d.innerHTML = `
      <div class="pc-bg"></div>
      <div class="pc-chip"></div>
      <div class="pc-number">${masked}</div>
      <div class="pc-row">
        <div class="pc-label">WYGA\u015A\u0106A<br><span class="pc-val">${c.exp}</span></div>
        <div class="pc-label">CVV<br><span class="pc-val">${c.cvv}</span></div>
      </div>
      <div class="pc-name">${loginName.toUpperCase() || 'USER'}</div>
      <div class="pc-balance">${c.balance.toFixed(2)} VHC</div>
      <div class="pc-status ${c.status}">${c.status === 'active' ? 'Aktywna' : 'Zamrozona'}</div>
      <div class="pc-actions">
        <button class="btn btn-sm ${c.status === 'active' ? 'btn-danger' : 'btn-primary'}" onclick="toggleCardStatus('${c.id}')">
          ${c.status === 'active' ? '\u274C Zamroz' : '\u25B6 Odblokuj'}
        </button>
        <button class="btn btn-sm btn-outline" onclick="loadCard('${c.id}')">\u2795 Doladuj</button>
      </div>
    `;
    el.appendChild(d);
  });
}

function toggleCardStatus(id) {
  const cards = loadPaymentCards();
  const c = cards.find(x => x.id === id);
  if (!c) return;
  c.status = c.status === 'active' ? 'frozen' : 'active';
  savePaymentCards(cards);
  showCards();
  toast('Karta ' + (c.status === 'active' ? 'odblokowana' : 'zamrozona'));
}

async function loadCard(id) {
  const pin = prompt('Podaj PIN karty ' + id + ':');
  if (!pin || !/^\d{4}$/.test(pin)) { toast('Nieprawidlowy PIN'); return; }

  const cards = loadPaymentCards();
  const c = cards.find(x => x.id === id);
  if (!c) { toast('Nie znaleziono karty'); return; }
  if (c.pin !== pin) { toast('Zly PIN'); return; }

  const amount = prompt('Ile VHC doladowac? (max ' + parseFloat(userBalance).toFixed(2) + ' VHC)');
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) { toast('Nieprawidlowa kwota'); return; }
  if (amt > parseFloat(userBalance)) { toast('Niewystarczajace saldo'); return; }

  c.balance += amt;
  savePaymentCards(cards);
  showCards();
  toast('Doladowano ' + amt.toFixed(2) + ' VHC na karte ' + id);
  loadDashboard();
}

// ====================== InfinityFree Session ======================
function initSession() {
  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://vexcoin.xo.je/api/config.php?_t=' + Date.now();
    let done = false;
    const finish = () => { if (!done) { done = true; iframe.remove(); resolve(); } };
    iframe.onload = finish;
    setTimeout(finish, 5000);
    document.body.appendChild(iframe);
  });
}

// ====================== Init ======================
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(async () => {
    document.getElementById('splashScreen').classList.add('hidden');
    await initSession();
    if (token && wallet) {
      checkPinLock();
    }
  }, 1200);
});

// Auto-refresh dashboard
setInterval(() => {
  if (document.getElementById('mainApp').classList.contains('active') && !mining) {
    loadDashboard();
  }
}, 15000);
