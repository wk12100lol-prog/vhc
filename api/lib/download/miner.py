#!/usr/bin/env python3
# Vex Hack Coin (VHC) - Miner terminalowy
# Version: 2.0.0

import hashlib
import json
import threading
import time
import sys
import os
import re
import argparse
from datetime import datetime

# Biblioteki AES
_HAS_CRYPTO = False
try:
    from Crypto.Cipher import AES
    _HAS_CRYPTO = True
except ImportError:
    pass

import urllib.request
import urllib.error
import urllib.parse
import http.cookiejar


# ANSI kolory
class C:
    GRAY = '\033[90m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'
    CLR = '\033[2K'


class MiningEngine:
    @staticmethod
    def calculate_hash(block_index, previous_hash, timestamp, transactions_json,
                       miner, reward, difficulty, nonce):
        header = f"{block_index}|{previous_hash}|{timestamp}|{transactions_json}|{miner}|{reward}|{difficulty}|{nonce}"
        return hashlib.sha256(header.encode('utf-8')).hexdigest()

    @staticmethod
    def is_valid_hash(hash_hex, difficulty):
        if difficulty <= 0:
            return True
        return hash_hex.startswith("0" * difficulty)

    @staticmethod
    def mine_job(job, start_nonce=0, batch_callback=None, stop_event=None, hash_delay=0):
        nonce = start_nonce
        hashes_count = 0
        timestamp = job.get('timestamp', int(time.time()))

        block_index = job.get('block_index')
        previous_hash = job.get('previous_hash', '')
        transactions_json = json.dumps(job.get('transactions', []), separators=(',', ':'))
        miner = job.get('miner', '')
        reward = job.get('reward', 1)
        difficulty = job.get('difficulty', 1)

        if block_index is None or previous_hash is None:
            return None, None, None, hashes_count

        while True:
            if stop_event and stop_event.is_set():
                return None, None, None, hashes_count

            hash_hex = MiningEngine.calculate_hash(
                block_index, previous_hash, timestamp, transactions_json,
                miner, reward, difficulty, nonce
            )
            hashes_count += 1

            if MiningEngine.is_valid_hash(hash_hex, difficulty):
                return nonce, hash_hex, timestamp, hashes_count

            nonce += 1

            if hash_delay:
                time.sleep(hash_delay)

            if batch_callback and hashes_count % 10000 == 0:
                if batch_callback(nonce, hashes_count):
                    return None, None, None, hashes_count


