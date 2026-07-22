const API = 'https://krypto-wk12100lol-progs-projects.vercel.app/api';
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
let chartPoints = [];
let chartInterval = null;
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
        return { success: false, error: 'Server error - refresh app' };
      }
      try { const j = JSON.parse(text); return { success: false, error: j.error || text }; }
      catch { return { success: false, error: text || 'HTTP ' + res.status }; }
    }
    try { return JSON.parse(text); }
    catch { return { success: false, error: 'Parse error' }; }
  } catch(e) {
    const msg = e.name === 'TimeoutError' ? 'Timeout (20s)' : (e.message || 'Nieznany blad sieci');
    return { success: false, error: msg };
  }
}

// ====================== PARTICLE BACKGROUND ======================
let particleCtx, particleW, particleH;
let particlesArr = [];

function initParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particleCanvas';
  document.body.prepend(canvas);
  particleCtx = canvas.getContext('2d');
  resizeParticles();
  window.addEventListener('resize', resizeParticles);
  for (let i = 0; i < 40; i++) {
    particlesArr.push({
      x: Math.random() * particleW,
      y: Math.random() * particleH,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      a: Math.random() * 0.3 + 0.1
    });
  }
  animateParticles();
}
function resizeParticles() {
  particleW = window.innerWidth;
  particleH = window.innerHeight;
  if (particleCtx) {
    const canvas = particleCtx.canvas;
    canvas.width = particleW;
    canvas.height = particleH;
  }
}
function animateParticles() {
  if (!particleCtx) return;
  particleCtx.clearRect(0, 0, particleW, particleH);
  for (const p of particlesArr) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = particleW;
    if (p.x > particleW) p.x = 0;
    if (p.y < 0) p.y = particleH;
    if (p.y > particleH) p.y = 0;
    particleCtx.beginPath();
    particleCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    particleCtx.fillStyle = `rgba(0, 229, 176, ${p.a})`;
    particleCtx.fill();
  }
  // Lines between close particles
  for (let i = 0; i < particlesArr.length; i++) {
    for (let j = i + 1; j < particlesArr.length; j++) {
      const dx = particlesArr[i].x - particlesArr[j].x;
      const dy = particlesArr[i].y - particlesArr[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        particleCtx.beginPath();
        particleCtx.moveTo(particlesArr[i].x, particlesArr[i].y);
        particleCtx.lineTo(particlesArr[j].x, particlesArr[j].y);
        particleCtx.strokeStyle = `rgba(0, 229, 176, ${0.06 * (1 - dist / 100)})`;
        particleCtx.lineWidth = 0.5;
        particleCtx.stroke();
      }
    }
  }
  requestAnimationFrame(animateParticles);
}

// ====================== CONFETTI ======================
function burstCelebration() {
  const colors = ['#00e5b0', '#7c3aed', '#f472b6', '#ff4466', '#f59e0b'];
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:999;pointer-events:none;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const pieces = [];
  for (let i = 0; i < 60; i++) {
    pieces.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 1) * 20 - 5,
      r: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 10
    });
  }
  let frame = 0;
  function anim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life -= 0.012;
      p.rot += p.rotV;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
      ctx.restore();
    }
    frame++;
    if (alive) requestAnimationFrame(anim);
    else canvas.remove();
  }
  anim();
}

// ====================== TOAST ======================
function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => el.classList.remove('show'), duration);
  updateMiningStats();
}

// ====================== SETTINGS ======================
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
    const p = prompt('Set PIN (4 digits):');
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

// ====================== BATTERY ======================
async function initBattery() {
  try {
    const batt = await navigator.getBattery();
    const update = () => {
      batteryLow = batt.level < 0.2 && batt.level >= 0;
      document.getElementById('batteryMode').textContent = batteryLow ? '\u26A0 Saving' : '\u26A1';
      if (batteryLow && mining && batterySave) {
        setThreads(Math.max(1, Math.floor(miningThreads / 2)));
      }
    };
    batt.addEventListener('levelchange', update);
    batt.addEventListener('chargingchange', update);
    update();
  } catch(e) { document.getElementById('batteryMode').textContent = '\u26A1 Full'; }
}

