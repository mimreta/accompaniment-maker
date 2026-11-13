#!/usr/bin/env python3
# Copyright (c) 2026 MohammadReza Tayebi. MIT License.
"""Builds the two single-file app pages from src/:
  apps-script/Index.html  (Google Apps Script build)
  index.html              (static web build, served by GitHub Pages)
Edit only files under src/ (and apps-script/Code.gs, relay/Code.gs), then run this."""
import json, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
tok, bun, app = rd('src/tokens.css'), rd('src/bundle.css'), rd('src/app.css')
body, core, js = rd('src/body.html'), rd('src/acccore.html'), rd('src/app.js')
head = '''<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<base target="_top">
<meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<!-- Copyright (c) 2026 MohammadReza Tayebi. MIT License. -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css">
<script>try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<style>
'''
tail = lambda extra: tok + '\n' + bun + '\n' + app + '\n</style>\n</head>\n' + body + '\n' + core + extra + '<script>\n' + js + '</script>\n</body>\n</html>\n'

# Apps Script build
open(os.path.join(R, 'apps-script/Index.html'), 'w', encoding='utf-8').write(head + tail(''))

# Web build: instrument list comes from apps-script/Code.gs
cs = rd('apps-script/Code.gs')
blk = cs[cs.index('var INSTRUMENTS = ['):]
blk = blk[:blk.index('];')]
inst = [{'id': m.group(1), 'label': m.group(2), 'solo': m.group(3)}
        for m in re.finditer(r"id: '([^']+)',\s*label: '([^']+)',.*?solo: '([^']+)'", blk)]
assert len(inst) == 16, len(inst)
webhead = head.replace('<base target="_top">\n',
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>همراهی‌ساز</title>\n'
  '<link rel="icon" type="image/svg+xml" href="icon.svg">\n<link rel="icon" type="image/png" href="icon-192.png">\n'
  '<link rel="apple-touch-icon" href="icon-180.png">\n<link rel="manifest" href="manifest.webmanifest">\n'
  '<meta name="theme-color" content="#14284B">\n')
cfg = '<script src="config.js"></script>\n<script>window.SOLO_INSTRUMENTS=' + json.dumps(inst, ensure_ascii=False) + ';</script>\n'
open(os.path.join(R, 'index.html'), 'w', encoding='utf-8').write(webhead + tail(cfg))
print('built apps-script/Index.html and index.html')
