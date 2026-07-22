import sys
with open(sys.argv[1], 'rb') as f:
    data = f.read()

placeholders = [
    b'S_______________________________',  # SSID 32 B
    b'P______________________________________________________________',  # PASS 63 B
    b'W__________________________________',  # WALLET 35 B
]
for p in placeholders:
    idx = data.find(p)
    if idx >= 0:
        print(f'FOUND: {p[:8]!r}... ({len(p)} B) at 0x{idx:06x}')
        null_ok = data[idx + len(p)] == 0
        print(f'  Null after: {null_ok}')
    else:
        print(f'NOT FOUND: {p[:8]!r}... ({len(p)} B)')
