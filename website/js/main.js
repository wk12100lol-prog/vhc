// Vex Hack Coin (VHC) - Glowny skrypt JavaScript
// Wersja: 1.0.1

const API_URL = '/api';

function $(id) { return document.getElementById(id); }

function showError(msg) {
    const el = $('formError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideError() {
    const el = $('formError');
    if (el) el.style.display = 'none';
}

function showSuccess(msg) {
    const el = $('formSuccess');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideSuccess() {
    const el = $('formSuccess');
    if (el) el.style.display = 'none';
}

function formatAmount(n) {
    return parseFloat(n || 0).toFixed(8);
}

function formatDate(ts) {
    if (!ts) return '-';
    const d = new Date(parseInt(ts) * 1000);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('pl-PL');
}

function shortenHash(hash, len = 8) {
    if (!hash || hash.length <= len * 2) return hash || '-';
    return hash.substring(0, len) + '...' + hash.substring(hash.length - len);
}

function showAlert(msg, type) {
    const el = $('alertMessage');
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.className = 'alert alert-' + (type || 'success');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function getToken() {
    return localStorage.getItem('vhc_token') || sessionStorage.getItem('vhc_token');
}

function getWallet() {
    const store = getTokenStore();
    return store.getItem('vhc_wallet');
}

function getTokenStore() {
    return localStorage.getItem('vhc_remember') === 'true' ? localStorage : sessionStorage;
}

function requireAuth() {
    if (!getToken()) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

async function apiCall(endpoint, data) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const url = API_URL.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            let msg;
            try { const j = JSON.parse(text); msg = j.error || text; }
            catch (e) { msg = text || 'HTTP ' + res.status; }
            return { success: false, error: msg };
        }

        return await res.json();
    } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') {
            return { success: false, error: 'Przekroczono limit czasu polaczenia' };
        }
        return { success: false, error: 'Blad polaczenia: ' + e.message };
    }
}

async function register() {
    hideError(); hideSuccess();

    const login = ($('regLogin')?.value || '').trim();
    const email = ($('regEmail')?.value || '').trim();
    const password = $('regPassword')?.value;
    const confirm = $('regConfirm')?.value;

    if (!login || !email || !password || !confirm) {
        showError('Wypelnij wszystkie pola');
        return;
    }
    if (password !== confirm) {
        showError('Hasla nie sa zgodne');
        return;
    }
    if (password.length < 6) {
        showError('Haslo musi miec co najmniej 6 znakow');
        return;
    }

    $('regBtn').disabled = true;
    $('regBtn').textContent = 'Rejestracja...';

    const result = await apiCall('register.php', { login, email, password });

    $('regBtn').disabled = false;
    $('regBtn').textContent = 'Zaloz konto';

    if (result.success) {
        showSuccess('Konto utworzone! Adres portfela: ' + result.wallet + '. Za chwile nastapi przekierowanie.');
        setTimeout(() => { window.location.href = '/login'; }, 2000);
    } else {
        showError(result.error || 'Blad rejestracji');
    }
}

async function login() {
    hideError();

    const loginVal = ($('loginUser')?.value || '').trim();
    const password = $('loginPassword')?.value;
    const remember = $('rememberMe')?.checked || false;

    if (!loginVal || !password) {
        showError('Wypelnij wszystkie pola');
        return;
    }

    $('loginBtn').disabled = true;
    $('loginBtn').textContent = 'Logowanie...';

    const result = await apiCall('login.php', { login: loginVal, password });

    $('loginBtn').disabled = false;
    $('loginBtn').textContent = 'Zaloguj sie';

    if (result.success && result.user) {
        const store = remember ? localStorage : sessionStorage;
        store.setItem('vhc_token', result.token);
        store.setItem('vhc_wallet', result.user.wallet || '');
        store.setItem('vhc_login', result.user.login || '');
        if (remember) {
            localStorage.setItem('vhc_remember', 'true');
            localStorage.setItem('vhc_saved_login', loginVal);
        } else {
            localStorage.removeItem('vhc_remember');
            localStorage.removeItem('vhc_saved_login');
        }
        window.location.href = '/dashboard';
    } else {
        showError(result.error || 'Blad logowania');
    }
}

function logout() {
    localStorage.removeItem('vhc_token');
    localStorage.removeItem('vhc_wallet');
    localStorage.removeItem('vhc_login');
    localStorage.removeItem('vhc_remember');
    sessionStorage.removeItem('vhc_token');
    sessionStorage.removeItem('vhc_wallet');
    sessionStorage.removeItem('vhc_login');
    window.location.href = '/';
}

