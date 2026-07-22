# Test AES challenge solver using slowAES algorithm
import re, urllib.request

# ==== slowAES AES implementation in Python ====
sbox = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22]
rsbox = [82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,162,73,109,139,209,37,114,248,246,100,134,104,152,22,212,164,92,204,93,101,182,146,108,112,72,80,253,237,185,218,94,21,70,87,167,141,157,132,144,216,171,0,140,188,211,10,247,228,88,5,184,179,69,6,208,44,30,143,202,63,15,2,193,175,189,3,1,19,138,107,58,145,17,65,79,103,220,234,151,242,207,206,240,180,230,115,150,172,116,34,231,173,53,133,226,249,55,232,28,117,223,110,71,241,26,113,29,41,197,137,111,183,98,14,170,24,190,27,252,86,62,75,198,210,121,32,154,219,192,254,120,205,90,244,31,221,168,51,136,7,199,49,177,18,16,89,39,128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,225,105,20,99,85,33,12,125]
Rcon = [0,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154,47,94,188,99,198,151,53,106,212,179,125,250,239,197,145,57,114,228,211,189,97,194,159,37,74,148,51,102,204,131,29,58,116,232,203,141,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154,47,94,188,99,198,151,53,106,212,179,125,250,239,197,145,57,114,228,211,189,97,194,159,37,74,148,51,102,204,131,29,58,116,232,203,141,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154,47,94,188,99,198,151,53,106,212,179,125,250,239,197,145,57,114,228,211,189,97,194,159,37,74,148,51,102,204,131,29,58,116,232,203]

G2X = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,222,224,226,228,230,232,234,236,238,240,242,244,246,248,250,252,254,27,25,31,29,19,17,23,21,11,9,15,13,3,1,7,5,59,57,63,61,51,49,55,53,43,41,47,45,35,33,39,37,91,89,95,93,83,81,87,85,75,73,79,77,67,65,71,69,123,121,127,125,115,113,119,117,107,105,111,109,99,97,103,101,155,153,159,157,147,145,151,149,139,137,143,141,131,129,135,133,187,185,191,189,179,177,183,181,171,169,175,173,163,161,167,165,219,217,223,221,211,209,215,213,203,201,207,205,195,193,199,197,251,249,255,253,243,241,247,245,235,233,239,237,227,225,231,229]
G3X = [0,3,6,5,12,15,10,9,24,27,30,29,20,23,18,17,48,51,54,53,60,63,58,57,40,43,46,45,36,39,34,33,96,99,102,101,108,111,106,105,120,123,126,125,116,119,114,113,80,83,86,85,92,95,90,89,72,75,78,77,68,71,66,65,192,195,198,197,204,207,202,201,216,219,222,221,212,215,210,209,240,243,246,245,252,255,250,249,232,235,238,237,228,231,226,225,160,163,166,165,172,175,170,169,184,187,190,189,180,183,178,177,144,147,150,149,156,159,154,153,136,139,142,141,132,135,130,129,155,152,157,158,151,148,145,146,131,128,133,134,143,140,137,138,171,168,173,174,167,164,161,162,179,176,181,182,191,188,185,186,251,248,253,254,247,244,241,242,227,224,229,230,239,236,233,234,203,200,205,206,199,196,193,194,211,208,213,214,223,220,217,218,91,88,93,94,87,84,81,82,67,64,69,70,79,76,73,74,107,104,109,110,103,100,97,98,115,112,117,118,127,124,121,122,59,56,61,62,55,52,49,50,35,32,37,38,47,44,41,42,11,8,13,14,7,4,1,2,19,16,21,22,31,28,25,26]

def mul9(x): return G2X[G2X[G2X[x]]] ^ x
def mul11(x): return G2X[G2X[G2X[x]] ^ x] ^ x
def mul13(x): return G2X[G2X[G2X[x] ^ x]] ^ x
def mul14(x): return G2X[G2X[G2X[x] ^ x] ^ x]

def rotate(word):
    return word[1:] + word[:1]

def core(word, i):
    word = rotate(word)
    word = [sbox[b] for b in word]
    word[0] ^= Rcon[i]
    return word

def expand_key(key, key_size):
    n_rounds = {16: 10, 24: 12, 32: 14}[key_size]
    total_len = 16 * (n_rounds + 1)
    exp = [0] * total_len
    for i in range(key_size):
        exp[i] = key[i]
    i = key_size
    n = 1
    while i < total_len:
        temp = exp[i-4:i]
        if i % key_size == 0:
            temp = core(temp, n)
            n += 1
        if key_size == 32 and i % key_size == 16:
            temp = [sbox[b] for b in temp]
        for j in range(4):
            exp[i] = exp[i - key_size] ^ temp[j]
            i += 1
    return exp

def create_round_key(exp_key, offset):
    rk = [0] * 16
    for o in range(4):
        for n in range(4):
            rk[4 * n + o] = exp_key[offset + 4 * o + n]
    return rk

def add_round_key(state, rk):
    return [s ^ r for s, r in zip(state, rk)]

def sub_bytes(state, inv):
    sb = rsbox if inv else sbox
    return [sb[b] for b in state]