// ====================== AUTH ======================
let isRegister = false;
function toggleAuthMode() {
  isRegister = !isRegister;
  document.getElementById('authTitle').textContent = isRegister ? 'Create Account' : 'Sign In';
  document.getElementById('authSub').textContent = isRegister ? 'Join VHC network' : 'Welcome back to VHC';
  document.getElementById('authBtn').textContent = isRegister ? 'Register' : 'Sign In';
  document.getElementById('authToggleText').textContent = isRegister ? 'Already have an account?' : 'No account?';
  document.getElementById('authToggleLink').textContent = isRegister ? 'Sign In' : 'Register';
  document.getElementById('emailGroup').style.display = isRegister ? '' : 'none';
  document.getElementById('confirmGroup').style.display = isRegister ? '' : 'none';
  hideAuthMsg();
  // Animate
  document.getElementById('authFields').style.animation = 'none';
  void document.getElementById('authFields').offsetWidth;
  document.getElementById('authFields').style.animation = 'authSlideUp 0.3s ease-out';
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
    if (!login || !email || !password || !confirm) { showAuthError('Fill all fields'); return; }
    if (password !== confirm) { showAuthError('Passwords do not match'); return; }
    if (password.length < 6) { showAuthError('Password min 6 chars'); return; }
    document.getElementById('authBtn').disabled = true;
    document.getElementById('authBtn').textContent = 'Creating...';
    const result = await apiCall('register', { login, email, password });
    document.getElementById('authBtn').disabled = false;
    document.getElementById('authBtn').textContent = 'Register';
    if (result.success) {
      showAuthSuccess('Account created! Wallet: ' + result.wallet + '. Redirecting...');
      document.getElementById('authBtn').style.animation = 'none';
      setTimeout(() => { isRegister = false; toggleAuthMode(); document.getElementById('authLogin').value = login; }, 2000);
    } else {
      showAuthError(result.error || 'Registration failed');
    }
    return;
  }
  if (!login || !password) { showAuthError('Fill all fields'); return; }
  document.getElementById('authBtn').disabled = true;
  document.getElementById('authBtn').textContent = 'Signing in...';
  const result = await apiCall('login', { login, password });
  document.getElementById('authBtn').disabled = false;
  document.getElementById('authBtn').textContent = 'Sign In';
  if (result.success && result.user) {
    token = result.token;
    wallet = result.user.wallet || '';
    loginName = result.user.login || '';
    STORE.setItem('vhc_token', token);
    STORE.setItem('vhc_wallet', wallet);
    STORE.setItem('vhc_login', loginName);
    addWalletToStore(wallet, loginName);
    enterApp();
  } else {
    showAuthError(result.error || 'Login failed');
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

// ====================== PIN ======================
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
    document.getElementById('pinError').textContent = 'Wrong PIN';
    document.getElementById('pinError').style.display = 'block';
    document.getElementById('pinInput').value = '';
    // Shake animation
    const box = document.querySelector('#pinScreen .auth-box');
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = 'shakeIn 0.3s ease-out';
  }
}

// ====================== MULTI-WALLET ======================
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
  if (!addr || addr.length < 10) { toast('Invalid address'); return; }
  addWalletToStore(addr, addr.substring(0, 10) + '...');
  document.getElementById('importWalletAddr').value = '';
  renderWalletList();
  toast('Wallet added');
}
function removeWallet(addr) {
  if (addr === wallet) { toast('Cannot remove active wallet'); return; }
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
  toast('Switched to ' + addr.substring(0, 10) + '...');
}
async function renderWalletList() {
  const el = document.getElementById('walletList');
  const list = loadWalletList();
  if (!list.length) { el.innerHTML = '<div class="empty">No saved wallets</div>'; return; }
  el.innerHTML = '';
  for (const w of list) {
    const isCurrent = w.addr === wallet;
    const d = document.createElement('div');
    d.className = 'wallet-item' + (isCurrent ? ' current' : '');
    let bal = '?';
    try {
      const res = await apiCall('user', { wallet: w.addr });
      if (res.success && res.user) bal = parseFloat(res.user.balance).toFixed(2);
    } catch(e) {}
    d.innerHTML = `
      <div>
        <div class="wallet-addr">${w.label}</div>
        <div class="wallet-info">${shorten(w.addr, 10)}</div>
        <div class="wallet-bal">${bal} VHC ${isCurrent ? '(current)' : ''}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${isCurrent ? '' : '<span class="wallet-action" onclick="switchWallet(\'' + w.addr + '\')" style="color:var(--accent);">\u21AA</span>'}
        <span class="wallet-action" onclick="removeWallet(\'' + w.addr + '\')">\u2716</span>
      </div>`;
    el.appendChild(d);
  }
}

