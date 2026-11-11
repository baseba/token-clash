#!/usr/bin/env python3
"""Builds the creature catalog from a Tuxemon checkout (https://github.com/Tuxemon/Tuxemon).

Tuxemon is an open-source creature game; its monster art is CC BY-SA 4.0 / CC BY 4.0
(see public/creditos.txt). Usage:

    python3 scripts/import-tuxemon.py /path/to/Tuxemon

Writes public/sprites/<slug>-front.png and -back.png (64x64), server/tuxemon.json and
public/creditos.txt. Needs Pillow and PyYAML.
"""
import json, re, subprocess, sys
from pathlib import Path
import yaml
from PIL import Image

src = Path(sys.argv[1])
root = Path(__file__).resolve().parent.parent
mod = src / 'mods/tuxemon'
out_sprites = root / 'public/sprites'
out_sprites.mkdir(parents=True, exist_ok=True)

def po(lang):
    text = (mod / f'l18n/{lang}/LC_MESSAGES/base.po').read_text(encoding='utf-8')
    d = {}
    for m in re.finditer(r'^msgid "(.*)"\nmsgstr "(.*)"', text, re.M):
        if m.group(2):
            d[m.group(1)] = m.group(2).replace('\\"', '"')
    return d

EN, ES = po('en_US'), po('es_ES')

# Tuxemon types -> the six elements of Token Clash.
ELEMENT = {
    'fire': 'brasa', 'water': 'marea', 'frost': 'marea', 'wood': 'brote', 'venom': 'brote',
    'lightning': 'chispa', 'sky': 'chispa', 'earth': 'roca', 'metal': 'roca',
    'shadow': 'sombra', 'cosmic': 'sombra',
}

techs = {}
for f in (mod / 'db/technique').glob('*.yaml'):
    t = yaml.safe_load(f.read_text())
    if not isinstance(t, dict) or t.get('sort') != 'damage' or not t.get('power'):
        continue
    techs[t['slug']] = {'types': t.get('types') or [], 'power': float(t['power'])}

mons = {}
for f in sorted((mod / 'db/monster').glob('*.yaml')):
    m = yaml.safe_load(f.read_text())
    slug = m.get('slug')
    sheet = mod / f'gfx/sprites/battle/{slug}-sheet.png'
    if not slug or not m.get('txmn_id') or not sheet.exists() or slug not in EN:
        continue
    im = Image.open(sheet).convert('RGBA')
    if im.size != (128, 88):
        continue
    front, back = im.crop((0, 0, 64, 64)), im.crop((64, 0, 128, 64))
    if not front.getbbox() or not back.getbbox():
        continue
    types = m.get('types') or ['normal']
    element = next((ELEMENT[t] for t in types if t in ELEMENT), None)
    moves = []
    for mv in m.get('moveset') or []:
        t = techs.get(mv.get('technique'))
        if t:
            if mv['technique'] not in ES:
                continue  # only techniques with a Spanish name; the game fills the rest
            moves.append({'slug': mv['technique'], 'name': ES[mv['technique']], 'power': t['power'],
                          'element': next((ELEMENT[x] for x in t['types'] if x in ELEMENT), None)})
    mons[slug] = {'slug': slug, 'name': EN[slug], 'element': element, 'moves': moves,
                  'evolves_into': [e['monster_slug'] for e in m.get('evolutions') or []],
                  'front': front, 'back': back}

# Evolution lines: every root-to-leaf path through the creatures we kept.
children = {s: [c for c in m['evolves_into'] if c in mons and c != s] for s, m in mons.items()}
has_parent = {c for cs in children.values() for c in cs}
lines = []
def walk(path):
    nxt = [c for c in children[path[-1]] if c not in path]
    if not nxt or len(path) == 3:
        lines.append(path)
    for c in nxt[:1] if len(path) < 3 else []:
        walk(path + [c])
for s in sorted(mons):
    if s not in has_parent:
        walk([s])

used = {s for l in lines for s in l}
for s in used:
    m = mons[s]
    m.pop('front').save(out_sprites / f'{s}-front.png', optimize=True)
    m.pop('back').save(out_sprites / f'{s}-back.png', optimize=True)

def tech_names(m, element):
    own = sorted([t for t in m['moves'] if element and t['element'] == element], key=lambda t: t['power'])
    plain = [t['name'] for t in m['moves'] if t['element'] is None and t['slug'] != 'struggle']
    return {'strike': own[0]['name'] if own else None,
            'burst': own[-1]['name'] if len(own) > 1 else None,
            'quick': plain[0] if plain else None}

catalog = {'source': 'https://github.com/Tuxemon/Tuxemon', 'commit': None, 'species': {}, 'lines': lines}
try:
    catalog['commit'] = subprocess.check_output(['git', '-C', str(src), 'rev-parse', 'HEAD'], text=True).strip()
except Exception:
    pass
for s in sorted(used):
    m = mons[s]
    catalog['species'][s] = {'name': m['name'], 'element': m['element'], 'moves': tech_names(m, m['element'])}
(root / 'server/tuxemon.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + '\n')

# Credits: the upstream attribution for monster art, verbatim.
attr = (src / 'ATTRIBUTIONS.md').read_text(encoding='utf-8')
section = attr.split('\n### Tuxemon\n', 1)[1].split('\n### ', 1)[0]
(root / 'public/creditos.txt').write_text(
    'Token Clash usa los sprites y nombres de criaturas del proyecto libre Tuxemon\n'
    f'https://github.com/Tuxemon/Tuxemon (commit {catalog["commit"]}).\n\n'
    'Arte de las criaturas: licencias CC BY-SA 4.0 y CC BY 4.0 según cada autor (abajo, copiado de\n'
    'ATTRIBUTIONS.md de Tuxemon). Los recortes a 64x64 de public/sprites/ se distribuyen bajo las mismas\n'
    'licencias. https://creativecommons.org/licenses/by-sa/4.0/\n\n'
    'Copyright (C) 2014-2026 William Edwards, Benjamin Bean y colaboradores de Tuxemon.\n\n'
    '--- Créditos de criaturas (Tuxemon ATTRIBUTIONS.md) ---\n' + section.strip() + '\n', encoding='utf-8')

from collections import Counter
print(len(used), 'species,', len(lines), 'lines', Counter(len(l) for l in lines))