def shift_rows(state, inv):
    s = list(state)
    if not inv:
        s[1], s[5], s[9], s[13] = s[5], s[9], s[13], s[1]
        s[2], s[6], s[10], s[14] = s[10], s[14], s[2], s[6]
        s[3], s[7], s[11], s[15] = s[15], s[3], s[7], s[11]
    else:
        s[1], s[5], s[9], s[13] = s[13], s[1], s[5], s[9]
        s[2], s[6], s[10], s[14] = s[10], s[14], s[2], s[6]
        s[3], s[7], s[11], s[15] = s[7], s[11], s[15], s[3]
    return s

def mix_column(col, inv):
    if not inv:
        a0, a1, a2, a3 = col
        return [
            G2X[a0] ^ G3X[a1] ^ a2 ^ a3,
            a0 ^ G2X[a1] ^ G3X[a2] ^ a3,
            a0 ^ a1 ^ G2X[a2] ^ G3X[a3],
            G3X[a0] ^ a1 ^ a2 ^ G2X[a3]
        ]
    else:
        a0, a1, a2, a3 = col
        return [
            mul14(a0) ^ mul11(a1) ^ mul13(a2) ^ mul9(a3),
            mul9(a0) ^ mul14(a1) ^ mul11(a2) ^ mul13(a3),
            mul13(a0) ^ mul9(a1) ^ mul14(a2) ^ mul11(a3),
            mul11(a0) ^ mul13(a1) ^ mul9(a2) ^ mul14(a3)
        ]

def mix_columns(state, inv):
    s = list(state)
    for i in range(4):
        col = [s[4*j + i] for j in range(4)]
        mixed = mix_column(col, inv)
        for j in range(4):
            s[4*j + i] = mixed[j]
    return s

def inv_round(state, rk):
    state = shift_rows(state, True)
    state = sub_bytes(state, True)
    state = add_round_key(state, rk)
    state = mix_columns(state, True)
    return state

def inv_main(state, exp_key, n_rounds):
    state = add_round_key(state, create_round_key(exp_key, 16 * n_rounds))
    for r in range(n_rounds - 1, 0, -1):
        state = inv_round(state, create_round_key(exp_key, 16 * r))
    state = shift_rows(state, True)
    state = sub_bytes(state, True)
    state = add_round_key(state, create_round_key(exp_key, 0))
    return state

def aes_decrypt_block(block, key):
    # block: 16 bytes (list of ints)
    # key: 16 bytes (list of ints)
    key_size = len(key)
    n_rounds = {16: 10, 24: 12, 32: 14}[key_size]
    
    # Column-major state
    state = [0] * 16
    for e in range(4):
        for a in range(4):
            state[e + 4 * a] = block[4 * e + a]
    
    exp_key = expand_key(key, key_size)
    state = inv_main(state, exp_key, n_rounds)
    
    # Row-major output
    out = [0] * 16
    for h in range(4):
        for u in range(4):
            out[4 * h + u] = state[h + 4 * u]
    return out

# ==== CBC decrypt matching slowAES ====
def slowaes_cbc_decrypt(ct_blocks, key, iv):
    result = []
    prev = list(iv)
    for block in ct_blocks:
        dec = aes_decrypt_block(block, key)
        plain = [d ^ p for d, p in zip(dec, prev)]
        result.extend(plain)
        prev = block
    return result

# ==== Test with challenge values ====
a_hex = "f655ba9d09a112d4968c63579db590b4"
b_hex = "98344c2eee86c3994890592585b49f80"
c_hex = "5253b353f9d9082166e1eb1d206cc821"

key = [int(a_hex[i:i+2], 16) for i in range(0, 32, 2)]
iv = [int(b_hex[i:i+2], 16) for i in range(0, 32, 2)]
ct = [int(c_hex[i:i+2], 16) for i in range(0, 32, 2)]

result = slowaes_cbc_decrypt([ct], key, iv)
result_hex = ''.join(f'{b:02x}' for b in result)
print(f'slowAES Python reimplementation:')
print(f'  Raw result: {result_hex}')
print(f'  Length: {len(result)}')
print(f'  Last byte: {result[-1]}')

# slowAES unpadBytesOut logic:
# Only unpads if length > 16
if len(result) > 16:
    t = 0
    r = -1
    for o in range(len(result)-1, max(len(result)-1-16, -1)-1, -1):
        if r == -1:
            r = result[o]
        if result[o] != r:
            t = 0
            break
        t += 1
        if t == r:
            break
    if t > 0:
        result = result[:-t]
    print(f'  Unpadded: {"".join(f"{b:02x}" for b in result)}')

print()
# Compare with PyCryptodome
try:
    from Crypto.Cipher import AES
    cipher = AES.new(bytes.fromhex(a_hex), AES.MODE_CBC, iv=bytes.fromhex(b_hex))
    pt = cipher.decrypt(bytes.fromhex(c_hex))
    print(f'PyCryptodome: {pt.hex()} (len={len(pt)}, last={pt[-1]})')
except ImportError:
    print('PyCryptodome not available')
