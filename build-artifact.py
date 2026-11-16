"""Make the claude.ai-publishable copy of index.html (dist/index.html).

claude.ai wraps a published page in its own <html>/<head>/<body> skeleton,
so this strips ours. nn.js and parse.js are published beside it.
"""
import re, pathlib
src = pathlib.Path(__file__).with_name('index.html').read_text()
out = src
for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'<head>\s*', r'</head>\s*', r'<body>\s*', r'</body>\s*', r'</html>\s*',
            r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*']:
    out = re.sub(pat, '', out, flags=re.I)
dist = pathlib.Path(__file__).with_name('dist'); dist.mkdir(exist_ok=True)
(dist / 'index.html').write_text(out)
print('wrote', dist / 'index.html')
