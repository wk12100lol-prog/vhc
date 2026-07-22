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
    if (btn.dataset.page === 'pageCards') { showCards(); showNfcHistory(); }
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
    self.onmessage = async function(e) {
      const { header, difficulty, startNonce, workerId } = e.data;
      let nonce = startNonce;
      const max = startNonce + ${WORKER_CHUNK};
      const prefix = '0'.repeat(difficulty);
      const enc = new TextEncoder();
      while (nonce < max) {
        const data = header + '|' + nonce;
        const buf = enc.encode(data);
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
        const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (hash.startsWith(prefix)) {
          self.postMessage({ found: true, nonce, hash, workerId });
          return;
        }
        nonce++;
      }
      self.postMessage({ found: false, nonce: startNonce, workerId });
    };
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
        <button class="btn btn-sm btn-primary" onclick="nfcPayP2p('${c.id}')" style="flex:0.7;">\uD83D\uDCF1 Send NFC</button>
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

// ====================== NFC P2P PAYMENTS ======================
let nfcScanning = false;
let nfcShareActive = false;
let nfcShareTimeout = null;

function loadNfcSent() { const r = STORE.getItem('vhc_nfc_sent'); return r ? JSON.parse(r) : []; }
function saveNfcSent(list) { STORE.setItem('vhc_nfc_sent', JSON.stringify(list)); }
function loadNfcReceived() { const r = STORE.getItem('vhc_nfc_received'); return r ? JSON.parse(r) : []; }
function saveNfcReceived(list) { STORE.setItem('vhc_nfc_received', JSON.stringify(list)); }
function shortenHash(h, len = 8) { if (!h || h.length <= len*2) return h||'-'; return h.substring(0,len)+'...'+h.substring(h.length-len); }

async function nfcPayP2p(cardId) {
  const Nfc = Capacitor.Plugins.CapacitorNfc;
  if (!Nfc) { toast('NFC not available'); return; }
  if (nfcScanning || nfcShareActive) { toast('NFC busy...'); return; }

  const cards = loadPaymentCards();
  const c = cards.find(x => x.id === cardId);
  if (!c) { toast('Card not found'); return; }
  if (c.status !== 'active') { toast('Card is frozen'); return; }

  const pin = prompt('Enter card PIN to authorize NFC payment:');
  if (!pin || pin !== c.pin) { toast('Wrong PIN'); return; }

  const amtStr = prompt('Amount in VHC (max ' + c.balance.toFixed(2) + '):');
  const amt = parseFloat(amtStr);
  if (!amt || amt <= 0 || amt > c.balance) { toast('Invalid amount'); return; }

  // Deduct from card balance
  c.balance -= amt;
  savePaymentCards(cards);
  showCards();

  // Record sent transfer
  const transfer = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    to: '(via NFC)',
    amount: amt,
    cardId: cardId,
    status: 'pending',
    ts: Date.now()
  };
  const sent = loadNfcSent();
  sent.unshift(transfer);
  saveNfcSent(sent);

  nfcShareActive = true;
  const encoder = new TextEncoder();
  const payData = JSON.stringify({ type: 'vhcpay', sender: wallet, amount: amt, card: cardId, code: transfer.id, ts: Date.now() });
  const payBytes = [].slice.call(encoder.encode(payData));
  const langBytes = [0x65, 0x6E];
  const payload = [0x02].concat(langBytes).concat(payBytes);

  toast('\uD83D\uDCF1 Tap phone to receiver...');

  try {
    await Nfc.share({
      records: [{ tnf: 1, type: [0x54], id: [0x04], payload }],
      message: payData
    });
    // Auto-stop after 30s
    nfcShareTimeout = setTimeout(async () => {
      if (nfcShareActive) {
        try { await Nfc.unshare(); } catch(e) {}
        nfcShareActive = false;
        transfer.status = 'expired';
        // Refund card
        c.balance += amt;
        savePaymentCards(cards);
        showCards();
        toast('\u23F0 NFC payment expired. Balance refunded.');
      }
    }, 30000);
  } catch(e) {
    nfcShareActive = false;
    // Refund
    c.balance += amt;
    savePaymentCards(cards);
    showCards();
    toast('NFC error: ' + e.message);
  }
}

