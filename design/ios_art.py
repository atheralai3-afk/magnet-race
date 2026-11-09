# Detailed full-colour illustrations for the centre tile (100x100 coordinate space)

def _common(u, L):
    return f'''
<radialGradient id="glow{u}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{L["g2"]}" stop-opacity=".22"/><stop offset="1" stop-color="{L["g2"]}" stop-opacity="0"/></radialGradient>
<linearGradient id="red{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF6B5E"/><stop offset="1" stop-color="#D7261E"/></linearGradient>
<linearGradient id="blue{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4DA3FF"/><stop offset="1" stop-color="#0060DF"/></linearGradient>
<linearGradient id="steel{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FAFAFC"/><stop offset=".55" stop-color="#C7C7CC"/><stop offset="1" stop-color="#8E8E93"/></linearGradient>
<radialGradient id="ball{u}" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#C9CDD4"/><stop offset="1" stop-color="#6E737C"/></radialGradient>
<linearGradient id="gold{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE45C"/><stop offset="1" stop-color="#FFB800"/></linearGradient>'''

def _rings(L, cx=50, cy=50):
    return (f'<circle cx="{cx}" cy="{cy}" r="44" fill="url(#glow@)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="30" fill="none" stroke="{L["g2"]}" stroke-opacity=".14" stroke-width=".8"/>'
            f'<circle cx="{cx}" cy="{cy}" r="40" fill="none" stroke="{L["g2"]}" stroke-opacity=".09" stroke-width=".8"/>')

def _spark(x, y, s, u):
    return (f'<path transform="translate({x} {y}) scale({s})" fill="url(#gold{u})" '
            f'd="M0-5C.6-1.6 1.6-.6 5 0 1.6.6.6 1.6 0 5-.6 1.6-1.6.6-5 0-1.6-.6-.6-1.6 0-5z"/>')

FIELD = "#5E5CE6"

def magnet(u, L):
    return f'''{_rings(L, 50, 46)}
<g fill="none" stroke="{FIELD}" stroke-linecap="round">
  <path d="M34 66 Q50 84 66 66" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="3 2.6"/>
  <path d="M31 66 Q50 95 69 66" stroke-opacity=".32" stroke-width="1.4" stroke-dasharray="3 2.6"/>
  <path d="M28 64 Q12 62 12 44" stroke-opacity=".22" stroke-width="1.2" stroke-dasharray="3 2.6"/>
  <path d="M72 64 Q88 62 88 44" stroke-opacity=".22" stroke-width="1.2" stroke-dasharray="3 2.6"/>
</g>
<ellipse cx="50" cy="66" rx="20" ry="3" fill="#000" fill-opacity=".08"/>
<path d="M28 58V40a22 22 0 0 1 22-22v12a10 10 0 0 0-10 10v18z" fill="url(#red{u})"/>
<path d="M50 18a22 22 0 0 1 22 22v18H60V40a10 10 0 0 0-10-10z" fill="url(#blue{u})"/>
<path d="M31.5 40a18.5 18.5 0 0 1 15-18.2" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/>
<path d="M53.5 21.8a18.5 18.5 0 0 1 15 18.2" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" stroke-linecap="round"/>
<rect x="28" y="56" width="12" height="9" rx="1.6" fill="url(#steel{u})"/><rect x="60" y="56" width="12" height="9" rx="1.6" fill="url(#steel{u})"/>
<rect x="29.5" y="57.2" width="9" height="1.6" rx=".8" fill="#fff" fill-opacity=".8"/><rect x="61.5" y="57.2" width="9" height="1.6" rx=".8" fill="#fff" fill-opacity=".8"/>
<g stroke="#8E8E93" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"><path d="M44 92v-3"/><path d="M50 95v-4"/><path d="M56 92v-3"/></g>
<circle cx="50" cy="80" r="7" fill="url(#ball{u})"/><ellipse cx="47.6" cy="77.4" rx="2.2" ry="1.4" fill="#fff" fill-opacity=".9"/>
{_spark(22, 26, .9, u)}{_spark(79, 24, .65, u)}'''