// ====================== SHARE ======================
function shareWallet() {
  if (navigator.share) {
    navigator.share({ title: 'VHC Wallet', text: 'My VHC account: ' + wallet, url: 'https://vexcoin.xo.je' }).catch(() => {});
  } else {
    navigator.clipboard.writeText(wallet).then(() => toast('Address copied!')).catch(() => toast(wallet));
  }
}

// ====================== ANIMATED COUNTER ======================
function animateCounter(el, target, suffix = '', duration = 1200) {
  const start = parseFloat(el.getAttribute('data-val') || '0');
  const diff = parseFloat(target) - start;
  if (Math.abs(diff) < 0.000001) { el.textContent = parseFloat(target).toFixed(8) + suffix; el.setAttribute('data-val', target); return; }
  const startTime = performance.now();
  function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const cur = start + diff * ease;
    el.textContent = cur.toFixed(8) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = parseFloat(target).toFixed(8) + suffix; el.setAttribute('data-val', target); }
  }
  el.setAttribute('data-val', start);
  requestAnimationFrame(tick);
}

// ====================== ENTER APP ======================
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

// ====================== NAVIGATION WITH SLIDE ======================
document.querySelectorAll('.app-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.app-nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
      p.style.animation = 'none';
      void p.offsetWidth;
    });
    btn.classList.add('active');
    const page = document.getElementById(btn.dataset.page);
    page.style.animation = 'pageIn 0.3s ease-out';
    page.classList.add('active');
    if (btn.dataset.page === 'pageSend') loadWalletHistory();
    if (btn.dataset.page === 'pageCards') showCards();
    if (btn.dataset.page === 'pageSettings') renderWalletList();
    if (btn.dataset.page === 'pageMining') updateChart();
    document.getElementById('appContent').scrollTop = 0;
  });
});

// ====================== PULL TO REFRESH ======================
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
    toast('Refreshed!');
  }
  pulling = false;
}, { passive: true });

