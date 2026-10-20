"""Build SVG detail views and clearly marked room mockups from our demo vectors."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / 'public' / 'prints'
for name in ('chrome-angel', 'kiss', 'butterfly-2000', 'offline', 'eyes', 'star-power'):
    source = (root / f'{name}.svg').read_text()
    content = re.sub(r'^<svg[^>]*>', '', source.strip()).removesuffix('</svg>')
    detail = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="75 175 330 412.5">{content}</svg>'
    (root / f'{name}-detail.svg').write_text(detail)
    room = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
<defs>
  <linearGradient id="gp-wall" x2="1" y2="1"><stop stop-color="#edf2f5"/><stop offset="1" stop-color="#b6c5d2"/></linearGradient>
  <linearGradient id="gp-metal" x2="0" y2="1"><stop stop-color="#f7fcff"/><stop offset=".4" stop-color="#a4b2c0"/><stop offset=".5" stop-color="#f3f9ff"/><stop offset="1" stop-color="#778795"/></linearGradient>
  <filter id="gp-print-shadow" x="-30%" y="-20%" width="170%" height="160%"><feDropShadow dx="10" dy="16" stdDeviation="11" flood-color="#344c62" flood-opacity=".3"/></filter>
</defs>
<rect width="800" height="1000" fill="url(#gp-wall)"/>
<path d="M0 0H285L800 650V900Z" fill="#fff" opacity=".18"/>
<path d="M0 180 800 795M0 310 800 925" stroke="#8195a5" stroke-width="10" opacity=".09"/>
<g filter="url(#gp-print-shadow)"><rect x="220" y="108" width="360" height="450" fill="#fff"/>
<svg x="220" y="108" width="360" height="450" viewBox="0 0 480 600">{content}</svg></g>
<ellipse cx="418" cy="803" rx="310" ry="29" fill="#52677b" opacity=".18"/>
<path d="M96 710H704L747 758H53Z" fill="#dce5ed"/>
<rect x="53" y="758" width="694" height="17" fill="url(#gp-metal)"/>
<path d="M90 775V1000M710 775V1000" stroke="url(#gp-metal)" stroke-width="15"/>
<g transform="translate(145 690) rotate(-4)"><rect width="172" height="22" fill="#10151e"/><rect x="-9" y="22" width="190" height="17" fill="#d7f66c"/><path d="M9 27H168M9 31H168" stroke="#9bae54"/><text x="14" y="15" fill="#d9e6f2" font-family="monospace" font-size="10" letter-spacing="2">THE POSTER EDIT</text></g>
<path d="M604 711V618" stroke="#8d9caa" stroke-width="6"/><ellipse cx="604" cy="714" rx="39" ry="7" fill="url(#gp-metal)"/>
<path d="M547 626Q604 535 661 626Z" fill="url(#gp-metal)" stroke="#98aab9"/>
<text x="400" y="959" text-anchor="middle" font-family="monospace" font-size="12" fill="#4f6476" letter-spacing="3">ROOM MOCKUP / DEMO</text>
</svg>'''
    (root / f'{name}-room.svg').write_text(room)
print('Generated 12 demo gallery SVGs')
