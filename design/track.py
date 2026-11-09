import math

PTS = [(300,250),(700,175),(1100,215),(1265,420),(1130,665),(820,610),(640,735),(320,700),(195,470)]

def _cr(points):
    n = len(points); segs = []
    for i in range(n):
        p0, p1, p2, p3 = points[i-1], points[i], points[(i+1)%n], points[(i+2)%n]
        c1 = (p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6)
        c2 = (p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        segs.append((p1, c1, c2, p2))
    return segs
SEGS = _cr(PTS)

def path_d():
    d = f"M{SEGS[0][0][0]},{SEGS[0][0][1]} "
    for p1, c1, c2, p2 in SEGS:
        d += f"C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]},{p2[1]} "
    return d + "Z"

def at(t):
    """t in [0,1) along the loop -> (x, y, angle_deg)"""
    n = len(SEGS); f = (t % 1) * n; i = int(f); u = f - i
    p1, c1, c2, p2 = SEGS[i]
    def b(a, b_, c, d, u): return (1-u)**3*a + 3*(1-u)**2*u*b_ + 3*(1-u)*u**2*c + u**3*d
    def db(a, b_, c, d, u): return 3*(1-u)**2*(b_-a) + 6*(1-u)*u*(c-b_) + 3*u**2*(d-c)
    x = b(p1[0], c1[0], c2[0], p2[0], u); y = b(p1[1], c1[1], c2[1], p2[1], u)
    dx = db(p1[0], c1[0], c2[0], p2[0], u); dy = db(p1[1], c1[1], c2[1], p2[1], u)
    return x, y, math.degrees(math.atan2(dy, dx))

def car(x, y, ang, body="#FF3B30", dark="#B3140D", scale=1.0, ghost=False):
    op = ' opacity=".9"' if ghost else ''
    return f'''<g transform="translate({x:.1f} {y:.1f}) rotate({ang:.1f}) scale({scale})"{op}>
  <ellipse cx="3" cy="4" rx="30" ry="17" fill="#000" fill-opacity=".28"/>
  <rect x="-28" y="-15" width="10" height="7" rx="2" fill="#111"/><rect x="-28" y="8" width="10" height="7" rx="2" fill="#111"/>
  <rect x="14" y="-15" width="10" height="7" rx="2" fill="#111"/><rect x="14" y="8" width="10" height="7" rx="2" fill="#111"/>
  <path d="M-30 -9 C-30 -14 -26 -15 -20 -15 L18 -15 C27 -15 32 -10 32 0 C32 10 27 15 18 15 L-20 15 C-26 15 -30 14 -30 9 Z" fill="{body}"/>
  <path d="M-30 -9 C-30 -14 -26 -15 -20 -15 L18 -15 C27 -15 32 -10 32 0 L-30 0 Z" fill="#fff" fill-opacity=".18"/>
  <path d="M2 -11 L13 -10 C17 -6 17 6 13 10 L2 11 Z" fill="#9FD3FF"/>
  <path d="M-20 -10 L-11 -10 L-11 10 L-20 10 C-22 6 -22 -6 -20 -10 Z" fill="#9FD3FF" fill-opacity=".85"/>
  <rect x="-9" y="-11" width="9" height="22" rx="3" fill="{dark}"/>
  <circle cx="30" cy="-9" r="2" fill="#FFF7C2"/><circle cx="30" cy="9" r="2" fill="#FFF7C2"/>
</g>'''

def flag(x, y):
    return (f'<g transform="translate({x:.0f} {y:.0f})"><ellipse cx="2" cy="2" rx="7" ry="3" fill="#000" fill-opacity=".25"/>'
            f'<rect x="-1.5" y="-40" width="3" height="42" rx="1.5" fill="#E5E5EA"/>'
            f'<path d="M1.5 -40 L28 -31 L1.5 -22 Z" fill="#FF3B30"/><path d="M1.5 -40 L28 -31 L1.5 -33 Z" fill="#fff" fill-opacity=".3"/></g>')

def zone(x, y, color, label):
    return (f'<g transform="translate({x:.0f} {y:.0f})">'
            f'<circle r="34" fill="{color}" fill-opacity=".18"/><circle r="24" fill="{color}" fill-opacity=".28"/>'
            f'<circle r="17" fill="{color}"/><circle r="17" fill="url(#zoneHi)"/>'
            f'<text y="6.5" text-anchor="middle" font-family="Inter Display" font-weight="800" font-size="19" fill="#fff">{label}</text></g>')

def sand(t, w=120):
    x, y, a = at(t)
    dots = "".join(f'<circle cx="{(-w/2+8+(i*37)%(w-14)):.0f}" cy="{(-34+(i*23)%64):.0f}" r="1.6" fill="#8A6A3C" fill-opacity=".6"/>' for i in range(26))
    return (f'<g transform="translate({x:.0f} {y:.0f}) rotate({a:.0f})"><rect x="{-w/2}" y="-41" width="{w}" height="82" rx="6" fill="url(#sandG)"/>{dots}'
            f'<rect x="{-w/2}" y="-41" width="{w}" height="82" rx="6" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/></g>')

def plate(t):
    x, y, a = at(t)
    return (f'<g transform="translate({x:.0f} {y:.0f}) rotate({a:.0f})"><rect x="-14" y="-46" width="28" height="92" rx="5" fill="#000" fill-opacity=".25" transform="translate(4 5)"/>'
            f'<rect x="-14" y="-46" width="28" height="92" rx="5" fill="url(#steelG)"/>'
            f'<rect x="-10" y="-42" width="5" height="84" rx="2.5" fill="#fff" fill-opacity=".55"/>'
            f'<circle cx="0" cy="-36" r="2.2" fill="#6E737C"/><circle cx="0" cy="36" r="2.2" fill="#6E737C"/></g>')

def scene(w=1440, h=900, extra=""):
    d = path_d()
    x0, y0, a0 = at(0.955)
    items = sand(0.16) + sand(0.47, 110) + plate(0.33) + plate(0.71)
    zones = []
    for t, c, l in [(0.07, "#34C759", "?"), (0.26, "#FF9500", "?"), (0.40, "#0A84FF", "⚡"), (0.58, "#FF3B30", "?"), (0.82, "#34C759", "?"), (0.64, "#0A84FF", "⚡")]:
        x, y, a = at(t); zones.append(zone(x, y, c, l))
    flags = ""
    for t in (0.0, 0.25, 0.5, 0.75):
        x, y, a = at(t); ox = math.cos(math.radians(a - 90)) * 64; oy = math.sin(math.radians(a - 90)) * 64
        flags += flag(x + ox, y + oy)
    return f'''<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs>
 <radialGradient id="bgG" cx="30%" cy="20%" r="90%"><stop offset="0" stop-color="#2A6BFF"/><stop offset=".45" stop-color="#5B2DD8"/><stop offset="1" stop-color="#14123A"/></radialGradient>
 <radialGradient id="blobA" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FF4FD8" stop-opacity=".55"/><stop offset="1" stop-color="#FF4FD8" stop-opacity="0"/></radialGradient>
 <radialGradient id="blobB" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2BE0C9" stop-opacity=".5"/><stop offset="1" stop-color="#2BE0C9" stop-opacity="0"/></radialGradient>
 <linearGradient id="board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E2A4A"/><stop offset="1" stop-color="#121A33"/></linearGradient>
 <linearGradient id="sandG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBCB92"/><stop offset="1" stop-color="#C99E5C"/></linearGradient>
 <linearGradient id="steelG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F2F3F7"/><stop offset=".5" stop-color="#AEB4BF"/><stop offset="1" stop-color="#7C8492"/></linearGradient>
 <radialGradient id="zoneHi" cx="35%" cy="25%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
 <pattern id="check" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fff"/><rect width="8" height="8" fill="#111"/><rect x="8" y="8" width="8" height="8" fill="#111"/></pattern>
 <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="1"/></pattern>
</defs>
<rect width="{w}" height="{h}" fill="url(#bgG)"/>
<circle cx="1250" cy="160" r="420" fill="url(#blobA)"/><circle cx="160" cy="820" r="460" fill="url(#blobB)"/>
<rect x="110" y="110" width="1220" height="700" rx="56" fill="url(#board)" fill-opacity=".92"/>
<rect x="110" y="110" width="1220" height="700" rx="56" fill="url(#grid)"/>
<rect x="110" y="110" width="1220" height="700" rx="56" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>
<path d="{d}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="112" transform="translate(0 10)" stroke-linejoin="round"/>
<path d="{d}" fill="none" stroke="#fff" stroke-width="104" stroke-linejoin="round"/>
<path d="{d}" fill="none" stroke="#FF3B30" stroke-width="104" stroke-dasharray="22 22" stroke-linejoin="round"/>
<path d="{d}" fill="none" stroke="#3A3F4B" stroke-width="88" stroke-linejoin="round"/>
<path d="{d}" fill="none" stroke="#4A505E" stroke-width="70" stroke-linejoin="round"/>
<path d="{d}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-dasharray="26 22"/>
<g transform="translate({x0:.0f} {y0:.0f}) rotate({a0:.0f})"><rect x="-10" y="-44" width="20" height="88" fill="url(#check)"/></g>
{items}{''.join(zones)}{flags}
{extra}
</svg>'''
