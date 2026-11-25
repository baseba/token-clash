const ROOM_MODE = { team: '🎒 Cada uno pelea con su equipo', random: '🎲 Batalla aleatoria: los dados sortean los Pokémon' };
const TOURNAMENT_MODE = { team: '🎒 Batalla con tu equipo', random: '🎲 Batalla aleatoria' };
const TOURNAMENT_VISIBILITY = { public: '🌍 Público', private: '🔒 Privado' };

const bold = (text) => ({ text, bold: true });
const segments = (line) => (Array.isArray(line) ? line : [line]).map((segment) => (typeof segment === 'string' ? { text: segment, bold: false } : segment));
const escapeHtml = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plainLine = (line) => line.map((segment) => (segment.bold ? `*${segment.text}*` : segment.text)).join('');
const htmlLine = (line) => line.map((segment) => (segment.bold ? `<b>${escapeHtml(segment.text)}</b>` : escapeHtml(segment.text))).join('');

function invite({ blocks, action, link }) {
  const lines = blocks.map((block) => block.map(segments));
  const text = [...lines.map((block) => block.map(plainLine).join('\n')), `👉 ${action}: ${link}`].join('\n\n');
  const html = [...lines.map((block) => block.map(htmlLine).join('<br>')), `👉 <a href="${escapeHtml(link)}">${escapeHtml(action)}</a>`].join('<br><br>');
  return { blocks: lines, action, link, text, html };
}

export const seatBar = (taken, size) => `${'🟨'.repeat(taken)}${'⬜'.repeat(Math.max(0, size - taken))}  ${taken}/${size}`;

export function duelInvite(room, link) {
  const open = room.visibility === 'public';
  return invite({
    blocks: [
      [['⚔️ ', bold('TOKEN CLASH')]],
      [['🔥 ', bold(`${room.host.name} tiró el guante.`)], '¿Te la puedes?'],
      [ROOM_MODE[room.mode] ?? ROOM_MODE.team, open ? '🌍 Sala abierta: el primero que entre pelea' : '🔒 Sala privada', ...(open ? [] : ['⏳ La sala vence si nadie entra'])],
    ],
    action: open ? 'Entrar a la sala' : 'Aceptar el desafío',
    link,
  });
}

export function tournamentInvite(tournament, link) {
  const host = tournament.seats[0]?.name ?? 'Alguien';
  const taken = tournament.seats.length;
  const free = tournament.size - taken;
  const dare = free > 0 ? `${free === 1 ? 'Falta 1' : `Faltan ${free}`}. ¿Te sumas?` : 'Ya está lleno, pero puedes mirarlo.';
  return invite({
    blocks: [
      [['🏆 ', bold('TOKEN CLASH')]],
      [['🔥 ', bold(`${host} armó un torneo de ${tournament.size}.`)], dare],
      [seatBar(taken, tournament.size), `${TOURNAMENT_MODE[tournament.mode] ?? TOURNAMENT_MODE.team} · ${TOURNAMENT_VISIBILITY[tournament.visibility] ?? TOURNAMENT_VISIBILITY.private}`, '🚩 Parte cuando la sala se llena y todos están listos'],
    ],
    action: free > 0 ? 'Sentarse en el torneo' : 'Ver el torneo',
    link,
  });
}
