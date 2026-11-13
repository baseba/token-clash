# Token Clash

Batallas por turnos entre jugadores con los Pokémon que cada uno crió en
[PokeTokenBar](https://github.com/chattymin/PokeTokenBar) a punta de tokens.

En vivo: **https://clash.mirrordev.xyz**

## Cómo se juega

1. En PokeTokenBar: Ajustes → Backup & Transfer → Exportar (`PokeTokenBar-Save-YYYY-MM-DD.json`).
   También sirve el archivo vivo `~/Library/Application Support/PokeTokenBar/companion-state.json`.
2. Arrástralo en la web con tu nombre de entrenador. Tu colección queda en el inicio, ordenada por número de
   Pokédex, con filtros por nombre, tipo y shiny. Si tienes repetidos de una especie, queda el primero que
   capturaste (el shiny y el normal se muestran los dos, pero en un equipo solo puede ir uno).
3. En **Tu equipo** (`/equipo`) armas tus 6, los ordenas arrastrando (el primero es el líder) y eliges los
   movimientos y la habilidad de cada uno. "Descargar save editado" baja tu save con esos cambios para
   importarlo de vuelta en PokeTokenBar.
4. En **Nueva batalla** eliges el modo y el rival:
   - **🎒 Batalla con tu equipo:** los 6 que armaste.
   - **🎲 Batalla aleatoria:** los dados sortean hasta 6 de la colección de cada uno, sin repetir especie, con
     movimientos y habilidad al azar.
   - **Contra otro jugador:** te damos un link para mandarle. Cuando acepta, pelean en vivo (60 s por turno; si
     alguien no elige, su Pokémon ataca solo). Cualquiera más con el link puede mirar.
   - **Contra la IA:** Fácil, Media, Difícil, Muy difícil o Skynet, con Pokémon de la 1.ª a la 5.ª generación.
     Con tu equipo, los dados sortean sus 6 entre Pokémon completamente evolucionados, y cada dificultad acota
     ese grupo a los más fuertes por estadísticas base (100 %, 80 %, 60 %, 50 % y 40 %); en aleatoria sortea
     entre todos los completamente evolucionados y la dificultad solo cambia cómo pelea. **Skynet** le pregunta
     en cada turno a [Jev](https://docs.typesafe.ai) (el modelo de decisiones de TypeSafe) qué ataque usar o a
     quién sacar; solo aparece si el servidor tiene cómo llegar a Jev (ver Deploy). Las peleas contra la IA no
     cuentan para el ranking ni quedan en tu historial.

   En todos los modos, cada uno ve los 6 del otro (con sus tipos) y elige 3. La opción "Todos a nivel 50"
   empareja la pelea para que gane la estrategia.
5. **Stats** (`/stats`) muestra el ranking (solo quienes han peleado contra otro jugador), las batallas
   recientes, los Pokémon más usados y los totales del servidor. Quien importó el mismo save en varias cuentas
   cuenta como un solo entrenador, y sus Pokémon y tokens se suman una sola vez.

## Combate

El motor (`server/battle.js`) sigue las reglas de los juegos para combates individuales: daño con STAB,
efectividad, críticos y variación; estados y volátiles (confusión, atracción, drenadoras, apresado…); clima,
campos, barreras (Reflejo, Pantalla de Luz, Velo Aurora), trampas de campo, Protección, Sustituto, prioridad,
golpes múltiples y movimientos de cambio, que cambian al Pokémon en el momento. Las habilidades están en
`server/abilities.js` y las reglas especiales de cada movimiento en `server/moves.js`.

No hay objetos ni combates dobles: los movimientos y habilidades que dependen de eso no tienen efecto en Token
Clash y no se pueden elegir. Si un save trae uno, se reemplaza por otro al azar de los que sí funcionan; si no
hay reemplazo, el Pokémon queda con menos movimientos o sin habilidad. El género sale del save o de la
proporción de la especie, y se muestra porque afecta a movimientos como Atracción.

## Pokémon (PokeAPI)

El save solo aporta números: especie, cadena evolutiva, rareza, nivel, IVs y si es shiny. Todo lo demás sale de
[PokeAPI](https://pokeapi.co): nombre, las seis stats base, tipos reales, habilidades, peso, proporción de
género, los movimientos que aprende cada especie por nivel y los sprites (los animados de Negro/Blanco cuando
existen, de frente, de espalda y shiny). Los datos de combate de cada movimiento (prioridad, banderas, efectos)
salen de los datos con licencia MIT de [Pokémon Showdown](https://github.com/smogon/pokemon-showdown). Por
defecto, cada Pokémon usa los últimos movimientos que aprendió hasta su nivel; en `/equipo` se cambian.

Los datos viven en `server/pokeapi.json`, `server/movedex.json` y `server/abilities.json`. Los sprites no se
versionan: `npm install` los descarga en `public/sprites/` (o `npm run sprites`). El servidor nunca llama a la
PokeAPI (en producción no tiene salida a internet). Para refrescar los datos, con Node 22 o más:

```sh
node scripts/import-pokeapi.mjs   # ~2-3 min, reescribe los JSON de server/ y los sprites
```

Las especies que la PokeAPI no conoce quedan como tipo Normal, con stats según su rareza.

Tipos: los 18 reales con la tabla de efectividad real (×2, ×0.5, ×0), en `public/types.js`, que comparten el
servidor y el navegador.

Del save se guarda solo eso (más el total de tokens para las stats); el nombre del equipo, los logs y los
nombres de especies se descartan. Saves importados antes de esta versión: "Actualizar save" para tomar la etapa
evolutiva exacta.

## Desarrollo

```sh
npm install
npm run dev     # http://localhost:8080, datos en ./data
npm test        # parser, motor de batalla, IA, stats y flujo completo con WebSocket
```

- `server/save.js`: lee el export (`format: "poketokenbar.save"`) o el estado crudo.
- `server/creatures.js`: especie → datos de PokeAPI (nombre, stats, tipos, género) y sus movimientos.
- `scripts/import-pokeapi.mjs`: genera `server/pokeapi.json`, `server/movedex.json` y `server/abilities.json`.
- `scripts/sprites.mjs`: descarga los sprites a `public/sprites/` (corre solo en `npm install`).
- `public/types.js`: tipos y tabla de efectividad.
- `server/battle.js`: motor puro de batalla (aleatoriedad inyectada).
- `server/moves.js` y `server/abilities.js`: reglas especiales de movimientos y habilidades.
- `server/stats.js`: ranking y totales de la página de stats.
- `server/ai.js`: la IA: arma su equipo y elige qué hacer cada turno (aleatoriedad inyectada).
- `server/jev.js`: Skynet. Le pasa a Jev solo lo que vería un jugador de ese lado (sin nombres de entrenador ni
  apodos) y las acciones válidas como una pregunta Choice. Si Jev no responde en 4 s o falla, decide la IA Muy difícil.
  Variables: `JEV_API_URL` (en producción, el proxy) o `JEV_API_KEY` para llamar directo a TypeSafe; sin ninguna
  de las dos no hay Skynet. `JEV_MODEL` fija la versión (por defecto `jev-1.14.0`).
- `server/jev-proxy.js`: el proxy de salida de Skynet (ver Deploy).
- `server/random.js`: sorteo de la batalla aleatoria (equipo, movimientos y habilidad; aleatoriedad inyectada).
- `server/index.js`: HTTP + WebSocket, desafíos, ranking. Persistencia en `data/db.json`.
- `public/`: frontend sin build (JS de módulos); `public/fx.js` dibuja los efectos de los movimientos y estados.

Las batallas en curso viven en memoria: reiniciar el servicio corta las peleas activas (quedan como "cortadas").

## Deploy (Podman + Cloudflare Tunnel)

La app corre en un contenedor sin puertos publicados, solo lectura, sin capabilities, en una red interna
sin salida. Solo `cloudflared` (en esa red y en una con salida) la alcanza. Los datos viven en `./data`.
Para Skynet, la app le pregunta a Jev a través de `token-clash-jev`, un proxy en las mismas dos redes que solo
reenvía `POST /v1/systemone` a TypeSafe y le agrega la clave: la app sigue sin salida y sin la clave.

| Archivo | Se instala como |
| --- | --- |
| `deploy/Containerfile` | imagen `localhost/token-clash:latest` |
| `deploy/token-clash.network`, `deploy/token-clash-egress.network` | `~/.config/containers/systemd/` |
| `deploy/token-clash.container`, `deploy/cloudflared-token-clash.container`, `deploy/token-clash-jev.container` | `~/.config/containers/systemd/` |

Túnel (ya creado, una sola vez): `cloudflared tunnel create token-clash`,
`cloudflared tunnel route dns token-clash clash.mirrordev.xyz`, y el token directo al secret
`cloudflared-token-clash-token` de Podman.

Clave de Jev (una sola vez): `podman secret create token-clash-jev-key archivo-con-la-clave`. Sin el proxy
corriendo, Skynet sigue apareciendo pero juega como Muy difícil (`journalctl --user -u token-clash` lo avisa).

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
systemctl --user restart token-clash-jev   # usa la misma imagen
```

Volver a la versión anterior: `podman tag token-clash:previous token-clash:latest && systemctl --user restart token-clash`.