def attraction(u, L):
    def bar(x, flip):
        a, b = ("blue", "red") if not flip else ("blue", "red")
        return (f'<rect x="{x}" y="41" width="16" height="18" rx="3.5" fill="url(#{a}{u})"/>'
                f'<rect x="{x+14}" y="41" width="16" height="18" rx="3.5" fill="url(#{b}{u})"/>'
                f'<rect x="{x+12}" y="41" width="6" height="18" fill="url(#{b}{u})"/>'
                f'<rect x="{x+2}" y="42.6" width="26" height="2.4" rx="1.2" fill="#fff" fill-opacity=".45"/>')
    return f'''{_rings(L)}
<g fill="none" stroke="{FIELD}" stroke-linecap="round" stroke-dasharray="3 2.6">
  <path d="M40 41 Q50 30 60 41" stroke-opacity=".5" stroke-width="1.5"/><path d="M40 59 Q50 70 60 59" stroke-opacity=".5" stroke-width="1.5"/>
  <path d="M36 41 Q50 18 64 41" stroke-opacity=".28" stroke-width="1.3"/><path d="M36 59 Q50 82 64 59" stroke-opacity=".28" stroke-width="1.3"/>
</g>
<g stroke="#8E8E93" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"><path d="M2 46h5"/><path d="M0 54h6"/><path d="M93 46h5"/><path d="M94 54h6"/></g>
<ellipse cx="50" cy="63" rx="40" ry="2.6" fill="#000" fill-opacity=".07"/>
{bar(9, False)}{bar(61, False)}
<text x="17" y="53.5" font-family="Inter Display" font-weight="800" font-size="8" fill="#fff" text-anchor="middle">S</text>
<text x="33" y="53.5" font-family="Inter Display" font-weight="800" font-size="8" fill="#fff" text-anchor="middle">N</text>
<text x="69" y="53.5" font-family="Inter Display" font-weight="800" font-size="8" fill="#fff" text-anchor="middle">S</text>
<text x="85" y="53.5" font-family="Inter Display" font-weight="800" font-size="8" fill="#fff" text-anchor="middle">N</text>
<circle cx="50" cy="50" r="6" fill="url(#gold{u})" fill-opacity=".35"/>{_spark(50, 50, 1.1, u)}
<g fill="#34C759"><path d="M43 50l-4-3v6z"/><path d="M57 50l4-3v6z"/></g>'''

def electro(u, L):
    loops = ""
    for i in range(7):
        x = 27 + 7.7 * i
        loops += f'<path d="M{x+3.2:.1f} 38.5 L{x-1.4:.1f} 61.5" stroke="#8A4A1F" stroke-width="4.4" stroke-linecap="round"/>'
        loops += f'<path d="M{x+3.2:.1f} 38.5 L{x-1.4:.1f} 61.5" stroke="url(#cu{u})" stroke-width="3.2" stroke-linecap="round"/>'
        loops += f'<path d="M{x+2.6:.1f} 40 L{x+0.8:.1f} 49" stroke="#fff" stroke-opacity=".6" stroke-width="1" stroke-linecap="round"/>'
    return f'''<defs><linearGradient id="cu{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFC48A"/><stop offset="1" stop-color="#C96A2C"/></linearGradient></defs>
{_rings(L, 50, 48)}
<g fill="none" stroke="{FIELD}" stroke-linecap="round" stroke-dasharray="3 2.6">
  <path d="M16 50 C16 24 84 24 84 50" stroke-opacity=".5" stroke-width="1.5"/>
  <path d="M10 50 C10 12 90 12 90 50" stroke-opacity=".28" stroke-width="1.3"/>
</g>
<rect x="17" y="44" width="66" height="12" rx="3" fill="url(#steel{u})"/>
<rect x="19" y="45.4" width="62" height="2" rx="1" fill="#fff" fill-opacity=".8"/>
<g fill="none">{loops}</g>
<path d="M25.5 61 C24 70 30 74 38 76" fill="none" stroke="#C96A2C" stroke-width="1.8" stroke-linecap="round"/>
<path d="M74.5 61 C76 70 70 74 62 76" fill="none" stroke="#C96A2C" stroke-width="1.8" stroke-linecap="round"/>
<rect x="37" y="71" width="26" height="12" rx="2.6" fill="#2C2C2E"/><rect x="37" y="71" width="9" height="12" rx="2.6" fill="url(#gold{u})"/>
<rect x="43" y="71" width="3" height="12" fill="url(#gold{u})"/><rect x="63" y="74.5" width="2.4" height="5" rx="1" fill="#8E8E93"/>
<rect x="38.5" y="72.4" width="23" height="1.6" rx=".8" fill="#fff" fill-opacity=".35"/>
<path d="M78 14 70 27h5.4l-2 9 9-13.6h-5.6z" fill="url(#gold{u})"/>
<text x="13" y="53" font-family="Inter Display" font-weight="800" font-size="6.5" fill="#D7261E" text-anchor="middle">N</text>
<text x="87" y="53" font-family="Inter Display" font-weight="800" font-size="6.5" fill="#0060DF" text-anchor="middle">S</text>'''

