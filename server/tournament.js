export const TOURNAMENT_SIZES = [4, 8, 16];

export const AI_NAMES = ['crubio ai', 'andy ai', 'bryan ai', 'esteban ai', 'ferlo ai', 'gon ai', 'joa ai', 'nacho juan ai', 'nico santi ai', 'nora ai', 'valde ai', 'mirror ai', 'tom ai', 'yuwen ai', 'alvaro ai'];
const DIFFICULTY_NAMES = { easy: 'fácil', mid: 'media', hard: 'difícil', veryhard: 'muy difícil', skynet: 'skynet' };

export function aiName(level, taken = [], random = Math.random) {
  const used = new Set(taken);
  const free = AI_NAMES.filter((n) => !used.has(n));
  const pool = free.length ? free : AI_NAMES;
  const base = pool[Math.floor(random() * pool.length)];
  return { base, name: `${base} - ${DIFFICULTY_NAMES[level] ?? level}` };
}

export const humanCount = (t) => t.seats.filter((s) => !s.ai).length;

const ROUND_NAMES = { 1: 'Final', 2: 'Semifinal', 4: 'Cuartos de final', 8: 'Octavos de final' };

export const isAiSeat = (seat) => !!seat?.ai;
export const isFull = (t) => t.seats.length >= t.size;
export const allReady = (t) => isFull(t) && t.seats.every((s) => s.ready);
export const seatOf = (t, trainerId) => t.seats.findIndex((s) => s.id === trainerId);

export function roundName(size, round) {
  const matches = size / 2 ** (round + 1);
  return ROUND_NAMES[matches] ?? `Ronda ${round + 1}`;
}

export function addSeat(t, seat) {
  if (isFull(t)) throw new Error('El torneo ya está lleno.');
  if (seatOf(t, seat.id) !== -1) throw new Error('Ya estás en este torneo.');
  t.seats.push({ ...seat, ready: isAiSeat(seat) });
}

export function removeSeat(t, index) {
  if (index <= 0 || index >= t.seats.length) throw new Error('Ese asiento no se puede quitar.');
  t.seats.splice(index, 1);
}

export function setReady(t, trainerId, ready) {
  const i = seatOf(t, trainerId);
  if (i === -1) throw new Error('No estás en este torneo.');
  t.seats[i].ready = !!ready;
}

export function nextAiId(t, level) {
  let n = 1;
  while (t.seats.some((s) => s.id === `ai:${level}#${n}`)) n += 1;
  return { id: `ai:${level}#${n}`, n };
}

export function shuffledOrder(count, random = Math.random) {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function createBracket(order) {
  const rounds = [];
  let size = order.length;
  rounds.push(Array.from({ length: size / 2 }, (_, i) => ({ a: order[2 * i], b: order[2 * i + 1], winner: null, challengeId: null })));
  for (size /= 2; size > 1; size /= 2) rounds.push(Array.from({ length: size / 2 }, () => ({ a: null, b: null, winner: null, challengeId: null })));
  return rounds;
}

export function nextMatch(bracket) {
  for (let round = 0; round < bracket.length; round++) {
    const index = bracket[round].findIndex((m) => m.winner === null && m.a !== null && m.b !== null);
    if (index !== -1) return { round, index };
  }
  return null;
}

export function recordWinner(bracket, { round, index }, winner) {
  const match = bracket[round][index];
  if (winner !== match.a && winner !== match.b) throw new Error('Ese asiento no jugó esta pelea.');
  match.winner = winner;
  const next = bracket[round + 1]?.[Math.floor(index / 2)];
  if (next) next[index % 2 === 0 ? 'a' : 'b'] = winner;
  return next ? null : winner;
}

export function reachedRound(bracket, seat) {
  let reached = -1;
  bracket.forEach((round, r) => round.forEach((m) => (m.a === seat || m.b === seat) && (reached = r)));
  return reached;
}

export function matchNumber(bracket, { round, index }) {
  return bracket.slice(0, round).reduce((n, r) => n + r.length, 0) + index + 1;
}

export function totalMatches(bracket) {
  return bracket.reduce((n, r) => n + r.length, 0);
}

export function tournamentMatchFor(tournaments, { trainerId, mode, levelCap, size }) {
  const same = tournaments.filter((t) => t.mode === mode && (t.levelCap ?? null) === levelCap && t.size === size && !isFull(t));
  return { own: same.find((t) => t.hostId === trainerId) ?? null, rival: same.find((t) => t.hostId !== trainerId && seatOf(t, trainerId) === -1) ?? null, seated: same.find((t) => seatOf(t, trainerId) > 0) ?? null };
}
