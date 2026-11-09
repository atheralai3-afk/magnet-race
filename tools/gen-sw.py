# Regenerates the file list in sw.js after adding/removing source files: python3 tools/gen-sw.py
import os, json, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = ["./", "index.html", "manifest.webmanifest", "favicon.ico"] + [os.path.relpath(os.path.join(d, f), root) for d, _, fs in os.walk(os.path.join(root, "src")) for f in fs] + ["icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"]
p = os.path.join(root, "sw.js"); s = open(p).read()
s = re.sub(r"const SHELL = \[.*?\];", "const SHELL = " + json.dumps(sorted(files), indent=1) + ";", s, flags=re.S)
v = int(re.search(r"'mr-v(\d+)'", s).group(1)) + 1
s = re.sub(r"'mr-v\d+'", f"'mr-v{v}'", s)
open(p, "w").write(s); print("sw.js updated:", len(files), "files, cache", v)
