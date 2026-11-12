# Token Clash

Batallas por turnos entre colegas con las criaturas que cada uno crió en
[PokeTokenBar](https://github.com/chattymin/PokeTokenBar) a punta de tokens.

En vivo: **https://clash.mirrordev.xyz**

## Cómo se juega

1. En PokeTokenBar: Ajustes → Backup & Transfer → Exportar (`PokeTokenBar-Save-YYYY-MM-DD.json`).
   También sirve el archivo vivo `~/Library/Application Support/PokeTokenBar/companion-state.json`.
2. Arrástralo en la web con tu nombre de entrenador. Arma un equipo de 3.
3. "Crear link de desafío" → mándaselo a un colega. Cuando acepta, pelean en vivo (60 s por turno;
   si alguien no elige, su criatura ataca sola). Cualquiera más con el link puede mirar.
4. Ranking de victorias en la portada. Opción "Todos a nivel 50" para que gane la estrategia.

## Criaturas (PokeAPI)

El save solo aporta números: especie, cadena evolutiva, rareza, nivel, IVs y si es brillante. Todo lo demás sale de
[PokeAPI](https://pokeapi.co): nombre, stats base (ataque y ataque especial se promedian, igual defensa y defensa
especial), tipos reales (uno o dos) y sprites de frente y espalda, también los brillantes. Los ataques son nombres
reales de movimientos elegidos según los tipos de la especie (`species()` en `server/creatures.js`).

Los datos viven en `server/pokeapi.json` y `public/sprites/`. El servidor nunca llama a la PokeAPI (en producción no
tiene salida a internet). Para refrescarlos, con Node 22 o más:

```sh
node scripts/import-pokeapi.mjs   # ~2-3 min, reescribe server/pokeapi.json y public/sprites/
```

Las especies que la PokeAPI no conoce quedan como tipo Normal, con stats según su rareza.

Tipos: los 18 reales con la tabla de efectividad real (×2, ×0.5, ×0), en `public/types.js`, que comparten el
servidor y el navegador.

Del save se guarda solo eso (más el total de tokens para el ranking); el nombre del equipo, los logs y los
nombres de especies se descartan. Saves importados antes de esta versión: "Actualizar save" para tomar la etapa
evolutiva exacta.

## Desarrollo

```sh
npm install
npm run dev     # http://localhost:8080, datos en ./data
npm test        # parser, motor de batalla y flujo completo con WebSocket
```

- `server/save.js`: lee el export (`format: "poketokenbar.save"`) o el estado crudo.
- `server/creatures.js`: especie → datos de PokeAPI (nombre, stats, tipos) y sus ataques.
- `scripts/import-pokeapi.mjs`: genera `server/pokeapi.json` y `public/sprites/`.
- `public/types.js`: tipos y tabla de efectividad.
- `server/battle.js`: motor puro de batalla (aleatoriedad inyectada).
- `server/index.js`: HTTP + WebSocket, desafíos, ranking. Persistencia en `data/db.json`.
- `public/`: frontend sin build (JS de módulos, sprites PNG).

Las batallas en curso viven en memoria: reiniciar el servicio corta las peleas activas (quedan como "cortadas").

## Deploy (Podman + Cloudflare Tunnel)

La app corre en un contenedor sin puertos publicados, solo lectura, sin capabilities, en una red interna
sin salida. Solo `cloudflared` (en esa red y en una con salida) la alcanza. Los datos viven en `./data`.

| Archivo | Se instala como |
| --- | --- |
| `deploy/Containerfile` | imagen `localhost/token-clash:latest` |
| `deploy/token-clash.network`, `deploy/token-clash-egress.network` | `~/.config/containers/systemd/` |
| `deploy/token-clash.container`, `deploy/cloudflared-token-clash.container` | `~/.config/containers/systemd/` |

Túnel (ya creado, una sola vez): `cloudflared tunnel create token-clash`,
`cloudflared tunnel route dns token-clash clash.mirrordev.xyz`, y el token directo al secret
`cloudflared-token-clash-token` de Podman.

### Deploy automático

En el servidor, `token-clash-deploy.timer` corre `deploy/deploy.sh` cada 2 minutos. Desde GitHub nadie entra al
servidor: es el servidor el que va a buscar los cambios. Cuando `origin/main` tiene un commit nuevo:

1. Espera a que el CI de ese commit (`test` y `container`) esté en verde. Si falla, ese commit no se despliega.
2. Espera a que no haya peleas en curso (`/healthz/battles`, solo responde desde dentro del contenedor).
3. Hace fast-forward de `~/code/token-clash`, construye la imagen (la anterior queda como `token-clash:previous`) y
   reinicia. Si no queda sana, vuelve a la imagen anterior y no reintenta ese commit.

Si cambia algo del host (`deploy/*.container`, `*.network`, `*.service`, `*.timer` o el propio `deploy.sh`), no
despliega y lo deja anotado en el log: esos cambios se instalan a mano (abajo). Así, un PR mergeado nunca cambia
lo que corre fuera del contenedor.

```sh
journalctl --user -u token-clash-deploy -n 50   # qué hizo
systemctl --user list-timers token-clash-deploy # cuándo vuelve a mirar
```

Instalar o actualizar el deploy automático:

```sh
cd ~/code/token-clash
install -m 755 deploy/deploy.sh ~/.local/bin/token-clash-deploy
cp deploy/token-clash-deploy.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now token-clash-deploy.timer
```

### Deploy a mano

Para cambios del host, o si el automático está apagado (cuando nadie esté peleando):

```sh
cd ~/code/token-clash
git pull --ff-only
cp deploy/*.container deploy/*.network ~/.config/containers/systemd/   # si cambiaron
systemctl --user daemon-reload
podman tag token-clash token-clash:previous
podman build --format docker -t token-clash -f deploy/Containerfile .
systemctl --user restart token-clash
```

Volver a la versión anterior: `podman tag token-clash:previous token-clash:latest && systemctl --user restart token-clash`.
