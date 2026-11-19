// Radio stations in the browser: the feed that keeps the tuned station playing across pages and
// reloads, and the "Estaciones" and "Mi estación" tabs of the 📻 dialog. A station is a trainer's:
// its owner picks the queue and anyone can listen.
import { RADIO_REGIONS, radioTrack, STATION_NAME_MAX, STATION_QUEUE_MAX } from './radio.js?v=dev';

const STATION_KEY = 'tc_station';

/**
 * The station this browser listens to, remembered in `storage`, over one socket of its own (apart
 * from the room and lobby sockets, which come and go with each page). It reconnects with backoff
 * and tunes in again. Every `radio` frame of the tuned station goes to `onFrame`, and `onFrame(null)`
 * when listening stops; a frame with `station: null` means it closed, and the browser forgets it.
 */
export function createStationFeed({ open, storage = null, onFrame, retryIn = (ms, retry) => setTimeout(retry, ms) }) {
  const read = () => {
    try {
      return storage?.getItem(STATION_KEY) || null;
    } catch {
      return null;
    }
  };
  const write = (id) => {
    try {
      storage?.setItem(STATION_KEY, id);
    } catch {}
  };
  let tuned = read();
  let socket = null;
  let attempts = 0;
  let last = null;

  const send = (message) => socket?.readyState === 1 && socket.send(JSON.stringify(message));

  function connect() {
    if (!tuned || socket) return;
    const current = open();
    socket = current;
    current.onopen = () => {
      attempts = 0;
      send({ t: 'radio', station: tuned });
    };
    current.onmessage = (event) => {
      const frame = JSON.parse(event.data);
      if (frame.t !== 'radio' || socket !== current || frame.stationId !== tuned) return;
      last = frame.station;
      if (!frame.station) forget();
      onFrame(frame);
    };
    current.onclose = () => {
      if (socket !== current) return;
      socket = null;
      if (!tuned) return;
      attempts += 1;
      retryIn(Math.min(8000, 500 * 2 ** attempts), connect);
    };
  }

  function disconnect() {
    const current = socket;
    socket = null;
    if (current) {
      current.onclose = null;
      current.close();
    }
  }

  function forget() {
    tuned = null;
    last = null;
    write(null);
    disconnect();
  }

  connect();
  return {
    /** The owner id of the station tuned in, or null. */
    get tuned() {
      return tuned;
    },
    /** The tuned station as its last frame showed it, or null before the first one. */
    get station() {
      return last;
    },
    /** Tunes in to a station by its owner's id, or out with null. */
    tune(stationId) {
      if (stationId === tuned) return;
      if (!stationId) {
        forget();
        onFrame(null);
        return;
      }
      tuned = stationId;
      last = null;
      write(stationId);
      if (socket) send({ t: 'radio', station: stationId });
      else connect();
    },
  };
}

const trackTitle = (id) => radioTrack(id)?.title ?? id;
const trackLine = (id) => {
  const track = radioTrack(id);
  return track ? `${track.title} · ${RADIO_REGIONS[track.region]}` : id;
};
const listenersLabel = (count) => (count === 1 ? '1 oyente' : `${count} oyentes`);

/** The "Estaciones" tab: every station on air, the most listened first; one click tunes in. */
export function stationsPanel({ h, api, toast, feed }) {
  const root = h('div', { class: 'station-panel' });
  let stations = null;

  async function load() {
    try {
      stations = (await api('/api/radio/stations')).stations;
    } catch (error) {
      toast(error.message);
      stations = stations ?? [];
    }
    paint();
  }

  function row(station) {
    const on = feed.tuned === station.ownerId;
    const playing = station.nowPlaying ? trackLine(station.nowPlaying.track) : 'En silencio: el DJ todavía no pone nada.';
    return h('div', { class: `station-row${on ? ' is-on' : ''}` },
      h('div', { class: 'station-info' },
        h('b', { class: 'radio-title' }, on ? h('span', { class: 'live-dot on' }) : null, on ? ' ' : '', station.name),
        h('span', { class: 'muted small' }, `DJ ${station.ownerName} · ${listenersLabel(station.listeners)}`),
        h('span', { class: 'small' }, station.nowPlaying ? '♪ ' : '', playing),
      ),
      on
        ? h('button', { class: 'btn sm danger', type: 'button', onclick: () => tune(null) }, '⏹ Dejar de escuchar')
        : h('button', { class: 'btn sm primary', type: 'button', onclick: () => tune(station.ownerId) }, '🎧 Escuchar'),
    );
  }

  function tune(stationId) {
    feed.tune(stationId);
    load();
  }

  function paint() {
    if (!stations) return root.replaceChildren(h('p', { class: 'muted' }, 'Buscando estaciones…'));
    const live = feed.station;
    const shown = stations.map((station) => (live?.ownerId === station.ownerId ? live : station));
    root.replaceChildren(
      h('p', { class: 'muted small' }, 'Cada estación es de un entrenador: el DJ elige la cola y todos escuchan lo mismo, al mismo tiempo.'),
      shown.length ? h('div', { class: 'radio-list' }, shown.map(row)) : h('p', { class: 'muted' }, 'No hay estaciones al aire. Abre la tuya en "Mi estación".'),
    );
  }

  return { root, load, paint };
}

/**
 * The "Mi estación" tab: open your station, see what's on air, edit the queue (every edit sends the
 * whole queue), skip and close. Songs are added from the same filtered list as the "Pistas" tab.
 */