class InfinityFreeChallengeSolver:
    def __init__(self):
        self._cookie_name = ''
        self._cookie_value = ''
        self._solved = False

    def is_challenge(self, text):
        return 'aes.js' in text[:1000] and 'slowAES' in text[:2000]

    def solve_from_html(self, html):
        try:
            nums = re.findall(r'toNumbers\("([0-9a-f]+)"\)', html)
            if len(nums) < 3:
                return None, None
            a_hex, b_hex, c_hex = nums[0], nums[1], nums[2]

            m = re.search(r'document\.cookie\s*=\s*"([^=]+)=', html)
            cookie_name = m.group(1) if m else '__test'
        except Exception:
            return None, None

        try:
            key = bytes.fromhex(a_hex)
            iv = bytes.fromhex(b_hex)
            ct = bytes.fromhex(c_hex)
            if len(key) not in (16, 24, 32) or len(iv) != 16:
                return None, None
        except Exception:
            return None, None

        if not _HAS_CRYPTO:
            return None, None

        try:
            cipher = AES.new(key, AES.MODE_CBC, iv=iv)
            decrypted = cipher.decrypt(ct)
            pad_len = decrypted[-1]
            if 1 <= pad_len <= 16:
                decrypted = decrypted[:-pad_len]
            cookie_value = decrypted.hex()
        except Exception:
            return None, None

        return cookie_name, cookie_value

    def ensure_session(self, base_url):
        if self._solved:
            return True

        try:
            req = urllib.request.Request(
                base_url + '/api/test.php',
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                html = resp.read().decode('utf-8', errors='replace')
        except Exception:
            return False

        if not self.is_challenge(html):
            self._solved = True
            return True

        name, value = self.solve_from_html(html)
        if name and value:
            self._cookie_name = name
            self._cookie_value = value
            self._solved = True
            return True

        return False

    def get_cookie_header(self):
        if self._solved and self._cookie_name and self._cookie_value:
            return f"{self._cookie_name}={self._cookie_value}"
        return ''


class NetworkManager:
    def __init__(self, server_url):
        self.server_url = server_url.rstrip('/')
        self._solver = InfinityFreeChallengeSolver()
        self._cj = http.cookiejar.CookieJar()
        self._opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self._cj)
        )

    def _request(self, endpoint, data=None):
        if not self._solver._solved:
            if not self._solver.ensure_session(self.server_url):
                return {'success': False, 'error': 'Nie udalo sie rozwiazac challenge'}

        url = f"{self.server_url}/{endpoint}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
        }

        cookie_h = self._solver.get_cookie_header()
        if cookie_h:
            headers['Cookie'] = cookie_h

        try:
            if data is not None:
                post_data = urllib.parse.urlencode(data).encode('utf-8')
                req = urllib.request.Request(url, data=post_data,
                    headers={**headers, 'Content-Type': 'application/x-www-form-urlencoded'})
            else:
                req = urllib.request.Request(url, headers=headers)

            with self._opener.open(req, timeout=60) as response:
                raw = response.read()

            if not raw or raw.strip() == b'':
                return {'success': False, 'error': 'Pusta odpowiedz'}

            text = raw.decode('utf-8', errors='replace')

            if self._solver.is_challenge(text):
                self._solver._solved = False
                self._solver.ensure_session(self.server_url)
                cookie_h = self._solver.get_cookie_header()
                if cookie_h:
                    headers['Cookie'] = cookie_h
                if data is not None:
                    post_data = urllib.parse.urlencode(data).encode('utf-8')
                    req = urllib.request.Request(url, data=post_data,
                        headers={**headers, 'Content-Type': 'application/x-www-form-urlencoded'})
                else:
                    req = urllib.request.Request(url, headers=headers)
                with self._opener.open(req, timeout=60) as response:
                    raw = response.read()
                text = raw.decode('utf-8', errors='replace')
                if self._solver.is_challenge(text):
                    return {'success': False, 'error': 'Nie udalo sie ominac anty-bota'}

            return json.loads(text)

        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode('utf-8', errors='replace')
                return json.loads(body)
            except:
                return {'success': False, 'error': f'HTTP {e.code}: {e.reason}'}
        except urllib.error.URLError as e:
            return {'success': False, 'error': f'Blad polaczenia: {e.reason}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_job(self, wallet):
        return self._request('mine.php', {'action': 'get_job', 'wallet': wallet})

    def submit_block(self, block_data):
        return self._request('mine.php', {'action': 'submit_block', 'block': json.dumps(block_data)})

    def register_miner(self, wallet):
        return self._request('miner.php', {'action': 'register', 'wallet': wallet})

    def ping(self, wallet, hashrate):
        return self._request('miner.php', {'action': 'ping', 'wallet': wallet, 'hashrate': hashrate})


def log(msg, level='info'):
    ts = datetime.now().strftime('%H:%M:%S')
    colors = {'info': '', 'ok': C.GREEN, 'warn': C.YELLOW, 'err': C.RED, 'block': C.CYAN}
    prefixes = {'info': '  .', 'ok': '[OK]', 'warn': '[..]', 'err': '[!!]', 'block': '[##]'}
    c = colors.get(level, '')
    p = prefixes.get(level, ' .')
    bold = C.BOLD if level == 'block' else ''
    print(f"{C.GRAY}{ts}{C.RESET} {c}{bold}{p}{C.RESET} {msg}")


def main():
    parser = argparse.ArgumentParser(description='Vex Hack Coin - Terminal Miner')
    parser.add_argument('-s', '--server', help='URL serwera API')
    parser.add_argument('-w', '--wallet', help='Adres portfela VHC')
    parser.add_argument('-d', '--delay', type=float, help='Opóźnienie między hash-ami (s)')
    parser.add_argument('--save', action='store_true', help='Zapisz ustawienia i wyjdź')
    args = parser.parse_args()

    settings_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'miner_settings.json')
    settings = {}

    if os.path.exists(settings_file):
        try:
            with open(settings_file) as f:
                settings = json.load(f)
        except:
            pass

    if args.server:
        settings['server_url'] = args.server
    if args.wallet:
        settings['wallet'] = args.wallet
    if args.delay is not None:
        settings['hash_delay'] = args.delay

    if args.save:
        with open(settings_file, 'w') as f:
            json.dump(settings, f)
        print("Ustawienia zapisane.")
        return

    server_url = settings.get('server_url', 'https://vexcoin.xo.je/api')
    wallet = settings.get('wallet', '')
    hash_delay = settings.get('hash_delay', 0.0)

    if not wallet:
        log('Podaj adres portfela: --wallet VHC...', 'err')
        return

    with open(settings_file, 'w') as f:
        json.dump({'server_url': server_url, 'wallet': wallet, 'hash_delay': hash_delay}, f)

    network = NetworkManager(server_url)
    stop_event = threading.Event()
    hash_lock = threading.Lock()
    hash_count = [0]
    blocks_found = [0]
    start_time = time.time()

    log(f'Rozpoczeto kopanie dla {C.BOLD}{wallet}{C.RESET}', 'ok')
    log(f'Serwer: {server_url}', 'info')
    if hash_delay:
        log(f'Opóźnienie: {hash_delay}s', 'info')

    result = network.register_miner(wallet)
    if result.get('success'):
        log('Koparka zarejestrowana', 'ok')
    else:
        log(f'Rejestracja: {result.get("error", "?")}', 'warn')

    def mining_thread():
        nonce_counter = 0
        consecutive_errors = 0
        last_ping = 0

        while not stop_event.is_set():
            job_result = network.get_job(wallet)
            if not job_result.get('success'):
                error = job_result.get('error', '?')
                log(f'Blad: {error}', 'err')
                consecutive_errors += 1
                if consecutive_errors >= 10:
                    log('Zbyt wiele bledow. Stop.', 'err')
                    stop_event.set()
                    break
                time.sleep(5)
                continue

            consecutive_errors = 0
            job = job_result.get('job')
            if not job or not isinstance(job, dict):
                log('Nieprawidlowe zadanie', 'err')
                time.sleep(3)
                continue

            difficulty = job.get('difficulty', 1)
            log(f'Blok #{job.get("block_index", "?")}  trudność: {difficulty}', 'info')

            def batch_cb(nonce, hcount):
                with hash_lock:
                    hash_count[0] += 10000
                return stop_event.is_set()

            result_nonce, result_hash, result_ts, hashes_done = MiningEngine.mine_job(
                job, start_nonce=nonce_counter,
                batch_callback=batch_cb, stop_event=stop_event,
                hash_delay=hash_delay
            )

            with hash_lock:
                hash_count[0] += hashes_done

            if stop_event.is_set():
                break

            if result_nonce is not None:
                blocks_found[0] += 1
                log('=' * 50, 'block')
                log(f'BLOK #{job.get("block_index", "?")} znaleziony! nonce={result_nonce}', 'block')
                log(f'Hash: {result_hash}', 'block')
                log(f'Trudność: {difficulty}', 'block')

                block_data = {
                    'block_index': job.get('block_index'),
                    'previous_hash': job.get('previous_hash'),
                    'timestamp': result_ts,
                    'transactions': job.get('transactions', []),
                    'miner': wallet,
                    'reward': job.get('reward', 1),
                    'difficulty': difficulty,
                    'nonce': result_nonce,
                    'hash': result_hash
                }

                log('Wysylanie...', 'info')
                submit = network.submit_block(block_data)
                if submit.get('success'):
                    log('Blok ZAAKCEPTOWANY!', 'ok')
                else:
                    log(f'Odrzucony: {submit.get("error", "?")}', 'err')
                log('=' * 50, 'block')
                nonce_counter = 0
            else:
                nonce_counter = 0

            now = time.time()
            if now - last_ping >= 30:
                try:
                    elapsed = now - start_time
                    hr = hash_count[0] / elapsed if elapsed > 0 else 0
                    network.ping(wallet, hr)
                except:
                    pass
                last_ping = now

    t = threading.Thread(target=mining_thread, daemon=True)
    t.start()

    # Glowna petla statusu
    try:
        while t.is_alive():
            time.sleep(1)
            elapsed = time.time() - start_time
            with hash_lock:
                hc = hash_count[0]
            hr = hc / elapsed if elapsed > 0 else 0
            if hr >= 1_000_000:
                hr_s = f"{hr/1_000_000:.2f} MH/s"
            elif hr >= 1_000:
                hr_s = f"{hr/1_000:.2f} kH/s"
            else:
                hr_s = f"{hr:.0f} H/s"
            sys.stdout.write(f"\r{C.CLR}{C.GRAY}[{datetime.now().strftime('%H:%M:%S')}] {C.RESET}"
                             f"Hashe: {hc:,}  |  {hr_s}  |  "
                             f"{C.CYAN}Bloki: {blocks_found[0]}{C.RESET}  |  "
                             f"Up: {int(elapsed//3600):02d}:{int(elapsed%3600//60):02d}:{int(elapsed%60):02d}")
            sys.stdout.flush()
    except KeyboardInterrupt:
        print()
        log('Zatrzymywanie...', 'warn')

    stop_event.set()
    t.join(timeout=3)
    log('Koniec', 'ok')


if __name__ == '__main__':
    main()