async function nfcReceive() {
  const Nfc = Capacitor.Plugins.CapacitorNfc;
  if (!Nfc) { toast('NFC not available'); return; }
  if (nfcScanning) { toast('Already receiving...'); return; }
  if (nfcShareActive) { toast('Stop sending first'); return; }

  nfcScanning = true;
  document.getElementById('nfcReceiveStatus').style.display = 'block';
  document.getElementById('nfcReceiveStatus').textContent = '\uD83D\uDCF1 Waiting for NFC payment...';
  toast('Waiting for NFC payment...');

  try {
    const removeListener = await Nfc.addListener('ndefDiscovered', async (event) => {
      try { await Nfc.stopScanning(); } catch(e) {}
      nfcScanning = false;
      removeListener();
      document.getElementById('nfcReceiveStatus').style.display = 'none';

      let payData = null;
      try {
        const tag = event.tag || {};
        if (tag.ndefMessage) {
          for (const r of tag.ndefMessage) {
            if (r.payload) {
              const payload = typeof r.payload === 'string' ? r.payload : String.fromCharCode.apply(null, new Uint8Array(r.payload));
              const clean = payload.replace(/[^a-zA-Z0-9_{}\[\]:,\"\-\.]/g, '');
              if (clean.includes('"vhcpay"') || clean.includes('"type":"vhcpay"')) {
                payData = JSON.parse(clean);
                break;
              }
            }
          }
        }
        if (!payData) {
          const m = JSON.stringify(event).match(/\{"type":"vhcpay".*?\}/);
          if (m) payData = JSON.parse(m[0]);
        }
      } catch(e) {}

      if (payData && payData.sender && payData.amount > 0) {
        if (payData.sender === wallet) {
          toast('Cannot receive from yourself');
          return;
        }
        if (!confirm('Accept ' + payData.amount.toFixed(2) + ' VHC from\n' + shortenHash(payData.sender, 12) + '?')) {
          toast('Payment declined');
          return;
        }
        // Record received transfer
        const rec = {
          id: payData.code || Date.now().toString(36),
          from: payData.sender,
          amount: payData.amount,
          cardId: payData.card || '-',
          ts: Date.now()
        };
        const recv = loadNfcReceived();
        recv.unshift(rec);
        saveNfcReceived(recv);

        // Pre-fill send form for returning or sending onward
        document.getElementById('sendAddr').value = payData.sender;
        document.getElementById('sendAmount').value = payData.amount.toFixed(2);
        document.getElementById('sendNote').value = 'NFC received payment';
        document.querySelector('[data-page="pageSend"]').click();
        toast('\u2714 Received ' + payData.amount.toFixed(2) + ' VHC via NFC!');
      } else {
        toast('Invalid NFC payment data');
      }
    });

    await Nfc.startScanning();
  } catch(e) {
    nfcScanning = false;
    document.getElementById('nfcReceiveStatus').style.display = 'none';
    toast('NFC error: ' + e.message);
  }
}

function nfcCancel() {
  if (nfcShareActive) {
    clearTimeout(nfcShareTimeout);
    nfcShareActive = false;
    try {
      const Nfc = Capacitor.Plugins.CapacitorNfc;
      if (Nfc) Nfc.unshare();
    } catch(e) {}
    toast('NFC sending cancelled');
  }
  if (nfcScanning) {
    nfcScanning = false;
    document.getElementById('nfcReceiveStatus').style.display = 'none';
    try {
      const Nfc = Capacitor.Plugins.CapacitorNfc;
      if (Nfc) Nfc.stopScanning();
    } catch(e) {}
    toast('NFC receiving cancelled');
  }
}

function showNfcHistory() {
  const sent = loadNfcSent();
  const recv = loadNfcReceived();
  const el = document.getElementById('nfcHistory');
  if (!sent.length && !recv.length) {
    el.innerHTML = '<div class="empty">No NFC transfers yet</div>';
    return;
  }
  let html = '';
  for (const t of sent) {
    const ago = Math.floor((Date.now() - t.ts) / 1000);
    const label = ago < 60 ? ago + 's ago' : Math.floor(ago/60) + 'm ago';
    html += '<div class="nfc-item sent"><span class="nfc-arrow">\u2191</span> <b>-' + t.amount.toFixed(2) + '</b> VHC <span class="nfc-meta">' + t.status + ' ' + label + '</span></div>';
  }
  for (const t of recv) {
    const ago = Math.floor((Date.now() - t.ts) / 1000);
    const label = ago < 60 ? ago + 's ago' : Math.floor(ago/60) + 'm ago';
    html += '<div class="nfc-item received"><span class="nfc-arrow">\u2193</span> <b>+' + t.amount.toFixed(2) + '</b> VHC <span class="nfc-meta">from ' + shortenHash(t.from, 8) + ' ' + label + '</span></div>';
  }
  el.innerHTML = html;
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
  if (document.getElementById('mainApp').classList.contains('active')) {
    loadDashboard();
  }
}, 15000);