// ====================== DASHBOARD ======================
async function loadDashboard() {
  if (!wallet) return;
  const [userData, blockchainInfo] = await Promise.all([
    apiCall('user', { wallet }),
    apiCall('blockchain', { action: 'info' })
  ]);
  if (userData.success && userData.user) {
    const u = userData.user;
    userBalance = u.balance || '0';
    animateCounter(document.getElementById('balanceAmount'), u.balance, ' VHC');
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
  const result = await apiCall('transactions', { wallet, limit: 10 });
  const el = document.getElementById('txList');
  if (!result.success || !result.transactions || result.transactions.length === 0) {
    el.innerHTML = '<div class="empty">No transactions</div>'; return;
  }
  el.innerHTML = '';
  result.transactions.forEach((tx, i) => {
    const isSend = tx.sender === wallet;
    const d = document.createElement('div');
    d.className = 'tx-item';
    d.style.animationDelay = (i * 0.04) + 's';
    const ts = tx.timestamp ? new Date(parseInt(tx.timestamp) * 1000).toLocaleString('pl-PL') : '-';
    const other = isSend ? tx.receiver : tx.sender;
    const noteKey = 'txnote_' + tx.hash;
    const note = STORE.getItem(noteKey);
    d.innerHTML = `
      <div>
        <div class="tx-amount ${isSend ? 'minus' : 'plus'}">${isSend ? '- ' : '+ '}${parseFloat(tx.amount).toFixed(8)}</div>
        <div class="tx-addr">${shorten(other)}</div>
        ${note ? '<div class="tx-note">' + note + '</div>' : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--accent);font-weight:600;">${isSend ? 'Sent' : 'Received'}</div>
        <div class="tx-date">${ts}</div>
      </div>`;
    el.appendChild(d);
  });
}
async function loadWalletHistory() {
  if (!wallet) return;
  const result = await apiCall('transactions', { wallet, limit: 20 });
  const el = document.getElementById('txHistory');
  if (!result.success || !result.transactions || result.transactions.length === 0) {
    el.innerHTML = '<div class="empty">No transactions</div>'; return;
  }
  el.innerHTML = '';
  result.transactions.forEach((tx, i) => {
    const isSend = tx.sender === wallet;
    const d = document.createElement('div');
    d.className = 'tx-item';
    d.style.animationDelay = (i * 0.03) + 's';
    const ts = tx.timestamp ? new Date(parseInt(tx.timestamp) * 1000).toLocaleString('pl-PL') : '-';
    const other = isSend ? tx.receiver : tx.sender;
    const noteKey = 'txnote_' + tx.hash;
    const note = STORE.getItem(noteKey);
    d.innerHTML = `
      <div>
        <div class="tx-amount ${isSend ? 'minus' : 'plus'}">${isSend ? '- ' : '+ '}${parseFloat(tx.amount).toFixed(8)}</div>
        <div class="tx-addr">${shorten(other)}</div>
        ${note ? '<div class="tx-note">' + note + '</div>' : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--text-muted);">${ts}</div>
      </div>`;
    el.appendChild(d);
  });
}
function shorten(hash, len = 8) {
  if (!hash || hash.length <= len * 2) return hash || '-';
  return hash.substring(0, len) + '...' + hash.substring(hash.length - len);
}

// ====================== SEND ======================
async function sendCoins() {
  const receiver = document.getElementById('sendAddr').value.trim();
  const amount = parseFloat(document.getElementById('sendAmount').value);
  const password = document.getElementById('sendPass').value;
  const note = document.getElementById('sendNote').value.trim();
  if (!receiver || !amount || amount <= 0 || !password) { toast('Fill all fields'); return; }
  const btn = document.querySelector('#pageSend .btn-primary');
  btn.disabled = true; btn.textContent = 'Sending...';
  const result = await apiCall('transfer', { sender: wallet, receiver, amount, password });
  btn.disabled = false; btn.textContent = 'Send';
  if (result.success) {
    toast('Transaction sent!');
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
    toast(result.error || 'Error');
  }
}

// ====================== MINING ======================
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
    function ch(x,y,z) { return (x & y) ^ (~x & z); }
    function maj(x,y,z) { return (x & y) ^ (x & z) ^ (y & z); }
    const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    function sha256js(data) {
      const len=data.length; const ml=len*8; const totalLen=((len+9+63)>>>6)<<6;
      const blocks=[];
      for(let i=0;i<totalLen;i+=64){const block=new Uint32Array(16);for(let j=0;j<16;j++){let w=0;for(let k=0;k<4;k++){const idx=i+j*4+k;w=(w<<8)|(idx<len?data.charCodeAt(idx):(idx===len?0x80:0));}if(i+j*4+3>=len+8&&i+j*4>=len+1){if(i+j*4===totalLen-8)w=ml>>>24;else if(i+j*4===totalLen-7)w=(ml>>>16)&0xff;else if(i+j*4===totalLen-6)w=(ml>>>8)&0xff;else if(i+j*4===totalLen-5)w=ml&0xff;}block[j]=w;}blocks.push(block);}
      let H0=0x6a09e667,H1=0xbb67ae85,H2=0x3c6ef372,H3=0xa54ff53a,H4=0x510e527f,H5=0x9b05688c,H6=0x1f83d9ab,H7=0x5be0cd19;
      for(let b=0;b<blocks.length;b++){const W=new Uint32Array(64);for(let t=0;t<16;t++)W[t]=blocks[b][t];for(let t=16;t<64;t++)W[t]=(gamma1(W[t-2])+W[t-7]+gamma0(W[t-15])+W[t-16])>>>0;let a=H0,b2=H1,c=H2,d=H3,e=H4,f=H5,g=H6,h=H7;for(let t=0;t<64;t++){const T1=(h+sigma1(e)+ch(e,f,g)+K[t]+W[t])>>>0;const T2=(sigma0(a)+maj(a,b2,c))>>>0;h=g;g=f;f=e;e=(d+T1)>>>0;d=c;c=b2;b2=a;a=(T1+T2)>>>0;}H0=(H0+a)>>>0;H1=(H1+b2)>>>0;H2=(H2+c)>>>0;H3=(H3+d)>>>0;H4=(H4+e)>>>0;H5=(H5+f)>>>0;H6=(H6+g)>>>0;H7=(H7+h)>>>0;}
      const hex=n=>(n>>>24).toString(16).padStart(2,'0')+((n>>>16)&0xff).toString(16).padStart(2,'0')+((n>>>8)&0xff).toString(16).padStart(2,'0')+(n&0xff).toString(16).padStart(2,'0');
      return hex(H0)+hex(H1)+hex(H2)+hex(H3)+hex(H4)+hex(H5)+hex(H6)+hex(H7);
    }
  `;
}
function createWorker() { const blob = new Blob([createWorkerCode()], { type: 'application/javascript' }); return new Worker(URL.createObjectURL(blob)); }
function stopWorker(w) { try { w.terminate(); } catch(e) {} }
function setThreads(n) { miningThreads = n; STORE.setItem('vhc_threads', String(n)); document.getElementById('miningThreads').textContent = n; }
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
function vibrateBlock() { try { navigator.vibrate([100, 50, 200]); } catch(e) {} }
async function startMining() {
  mining = true;
  miningHashCount = 0;
  miningBlocks = 0;
  miningStartTime = Date.now();
  chartPoints = [];
  document.getElementById('miningIcon').className = 'mining-icon mining';
  document.getElementById('miningStatus').textContent = 'Mining...';
  document.getElementById('miningDetail').textContent = 'Searching for block...';
  document.getElementById('miningBtn').textContent = '\u25A0 Stop';
  document.getElementById('miningBtn').className = 'btn btn-danger';
  if (chartInterval) clearInterval(chartInterval);
  chartInterval = setInterval(recordChartPoint, 2000);
  mineLoop();
}
async function mineLoop() {
  if (!mining) return;
  const jobResult = await apiCall('mine', { action: 'get_job', wallet });
  if (!jobResult.success || !jobResult.job) {
    document.getElementById('miningDetail').textContent = 'Error fetching job. Retrying...';
    setTimeout(mineLoop, 3000);
    return;
  }
  const job = jobResult.job;
  const difficulty = job.difficulty || 4;
  miningJobData = job;
  miningJobId = job.block_index || 0;
  document.getElementById('miningDetail').textContent = 'Block #' + (job.block_index || '?') + ' | difficulty ' + difficulty;
  const txs = job.transactions || [];
  const txJson = JSON.stringify(txs);
  const header = (job.block_index || 0) + '|' + (job.previous_hash || '') + '|' + (job.timestamp || 0) + '|' + txJson + '|' + wallet + '|1|' + difficulty;
  let activeThreads = miningThreads;
  if (batteryLow && batterySave) activeThreads = Math.max(1, Math.floor(activeThreads / 2));
  const chunkSize = WORKER_CHUNK;
  let nonceBase = 0;
  let found = false;
  while (mining && !found) {
    const workers = [];
    const promises = [];
    for (let i = 0; i < activeThreads; i++) {
      const w = createWorker();
      workers.push(w);
      const start = nonceBase + i * chunkSize;
      promises.push(new Promise(resolve => {
        w.onmessage = (e) => {
          if (e.data.found) { resolve(e.data); }
          else { miningHashCount += chunkSize; updateMiningStats(); resolve(null); }
        };
        w.postMessage({ header, difficulty, startNonce: start, workerId: i });
      }));
    }
    const results = await Promise.race([
      Promise.all(promises),
      new Promise(r => setTimeout(() => r('timeout'), 8000))
    ]);
    workers.forEach(stopWorker);
    if (results === 'timeout') { nonceBase += activeThreads * chunkSize; updateMiningStats(); continue; }
    for (const r of results) {
      if (r && r.found) {
        found = true;
        await submitBlock(job, header, r.nonce, r.hash);
        if (mining) { mineLoop(); return; }
        break;
      }
    }
    if (!found) { nonceBase += activeThreads * chunkSize; updateMiningStats(); }
  }
  if (mining) mineLoop();
}
async function submitBlock(job, header, nonce, hash) {
  const txs = job.transactions || [];
  const blockData = { block_index: job.block_index, previous_hash: job.previous_hash, timestamp: job.timestamp, transactions: txs, miner: wallet, reward: 1, difficulty: job.difficulty || 4, nonce, hash };
  document.getElementById('miningDetail').textContent = 'Block found! Submitting...';
  const submitResult = await apiCall('mine', { action: 'submit_block', block: JSON.stringify(blockData) });
  if (submitResult.success) {
    miningBlocks++;
    updateMiningStats();
    toast('Block #' + job.block_index + ' accepted! +1 VHC', 5000);
    document.getElementById('miningDetail').textContent = 'Block ACCEPTED!';
    burstCelebration();
    const settings = loadSettings();
    if (settings.sound) playBlockSound();
    if (settings.vibrate) vibrateBlock();
  } else {
    document.getElementById('miningDetail').textContent = 'Block rejected: ' + (submitResult.error || '?');
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
  document.getElementById('autoMiningLabel').textContent = settings.autoMine ? 'Auto: on' : 'Auto: off';
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
    ctx.fillStyle = '#5a6a8a'; ctx.font = '12px monospace';
    ctx.textAlign = 'center'; ctx.fillText('No data', w / 2, h / 2); return;
  }
  const max = Math.max(...chartPoints, 1);
  const pad = 20;
  const gw = w - pad * 2;
  const gh = h - pad * 2;
  // Gradient grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = pad + (gh / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '8px monospace';
    ctx.textAlign = 'right'; ctx.fillText((max * (1 - i / 4)).toFixed(1), pad - 4, y + 3);
  }
  // Gradient line
  const gradient = ctx.createLinearGradient(0, pad, 0, pad + gh);
  gradient.addColorStop(0, 'rgba(0, 229, 176, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 229, 176, 0.02)');
  if (chartPoints.length > 1) {
    ctx.beginPath();
    for (let i = 0; i < chartPoints.length; i++) {
      const x = pad + (i / (chartPoints.length - 1)) * gw;
      const y = pad + gh - (chartPoints[i] / max) * gh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#00e5b0'; ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 229, 176, 0.3)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Fill
    ctx.lineTo(w - pad, pad + gh);
    ctx.lineTo(pad, pad + gh);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }
  const cur = chartPoints[chartPoints.length - 1];
  ctx.fillStyle = '#00e5b0'; ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(cur.toFixed(1) + ' kH/s', pad, 14);
  // Dot
  if (chartPoints.length > 0) {
    const lx = pad + gw;
    const ly = pad + gh - (cur / max) * gh;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5b0';
    ctx.shadowColor = 'rgba(0, 229, 176, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
function stopMining() {
  mining = false;
  miningWorkers.forEach(stopWorker);
  miningWorkers = [];
  if (chartInterval) { clearInterval(chartInterval); chartInterval = null; }
  document.getElementById('miningIcon').className = 'mining-icon';
  document.getElementById('miningStatus').textContent = 'Stopped';
  document.getElementById('miningDetail').textContent = 'Press Start to mine';
  document.getElementById('miningBtn').textContent = '\u25B6 Start';
  document.getElementById('miningBtn').className = 'btn btn-primary';
}
function toggleMining() { if (mining) stopMining(); else startMining(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ====================== PAYMENT CARDS ======================
function formatCardNum(n) { return n.replace(/(.{4})/g, '$1 ').trim(); }
function loadPaymentCards() { const raw = STORE.getItem('vhc_cards'); return raw ? JSON.parse(raw) : []; }
function savePaymentCards(cards) { STORE.setItem('vhc_cards', JSON.stringify(cards)); }
async function createPaymentCard() {
  const pin = document.getElementById('cardPin').value.trim();
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) { toast('PIN must be 4 digits'); return; }
  const user = await apiCall('user', { wallet });
  if (!user.success || !user.user || parseFloat(user.user.balance) < 0.1) { toast('Need 0.1 VHC'); return; }
  const num = Array.from({length:16}, () => Math.floor(Math.random() * 10)).join('');
  const expMM = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const expYY = String(new Date().getFullYear() + 2).slice(-2);
  const cvv = String(Math.floor(Math.random() * 900) + 100);
  const id = 'CARD-' + num.slice(-4);
  const card = { id, number: num, exp: expMM + '/' + expYY, cvv, pin, balance: 0, status: 'active', created: Date.now() };
  const cards = loadPaymentCards();
  cards.unshift(card);
  savePaymentCards(cards);
  showCards();
  toast('Card ' + formatCardNum(num) + ' created!');
  loadDashboard();
}
function showCards() {
  const el = document.getElementById('cardList');
  const cards = loadPaymentCards();
  if (!cards.length) { el.innerHTML = '<div class="empty">No cards. Create one!</div>'; return; }
  el.innerHTML = '';
  cards.forEach(c => {
    const d = document.createElement('div');
    d.className = 'payment-card';
    const masked = c.number.replace(/\d(?=\d{4})/g, '\u2022').replace(/(.{4})/g, '$1 ').trim();
    d.innerHTML = `
      <div class="pc-chip"></div>
      <div class="pc-number">${masked}</div>
      <div class="pc-row">
        <div class="pc-label">EXPIRES<br><span class="pc-val">${c.exp}</span></div>
        <div class="pc-label">CVV<br><span class="pc-val">${c.cvv}</span></div>
      </div>
      <div class="pc-name">${(loginName || 'USER').toUpperCase()}</div>
      <div class="pc-balance">${c.balance.toFixed(2)} VHC</div>
      <div class="pc-status ${c.status}">${c.status === 'active' ? 'Active' : 'Frozen'}</div>
      <div class="pc-actions">
        <button class="btn btn-sm ${c.status === 'active' ? 'btn-danger' : 'btn-primary'}" onclick="toggleCardStatus('${c.id}')">${c.status === 'active' ? '\u274C Freeze' : '\u25B6 Unfreeze'}</button>
        <button class="btn btn-sm btn-outline" onclick="loadCard('${c.id}')">\u2795 Top up</button>
      </div>`;
    el.appendChild(d);
    // 3D tilt effect
    d.addEventListener('touchmove', e => {
      const rect = d.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      const rx = (y / rect.height - 0.5) * 20;
      const ry = (x / rect.width - 0.5) * -20;
      d.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }, { passive: true });
    d.addEventListener('touchend', () => { d.style.transform = ''; }, { passive: true });
  });
}
function toggleCardStatus(id) {
  const cards = loadPaymentCards();
  const c = cards.find(x => x.id === id);
  if (!c) return;
  c.status = c.status === 'active' ? 'frozen' : 'active';
  savePaymentCards(cards);
  showCards();
  toast('Card ' + (c.status === 'active' ? 'unfrozen' : 'frozen'));
}
async function loadCard(id) {
  const pin = prompt('Enter PIN for card ' + id + ':');
  if (!pin || !/^\d{4}$/.test(pin)) { toast('Invalid PIN'); return; }
  const cards = loadPaymentCards();
  const c = cards.find(x => x.id === id);
  if (!c) { toast('Card not found'); return; }
  if (c.pin !== pin) { toast('Wrong PIN'); return; }
  const amount = prompt('How much VHC? (max ' + parseFloat(userBalance).toFixed(2) + ' VHC)');
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) { toast('Invalid amount'); return; }
  if (amt > parseFloat(userBalance)) { toast('Insufficient balance'); return; }
  c.balance += amt;
  savePaymentCards(cards);
  showCards();
  toast('Topped up ' + amt.toFixed(2) + ' VHC to card ' + id);
  loadDashboard();
}

// ====================== INIT ======================
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  setTimeout(async () => {
    document.getElementById('splashScreen').classList.add('hidden');
    if (token && wallet) {
      checkPinLock();
    }
  }, 1500);
});

// Auto-refresh dashboard
setInterval(() => {
  if (document.getElementById('mainApp').classList.contains('active') && !mining) {
    loadDashboard();
  }
}, 15000);