async function loadDashboard() {
    if (!requireAuth()) return;

    const store = getTokenStore();
    const wallet = getWallet();
    const loginName = store.getItem('vhc_login');

    if (!wallet) {
        showAlert('Nie znaleziono adresu portfela. Zaloguj sie ponownie.', 'error');
        setTimeout(logout, 2000);
        return;
    }

    if ($('userLogin')) $('userLogin').textContent = loginName || 'U\u017Cytkownik';
    if ($('walletShort') && wallet) $('walletShort').textContent = wallet.length > 14 ? wallet.substring(0, 12) + '...' : wallet;

    const [userData, txData, blockData, blockchainInfo] = await Promise.all([
        apiCall('user.php', { wallet }),
        apiCall('transactions.php', { wallet, limit: 20 }),
        apiCall('latestblock.php', {}),
        apiCall('blockchain.php', { action: 'info' })
    ]);

    if (userData.success && userData.user) {
        const u = userData.user;
        if ($('balanceAmount')) $('balanceAmount').textContent = formatAmount(u.balance) + ' VHC';
        if ($('walletAddress')) $('walletAddress').textContent = u.wallet || '-';
        if ($('blocksMined')) $('blocksMined').textContent = u.blocks_mined || 0;
        if ($('txCount')) $('txCount').textContent = u.transactions_count || 0;
        const copyBtn = document.querySelector('.copy-btn');
        if (copyBtn && u.wallet) copyBtn.dataset.copy = u.wallet;
    }

    if (blockData.success && blockData.block && $('latestBlockInfo')) {
        const b = blockData.block;
        $('latestBlockInfo').innerHTML = `
            <div class="block-item">
                <div class="block-header">
                    <span class="block-number">Blok #${b.block_index ?? '?'}</span>
                    <span class="badge badge-success">Potwierdzony</span>
                </div>
                <div class="block-hash">${b.current_hash || '-'}</div>
                <div class="block-meta">
                    <span>Gornik: ${shortenHash(b.miner, 12)}</span>
                    <span>Trudnosc: ${b.difficulty ?? '?'}</span>
                    <span>Nonce: ${b.nonce ?? '?'}</span>
                </div>
            </div>
        `;
    }

    if (blockchainInfo.success && blockchainInfo.data) {
        const d = blockchainInfo.data;
        if ($('statBlocks')) $('statBlocks').textContent = d.block_count ?? '?';
        if ($('statDifficulty')) $('statDifficulty').textContent = d.current_difficulty ?? '?';
        if ($('chainSupply')) $('chainSupply').textContent = formatAmount(d.total_supply) + ' VHC';
        if ($('chainMiners')) $('chainMiners').textContent = d.active_miners ?? '?';
        if ($('chainBlocksHour')) $('chainBlocksHour').textContent = d.blocks_last_hour ?? '?';
        if ($('chainTxCount')) $('chainTxCount').textContent = d.transaction_count ?? '?';
        const spinner = $('chainInfo')?.querySelector('.spinner');
        if (spinner) spinner.style.display = 'none';
        const content = $('chainInfoContent');
        if (content) content.style.display = 'block';
    }

    if (txData.success && $('txTableBody')) {
        const tbody = $('txTableBody');
        tbody.innerHTML = '';

        if (!txData.transactions || txData.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Brak transakcji</td></tr>';
        } else {
            txData.transactions.forEach(tx => {
                const isSend = tx.sender === wallet;
                const amount = parseFloat(tx.amount);
                const sign = isSend ? '-' : '+';
                const color = isSend ? 'var(--danger)' : 'var(--accent)';
                const other = isSend ? tx.receiver : tx.sender;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${formatDate(tx.timestamp)}</td>
                    <td class="text-mono">${shortenHash(other, 12)}</td>
                    <td style="color:${color};font-weight:600">${sign} ${formatAmount(amount)} VHC</td>
                    <td><span class="badge badge-success">Potwierdzona</span></td>
                `;
                tbody.appendChild(row);
            });
        }
    }

    if ($('loadingSpinner')) $('loadingSpinner').style.display = 'none';
}

async function sendCoins() {
    hideError();
    if (!requireAuth()) return;

    const receiver = ($('sendReceiver')?.value || '').trim();
    const amount = parseFloat($('sendAmount')?.value);
    const password = $('sendPassword')?.value;

    if (!receiver || !amount || amount <= 0 || !password) {
        showAlert('Wypelnij wszystkie pola (w tym haslo)', 'error');
        return;
    }

    $('sendBtn').disabled = true;
    $('sendBtn').textContent = 'Wysylanie...';

    const result = await apiCall('transfer.php', {
        sender: getWallet(),
        receiver,
        amount,
        password
    });

    $('sendBtn').disabled = false;
    $('sendBtn').textContent = 'Wyslij VHC';

    if (result.success) {
        showAlert('Transakcja utworzona! Oczekuje na potwierdzenie w bloku.', 'success');
        if ($('sendReceiver')) $('sendReceiver').value = '';
        if ($('sendAmount')) $('sendAmount').value = '';
        if ($('sendPassword')) $('sendPassword').value = '';
        setTimeout(loadDashboard, 2000);
    } else {
        showAlert(result.error || 'Blad transakcji', 'error');
    }
}

async function loadBlockchain() {
    const result = await apiCall('blockchain.php', { action: 'blocks', limit: 30, offset: 0 });

    if (result.success && $('blocksList')) {
        const container = $('blocksList');
        container.innerHTML = '';

        if (!result.blocks || result.blocks.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">Brak blokow do wyswietlenia</p>';
        } else {
            result.blocks.forEach(b => {
                const div = document.createElement('div');
                div.className = 'block-item';
                const date = formatDate(b.timestamp);
                div.innerHTML = `
                    <div class="block-header">
                        <span class="block-number">Blok #${b.block_index ?? '?'}</span>
                        <span class="badge badge-success">${date}</span>
                    </div>
                    <div class="block-hash">Hash: ${b.current_hash || '-'}</div>
                    <div class="block-meta">
                        <span>Poprzedni: ${shortenHash(b.previous_hash, 10)}</span>
                        <span>Gornik: ${shortenHash(b.miner, 10)}</span>
                        <span>Trudnosc: ${b.difficulty ?? '?'}</span>
                        <span>Nonce: ${b.nonce ?? '?'}</span>
                        <span>Nagroda: ${formatAmount(b.reward)} VHC</span>
                    </div>
                `;
                container.appendChild(div);
            });
        }
    } else if (!result.success) {
        const container = $('blocksList');
        if (container) container.innerHTML = '<p style="color:var(--danger);text-align:center;padding:24px;">Blad ladowania blokow: ' + (result.error || 'nieznany blad') + '</p>';
    }

    if ($('blockLoading')) $('blockLoading').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('dashboardPage')) {
        loadDashboard();
        let dashboardInterval = setInterval(loadDashboard, 15000);
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                clearInterval(dashboardInterval);
            } else {
                dashboardInterval = setInterval(loadDashboard, 15000);
            }
        });
    }

    if (document.getElementById('explorerPage')) {
        loadBlockchain();
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const saved = localStorage.getItem('vhc_saved_login');
        if (saved && $('loginUser')) {
            $('loginUser').value = saved;
        }
        loginForm.addEventListener('submit', function(e) { e.preventDefault(); login(); });
    }

    const regForm = document.getElementById('registerForm');
    if (regForm) {
        regForm.addEventListener('submit', function(e) { e.preventDefault(); register(); });
    }

    const sendForm = document.getElementById('sendForm');
    if (sendForm) {
        sendForm.addEventListener('submit', function(e) { e.preventDefault(); sendCoins(); });
    }

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.dataset.copy;
            if (text && text !== '-') {
                navigator.clipboard.writeText(text).then(() => {
                    const orig = this.textContent;
                    this.textContent = 'Skopiowano!';
                    setTimeout(() => { this.textContent = orig; }, 2000);
                }).catch(() => {});
            }
        });
    });

    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', function(e) { e.preventDefault(); logout(); });
    });



    // Ladowanie nagrod w dashboardzie
    if (document.getElementById('dashboardPage') && document.getElementById('rewardsList')) {
        loadRewards();
    }
});

// -------------------------------------------------------
// Nagrody
// -------------------------------------------------------
async function loadRewards() {
    const container = document.getElementById('rewardsList');
    if (!container) return;

    const result = await apiCall('rewards.php', { action: 'list' });
    if (!result.success || !result.rewards || result.rewards.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:16px;">Brak dostepnych nagrod</p>';
        return;
    }

    container.innerHTML = '';
    result.rewards.forEach(r => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid rgba(30,41,59,0.5);';
        div.innerHTML = `
            <div>
                <strong>${r.title}</strong>
                <div style="font-size:13px;color:var(--text-muted);">${r.description || ''} (${r.stock - r.claimed}/${r.stock} szt.)</div>
            </div>
            <div style="text-align:right;">
                <div style="color:var(--accent);font-weight:600;">${parseFloat(r.vhc_required).toFixed(2)} VHC</div>
                <button class="btn btn-primary btn-sm" onclick="claimReward(${r.id})" style="margin-top:4px;">Odbierz</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function claimReward(rewardId) {
    if (!requireAuth()) return;
    const wallet = getWallet();
    if (!wallet) return;

    if (!confirm('Odebrać nagrodę? VHC zostanie odjęte z salda.')) return;

    const result = await apiCall('rewards.php', { action: 'claim', reward_id: rewardId, wallet });
    if (result.success) {
        alert(result.message);
        loadRewards();
        loadDashboard();
    } else {
        alert(result.error || 'Blad');
    }
}


