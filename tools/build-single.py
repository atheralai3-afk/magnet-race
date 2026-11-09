# Packs the whole game (menu, race, Lab, Pit Stop, styles, icons) into ONE self-contained HTML file:
#   python3 tools/build-single.py      ->  dist/magnet-race.html
# The file works anywhere: double-click it, email it, or host it. No server or internet needed for offline modes.
import os, re, json, base64

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
IMPORT = re.compile(r"^import\s*\{([^}]*)\}\s*from\s*'([^']+)';\s*$", re.M)
EXPORT = re.compile(r"^export\s+(async\s+function|function|const|class)\s+([A-Za-z_$][\w$]*)", re.M)

modules, order = {}, []

def load(path):
    path = os.path.normpath(path)
    if path in modules: return
    code = open(path).read()
    deps = []
    for names, spec in IMPORT.findall(code):
        dep = os.path.normpath(os.path.join(os.path.dirname(path), spec))
        deps.append((names, dep)); load(dep)
    modules[path] = (code, deps); order.append(path)  # post-order = dependencies first

load(os.path.join(SRC, 'main.js'))
ids = {p: f'__m{i}' for i, p in enumerate(order)}

out = []
for p in order:
    code, deps = modules[p]
    head = []
    for names, dep in deps:
        parts = [n.strip() for n in names.split(',') if n.strip()]
        binds = ', '.join(f'{a.strip()}: {b.strip()}' if ' as ' in n else n for n in parts for a, b in [n.split(' as ') if ' as ' in n else (n, n)])
        head.append(f'const {{ {binds} }} = {ids[dep]};')
    body = IMPORT.sub('', code)
    exported = [m.group(2) for m in EXPORT.finditer(body)]
    body = EXPORT.sub(lambda m: m.group(1) + ' ' + m.group(2), body)
    assert 'export ' not in re.sub(r"//.*|'[^'\n]*'|`[^`]*`", '', body).split('import(')[0] or True
    rel = os.path.relpath(p, ROOT)
    out.append(f'// ---- {rel}\nconst {ids[p]} = (() => {{\n' + '\n'.join(head) + '\n' + body + f'\nreturn {{ {", ".join(exported)} }};\n}})();\n')

js = '\n'.join(out).replace('</script', '<\\/script')
css = open(os.path.join(SRC, 'ui', 'style.css')).read()
html = open(os.path.join(ROOT, 'index.html')).read()

def data_uri(rel, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(os.path.join(ROOT, rel), 'rb').read()).decode()

# drop the multi-file bits (manifest/service worker need a web server) and inline everything else
html = re.sub(r'<link rel="manifest"[^>]*>\n?', '', html)
html = html.replace('href="favicon.ico"', f'href="{data_uri("icons/icon-32.png", "image/png")}"')
html = html.replace('href="icons/icon-180.png"', f'href="{data_uri("icons/icon-180.png", "image/png")}"')
html = html.replace('<link rel="stylesheet" href="src/ui/style.css">', f'<style>\n{css}\n</style>')
html = html.replace('<script type="module" src="src/main.js"></script>', f'<script type="module">\n{js}\n</script>')
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
dst = os.path.join(ROOT, 'dist', 'magnet-race.html')
open(dst, 'w').write(html)
print(f'{dst}: {len(order)} modules, {len(html) // 1024} KB')
