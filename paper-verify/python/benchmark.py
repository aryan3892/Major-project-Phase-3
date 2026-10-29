"""Hashing performance and tamper-detection experiment. Run: python benchmark.py"""
import hashlib, os, random, time

def sha(b): return hashlib.sha256(b).hexdigest()

print("\n1) SHA-256 time vs file size")
print(f"{'Size (MB)':>10} | {'Time (ms)':>10}")
for mb in (1, 10, 50):
    data = os.urandom(mb * 1024 * 1024)
    t = time.perf_counter(); sha(data); ms = (time.perf_counter() - t) * 1000
    print(f"{mb:>10} | {ms:>10.2f}")

print("\n2) Tamper detection (flip 1 bit in random 100 KB files)")
trials, detected, diffs = 200, 0, []
for _ in range(trials):
    data = bytearray(os.urandom(100_000)); h1 = sha(bytes(data))
    data[random.randrange(len(data))] ^= 1
    h2 = sha(bytes(data))
    detected += h1 != h2
    diffs.append(bin(int(h1, 16) ^ int(h2, 16)).count("1"))
print(f"Trials: {trials} | Detected: {detected} | Detection rate: {detected / trials:.0%}")
print(f"Avg hash bits changed by a 1-bit edit: {sum(diffs) / len(diffs):.1f} / 256 (ideal ~128)")