export function myStationPanel({ h, api, toast, feed, session, onChange }) {
  let station;
  // Built once and kept mounted: a frame arriving while the DJ types a name must not wipe it.
  const message = h('p', { class: 'muted' });
  const nameInput = h('input', { type: 'text', maxlength: STATION_NAME_MAX, required: true, placeholder: 'Radio Kanto', 'aria-label': 'Nombre de la estación' });
  const submit = h('button', { class: 'btn sm primary', type: 'submit' });
  const form = h('form', { class: 'station-form', onsubmit: (event) => {
    event.preventDefault();
    const opening = !station;
    act(() => api('/api/radio/station', { method: 'PUT', body: { name: nameInput.value } })).then(() => {
      if (opening && station) feed.tune(station.ownerId);
    });
  } }, nameInput, submit);
  const details = h('div', { class: 'station-panel' });
  const root = h('div', { class: 'station-panel' }, message, form, details);

  async function load() {
    const me = session();
    if (!me) {
      station = undefined;
      return paint();
    }
    try {
      station = (await api(`/api/radio/stations/${encodeURIComponent(me.id)}`)).station;
    } catch (error) {
      if (error.status !== 404) toast(error.message);
      station = null;
    }
    paint();
  }

  async function act(request) {
    try {
      station = (await request()).station;
    } catch (error) {
      toast(error.message);
      // The tab only follows the station while tuned to it, so it can be stale: show where it is now.
      if (error.status === 409) return load();
    }
    paint();
  }

  // `playing` lets the server refuse an edit made on a copy older than the song on air.
  const setQueue = (queue) => act(() => api('/api/radio/station/queue', { method: 'PUT', body: { queue, playing: station.nowPlaying?.startedAt ?? null } }));
  const move = (from, to) => {
    const queue = [...station.queue];
    const [track] = queue.splice(from, 1);
    queue.splice(to, 0, track);
    setQueue(queue);
  };

  /** Adds a song to the end of the queue. */
  function add(trackId) {
    if (station) setQueue([...station.queue, trackId]);
  }

  function queueRow(trackId, index) {
    const last = index === station.queue.length - 1;
    return h('div', { class: 'station-queue-item' },
      h('span', { class: 'radio-title' }, h('span', { class: 'muted' }, `${index + 1}. `), trackTitle(trackId)),
      h('span', { class: 'row' },
        h('button', { class: 'btn sm ghost icon-btn', type: 'button', 'aria-label': 'Subir', disabled: index === 0, onclick: () => move(index, index - 1) }, '↑'),
        h('button', { class: 'btn sm ghost icon-btn', type: 'button', 'aria-label': 'Bajar', disabled: last, onclick: () => move(index, index + 1) }, '↓'),
        h('button', { class: 'btn sm ghost icon-btn', type: 'button', 'aria-label': 'Quitar', onclick: () => setQueue(station.queue.filter((_, i) => i !== index)) }, '✕'),
      ),
    );
  }

  function paint() {
    paintPanel();
    onChange();
  }

  function paintPanel() {
    form.hidden = station === undefined;
    message.hidden = !!station;
    details.hidden = !station;
    if (station === undefined) {
      message.textContent = session() ? 'Cargando tu estación…' : 'Importa tu equipo para abrir tu propia estación.';
      return;
    }
    if (nameInput.ownerDocument.activeElement !== nameInput) nameInput.value = station?.name ?? `Radio de ${session().name}`.slice(0, STATION_NAME_MAX);
    submit.textContent = station ? 'Cambiar nombre' : '📻 Abrir estación';
    if (!station) {
      message.textContent = 'Abre tu estación, arma la cola y deja que otros entren a escuchar lo que pones.';
      return;
    }
    const tunedHere = feed.tuned === station.ownerId;
    const playing = station.nowPlaying;
    details.replaceChildren(
      h('div', { class: 'radio-now' },
        playing
          ? h('p', null, h('span', { class: 'live-dot on' }), ' Al aire ', h('b', null, trackTitle(playing.track)), h('span', { class: 'muted' }, ` · ${listenersLabel(station.listeners)}`))
          : h('p', { class: 'muted' }, 'En silencio: agrega canciones a la cola.'),
        station.queue.length ? null : playing ? h('p', { class: 'muted small' }, 'La cola está vacía: la última canción sigue en loop.') : null,
        h('div', { class: 'row' },
          h('button', { class: 'btn sm', type: 'button', disabled: !station.queue.length, onclick: () => act(() => api('/api/radio/station/skip', { method: 'POST' })) }, '⏭ Saltar'),
          tunedHere ? null : h('button', { class: 'btn sm', type: 'button', onclick: () => { feed.tune(station.ownerId); paint(); } }, '🎧 Escucharla'),
          h('button', { class: 'btn sm danger', type: 'button', onclick: () => {
            if (!confirm('¿Cerrar tu estación? Se borra la cola y los oyentes dejan de escucharla.')) return;
            act(() => api('/api/radio/station', { method: 'DELETE' }));
          } }, 'Cerrar estación'),
        ),
      ),
      h('b', { class: 'small' }, `Cola (${station.queue.length}/${STATION_QUEUE_MAX})`),
      station.queue.length ? h('div', { class: 'station-queue' }, station.queue.map(queueRow)) : h('p', { class: 'muted small' }, 'Elige canciones de la lista de abajo para agregarlas.'),
    );
  }

  /** A `radio` frame of the owner's own station keeps the tab current. */
  function update(view) {
    if (view && station && view.ownerId === station.ownerId) {
      station = view;
      paint();
    }
  }

  return {
    root,
    load,
    paint,
    add,
    update,
    get open() {
      return !!station;
    },
  };
}