def static(u, L):
    minus = "".join(f'<rect x="{x-2.6}" y="{y-0.9}" width="5.2" height="1.8" rx=".9" fill="#fff" fill-opacity=".9"/>'
                    for x, y in [(36, 30), (48, 26), (52, 40), (38, 44), (46, 54)])
    papers = "".join(f'<g transform="translate({x} {y}) rotate({r})"><rect x="-4.5" y="-3.5" width="9" height="7" rx="1" fill="#000" fill-opacity=".08" transform="translate(.8 1)"/>'
                     f'<rect x="-4.5" y="-3.5" width="9" height="7" rx="1" fill="#FFFFFF" stroke="#D1D1D6" stroke-width=".6"/>'
                     f'<path d="M-2.6-1h5.2M-2.6 1.2h3.6" stroke="#C7C7CC" stroke-width=".7"/></g>'
                     for x, y, r in [(70, 70, -18), (80, 82, 14), (62, 85, 8)])
    return f'''<defs><radialGradient id="bal{u}" cx="35%" cy="28%" r="75%"><stop offset="0" stop-color="#7CC0FF"/><stop offset=".55" stop-color="#0A84FF"/><stop offset="1" stop-color="#0050B8"/></radialGradient></defs>
{_rings(L, 46, 42)}
<path d="M44 67 C44 74 52 76 50 84 C48.6 90 54 93 58 96" fill="none" stroke="#8E8E93" stroke-width="1.2" stroke-linecap="round"/>
<path d="M41 64.5h6l-1.6 3.6h-2.8z" fill="#0050B8"/>
<ellipse cx="44" cy="40" rx="21" ry="25" fill="url(#bal{u})"/>
<ellipse cx="36" cy="28" rx="5" ry="8" transform="rotate(-25 36 28)" fill="#fff" fill-opacity=".45"/>
{minus}
<g fill="none" stroke="{L["g2"]}" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"><path d="M68 34 q6 8 2 16"/><path d="M74 30 q8 11 3 22"/></g>
<path d="M66 50 59.5 60h4.3l-1.6 7.6 7.4-11h-4.5z" fill="url(#gold{u})"/>
{papers}{_spark(80, 62, .6, u)}{_spark(20, 70, .7, u)}'''

def friction(u, L):
    dots = "".join(f'<circle cx="{x}" cy="{y}" r=".7" fill="#8A6A3C" fill-opacity=".55"/>'
                   for x, y in [(12,81),(18,84),(25,80.5),(31,83.5),(38,81),(45,84.5),(52,80.8),(59,83.6),(66,81.2),(73,84.4),(80,80.8),(87,83.2),(15,86.5),(42,87),(70,86.6)])
    return f'''<defs><linearGradient id="car{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF6B5E"/><stop offset="1" stop-color="#C81E1E"/></linearGradient>
<linearGradient id="sand{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E3C48E"/><stop offset="1" stop-color="#C79F5F"/></linearGradient></defs>
{_rings(L, 50, 58)}
<rect x="6" y="78" width="88" height="11" rx="2.5" fill="url(#sand{u})"/>{dots}
<g stroke="#8E8E93" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"><path d="M4 52h9"/><path d="M2 60h10"/><path d="M5 67h7"/></g>
<path d="M16 66c0-5 4-7.6 10-8.6l10-9c2-1.8 4.6-2.8 7.4-2.8h18.4c2.8 0 5.4 1 7.4 2.8l8 7.8c5.4.8 10 3.6 10 8.4v4c0 1.6-1.2 2.6-2.6 2.6H18.6c-1.4 0-2.6-1-2.6-2.6z" fill="url(#car{u})"/>
<path d="M39.5 56.5 46 50.2c.8-.8 1.8-1.2 3-1.2h5.6v7.5z" fill="#BFE3FF"/><path d="M58.6 56.5V49h6c1 0 2 .4 2.8 1.2l6.2 6.3z" fill="#BFE3FF"/>
<path d="M22 60.6h60" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="32" cy="72" r="7.5" fill="#1C1C1E"/><circle cx="32" cy="72" r="3.4" fill="url(#steel{u})"/>
<circle cx="72" cy="72" r="7.5" fill="#1C1C1E"/><circle cx="72" cy="72" r="3.4" fill="url(#steel{u})"/>
<path d="M54 30h24" stroke="#34C759" stroke-width="3.6" stroke-linecap="round"/><path d="M76 24.5 84 30l-8 5.5z" fill="#34C759"/>
<path d="M58 95h-20" stroke="#FF9500" stroke-width="3.2" stroke-linecap="round"/><path d="M40 90.2 33 95l7 4.8z" fill="#FF9500"/>'''

