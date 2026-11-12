function parseSpans(text) {
  let i = 0;
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i])) i++;
  };
  const fail = () => {
    throw new Error(`JSON inválido cerca del carácter ${i}`);
  };
  function string() {
    const start = i;
    i++;
    let out = '';
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\') {
        const next = text[i + 1];
        if (next === 'u') {
          out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
          i += 6;
          continue;
        }
        out += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[next] ?? next;
        i += 2;
        continue;
      }
      out += text[i++];
    }
    if (text[i] !== '"') fail();
    i++;
    return { type: 'string', start, end: i, value: out };
  }
  function value() {
    ws();
    const c = text[i];
    if (c === '{') {
      const start = i++;
      const props = new Map();
      ws();
      if (text[i] === '}') return { type: 'object', start, end: ++i, props };
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        const key = string();
        ws();
        if (text[i++] !== ':') fail();
        props.set(key.value, value());
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] !== '}') fail();
        return { type: 'object', start, end: ++i, props };
      }
    }
    if (c === '[') {
      const start = i++;
      const items = [];
      ws();
      if (text[i] === ']') return { type: 'array', start, end: ++i, items };
      for (;;) {
        items.push(value());
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] !== ']') fail();
        return { type: 'array', start, end: ++i, items };
      }
    }
    if (c === '"') return string();
    const start = i;
    while (i < text.length && !',}] \t\n\r'.includes(text[i])) i++;
    if (start === i) fail();
    return { type: 'raw', start, end: i, value: text.slice(start, i) };
  }
  const root = value();
  ws();
  if (i !== text.length) fail();
  return root;
}

function setKey(changes, obj, key, valueText) {
  const node = obj.props.get(key);
  if (node) {
    changes.push({ start: node.start, end: node.end, text: valueText });
    return;
  }
  const closing = obj.end - 1;
  const pending = changes.find((c) => c.start === closing && c.end === closing);
  const piece = `${JSON.stringify(key)}:${valueText}`;
  if (pending) pending.text += `,${piece}`;
  else changes.push({ start: closing, end: closing, text: obj.props.size ? `,${piece}` : piece });
}

function profilesOf(root) {
  const state = root.props.get('format') ? root.props.get('state') : root;
  if (!state || state.type !== 'object') return [];
  const holders = [...(state.props.get('dex')?.items ?? []), state.props.get('active')].filter((n) => n?.type === 'object');
  return holders.map((n) => n.props.get('profile')).filter((p) => p?.type === 'object' && p.props.get('instanceID')?.type === 'string');
}

const stringList = (node) => (node?.type === 'array' ? node.items.filter((n) => n.type === 'string').map((n) => n.value) : []);

export function patchSave(text, edits) {
  const root = parseSpans(text);
  if (root.type !== 'object') throw new Error('El save no es un objeto JSON.');
  const byId = new Map(profilesOf(root).map((p) => [p.props.get('instanceID').value.toLowerCase(), p]));
  const changes = [];
  const applied = [];
  const missing = [];

  for (const edit of edits) {
    const profile = byId.get(String(edit.id).toLowerCase());
    if (!profile) {
      missing.push(edit.id);
      continue;
    }
    if (edit.ability) {
      setKey(changes, profile, 'abilityName', JSON.stringify(edit.ability.name));
      setKey(changes, profile, 'abilitySlot', JSON.stringify(edit.ability.slot));
      setKey(changes, profile, 'abilityIsHidden', JSON.stringify(!!edit.ability.hidden));
    }
    if (edit.currentMoves) {
      const movesNode = profile.props.get('moves');
      const learned = new Set(movesNode?.type === 'array' ? movesNode.items.map((n) => n.props?.get('name')?.value).filter(Boolean) : []);
      const levels = new Map(edit.currentMoves.map((m) => [m.name, m.level]));
      const previous = stringList(profile.props.get('currentMoves'));
      const toLearn = [...previous, ...edit.currentMoves.map((m) => m.name)].filter((name, i, all) => !learned.has(name) && all.indexOf(name) === i);
      const added = toLearn.map((name) => JSON.stringify({ name, learnedAtLevel: levels.get(name) ?? 1 }));
      if (movesNode?.type === 'array') {
        if (added.length) changes.push({ start: movesNode.end - 1, end: movesNode.end - 1, text: `${movesNode.items.length ? ',' : ''}${added.join(',')}` });
      } else setKey(changes, profile, 'moves', `[${added.join(',')}]`);
      setKey(changes, profile, 'currentMoves', JSON.stringify(edit.currentMoves.map((m) => m.name)));
    }
    applied.push(edit.id);
  }

  let out = text;
  for (const c of changes.sort((a, b) => b.start - a.start)) out = out.slice(0, c.start) + c.text + out.slice(c.end);
  if (!root.props.get('format')) {
    out = `{"format":"poketokenbar.save","schema":2,"appVersion":"token-clash","exportedAt":${JSON.stringify(new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'))},"sourceDevice":"Token Clash","state":${out.trim()}}`;
  }
  return { text: out, applied, missing };
}
