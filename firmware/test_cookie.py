import urllib.request

# Test 1: Without cookie
print("=== Test 1: No cookie ===")
req = urllib.request.Request('https://vexcoin.xo.je/api/mine.php?action=get_job&wallet=VHCd0976bbaa30832e14dfcbd11f4c40bbe',
    headers={'User-Agent': 'Mozilla/5.0'})
try:
    resp = urllib.request.urlopen(req, timeout=15)
    print(f"Status: {resp.status}")
    print(f"Body: {resp.read().decode()[:500]}")
except Exception as e:
    print(f"Error: {e}")

# Test 2: With the raw AES decrypted cookie
print("\n=== Test 2: With raw cookie ===")
req2 = urllib.request.Request('https://vexcoin.xo.je/api/mine.php?action=get_job&wallet=VHCd0976bbaa30832e14dfcbd11f4c40bbe',
    headers={
        'User-Agent': 'Mozilla/5.0',
        'Cookie': '__test=ac2767bfd10a96a9c2a4bbe6b2d59359'
    })
try:
    resp2 = urllib.request.urlopen(req2, timeout=15)
    print(f"Status: {resp2.status}")
    print(f"Body: {resp2.read().decode()[:500]}")
except Exception as e:
    print(f"Error: {e}")

# Test 3: POST instead of GET
print("\n=== Test 3: POST with raw cookie ===")
data = 'action=get_job&wallet=VHCd0976bbaa30832e14dfcbd11f4c40bbe'
req3 = urllib.request.Request('https://vexcoin.xo.je/api/mine.php',
    data=data.encode(),
    headers={
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': '__test=ac2767bfd10a96a9c2a4bbe6b2d59359'
    })
try:
    resp3 = urllib.request.urlopen(req3, timeout=15)
    print(f"Status: {resp3.status}")
    print(f"Body: {resp3.read().decode()[:500]}")
except Exception as e:
    print(f"Error: {e}")
