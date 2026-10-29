"""Simple duplicate/plagiarism check using word-shingle Jaccard similarity.
Usage: python similarity.py paper1.txt paper2.txt   (plain-text versions of the papers)"""
import re, sys

def shingles(text, k=5):
    w = re.findall(r"\w+", text.lower())
    return {" ".join(w[i:i + k]) for i in range(max(len(w) - k + 1, 1))}

if len(sys.argv) != 3:
    sys.exit("Usage: python similarity.py a.txt b.txt")
a, b = (shingles(open(p, encoding="utf-8", errors="ignore").read()) for p in sys.argv[1:3])
score = len(a & b) / len(a | b) if (a | b) else 0
print(f"Similarity: {score:.1%}")
print("Possible duplicate / plagiarism - review manually" if score > 0.5 else "Looks distinct")