def shield(u, L):
    return f'''<defs><linearGradient id="sh{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B9C3D3"/><stop offset=".5" stop-color="#7D8BA3"/><stop offset="1" stop-color="#46536B"/></linearGradient>
<linearGradient id="shi{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{L["g1"]}"/><stop offset="1" stop-color="{L["g3"]}"/></linearGradient></defs>
{_rings(L, 50, 50)}
<g fill="none" stroke="{FIELD}" stroke-linecap="round" stroke-dasharray="3 2.6">
  <path d="M2 40 C18 40 20 15 50 14 C80 15 82 40 98 40" stroke-opacity=".5" stroke-width="1.5"/>
  <path d="M2 29 C20 29 26 7 50 6 C74 7 80 29 98 29" stroke-opacity=".28" stroke-width="1.3"/>
  <path d="M2 61 C18 61 20 87 50 88 C80 87 82 61 98 61" stroke-opacity=".5" stroke-width="1.5"/>
  <path d="M2 72 C20 72 26 95 50 96 C74 95 80 72 98 72" stroke-opacity=".28" stroke-width="1.3"/>
</g>
<g fill="none" stroke="{L["g2"]}" stroke-linecap="round"><path d="M19 38 Q13 50 19 62" stroke-opacity=".55" stroke-width="1.6"/><path d="M12 34 Q5 50 12 66" stroke-opacity=".3" stroke-width="1.4"/></g>
<ellipse cx="50" cy="82" rx="18" ry="2.6" fill="#000" fill-opacity=".1"/>
<path d="M50 20 73 28.5c1.6.6 2.6 2 2.6 3.7V48c0 14.5-10.4 26-24.6 30.2-.7.2-1.3.2-2 0C34.8 74 24.4 62.5 24.4 48V32.2c0-1.7 1-3.1 2.6-3.7z" fill="url(#sh{u})"/>
<path d="M50 26.5 68.5 33.4V48c0 11.6-8 21-18.5 24.6C39.5 69 31.5 59.6 31.5 48V33.4z" fill="url(#shi{u})"/>
<path d="M50 26.5V72.6C39.5 69 31.5 59.6 31.5 48V33.4z" fill="#fff" fill-opacity=".22"/>
<path d="M27.6 32.6 50 24.2" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/>
<path d="M42.4 49.4 47.6 54.6 58 43.6" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
{_spark(80, 22, .7, u)}'''

ART = {"Magnetism": magnet, "Attraction & repulsion": lambda u, L: '<g transform="translate(50 50) scale(1.06) translate(-50 -50)">' + attraction(u, L) + "</g>", "Electromagnetism": electro,
       "Static charge": static, "Forces & friction": friction, "Magnetic screening": shield}

def art_svg(topic, u, L, sq):
    body = ART[topic](u, L).replace("url(#glow@)", f"url(#glow{u})")
    return f'''<svg class="tile" viewBox="0 0 100 100">
<defs>{_common(u, L)}
<linearGradient id="tb{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EEF0F5"/></linearGradient>
<clipPath id="cl{u}"><path d="{sq}"/></clipPath></defs>
<path d="{sq}" fill="url(#tb{u})"/>
<g clip-path="url(#cl{u})">{body}</g>
<path d="{sq}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width=".8"/>
</svg>'''
