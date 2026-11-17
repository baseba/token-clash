# Token Clash

Batallas por turnos entre jugadores con los Pokémon que cada uno crió en
[PokeTokenBar](https://github.com/chattymin/PokeTokenBar) a punta de tokens.

En vivo: **https://clash.mirrordev.xyz**

## Cómo se juega

1. En PokeTokenBar: Ajustes → Backup & Transfer → Exportar (`PokeTokenBar-Save-YYYY-MM-DD.json`).
   También sirve el archivo vivo `~/Library/Application Support/PokeTokenBar/companion-state.json`.
2. Arrástralo en la web con tu nombre de entrenador. El sitio tiene cuatro pestañas:
   - **Inicio:** tu equipo, las salas abiertas y la nueva batalla.
   - **Colección** (`/coleccion`): tus Pokémon ordenados por número de Pokédex, con filtros por nombre, tipo y
     shiny. Si tienes repetidos de una especie, queda el primero que capturaste (el shiny y el normal se muestran
     los dos, pero en un equipo solo puede ir uno).
   - **Pokédex** (`/pokedex`): las 649 especies de la 1.ª a la 5.ª generación. Las que no tienes salen sin información y las
     que tienes muestran sprite, stats base y línea evolutiva; una preevolución de algo que tienes también queda
     registrada. Cada una tiene un switch para verla shiny si la tienes shiny.
   - **Stats:** tus batallas y torneos, el ranking y las stats del servidor.
3. En **Colección** armas tus 6, los ordenas arrastrando (el primero es el líder) y eliges los
   movimientos y la habilidad de cada uno. "Descargar save editado" baja tu save con esos cambios para
   importarlo de vuelta en PokeTokenBar, y "Actualizar save" sube uno más nuevo.
4. En **Nueva batalla** eliges el modo y el rival:
   - **🎒 Batalla con tu equipo:** los 6 que armaste.
   - **🎲 Batalla aleatoria:** los dados sortean hasta 6 de la colección de cada uno, sin repetir especie, con
     movimientos y habilidad al azar.
   - **Contra otro jugador:** se abre una sala de espera, pública por defecto o privada.
     - **Pública:** si ya hay una sala abierta con el mismo modo y nivel, entras a esa. Si no, se abre la tuya y
       aparece en **Salas abiertas** del inicio, donde cualquiera puede entrar con un clic. La lista se
       actualiza en vivo: las salas nuevas aparecen y las que parten o se cierran desaparecen sin recargar.
     - **Privada:** no aparece en Salas abiertas; solo entra quien tenga el link.
     - Una sala pública deja de aparecer si el anfitrión cierra la página. Cuando alguien entra, los dos se ven en
       la sala y cada uno aprieta **¡Estoy listo!**; con los dos listos parte una cuenta regresiva de 5 s antes de
       elegir sus Pokémon (80 s para elegir). Ningún jugador ve qué eligió el rival ni en qué orden; cuando los dos
       eligen, pasan 4 s y parte la pelea en vivo (60 s por turno; si alguien no elige, su Pokémon ataca solo).
       Cualquiera más con el link puede mirar: en la preparación ve los dos equipos completos, lo que cada uno va
       marcando mientras elige, los 3 elegidos de cada lado durante esos 4 s y, en cada
       Pokémon, contra cuántos rivales tiene ventaja de tipo (⚔️) y cuántos lo amenazan (⚠️). Las IAs esperan a que
       terminen los dados, marcan sus 3 de a uno y confirman 5 s después.
   - **Torneo:** con tu equipo o aleatorio, de 4, 8 o 16 jugadores, en sala pública o privada.
     - El dueño puede rellenar los asientos libres con IAs de cualquier dificultad y quitar a quien quiera.
     - Parte cuando la sala está llena y todos aprietan ¡Estoy listo! (las IAs siempre están listas).
     - Se sortean las llaves con una animación y las peleas se juegan de a una, en orden, cada una con su cuenta
       regresiva. Todos siguen la pelea en curso: si es tuya juegas y si no la miras en modo espectador, con una
       barra y un marco celestes que no se confunden con los de tu propia pelea (dorados).
     - Si una pelea termina empatada, avanza uno por sorteo. Si alguien del torneo no está en la sala de su pelea,
       sus turnos se juegan solos a los 15 s para no frenar al resto.
     - Al final de cada pelea todos ven quién ganó y quién quedó fuera; luego vuelven a las llaves, donde se anima
       al que avanza, y pasan a la siguiente pelea.
     - Las IAs llevan nombres al azar de una lista fija (por ejemplo «nora ai - difícil»), sin repetirse dentro
       de un torneo.
     - Los torneos terminados con al menos 2 personas entran a **Tus torneos** y a la sección **Torneos** de
       `/stats` (campeones, finales y últimos torneos). Sus peleas no suman al ranking 1 contra 1.
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

El motor (`src/combat/domain/battle.ts`) sigue las reglas de los juegos para combates individuales: daño con STAB,
efectividad, críticos y variación; estados y volátiles (confusión, atracción, drenadoras, apresado…); clima,
campos, barreras (Reflejo, Pantalla de Luz, Velo Aurora), trampas de campo, Protección, Sustituto, prioridad,
golpes múltiples y movimientos de cambio, que cambian al Pokémon en el momento. Las habilidades están en
`src/combat/domain/ability-effects.ts` y las reglas especiales de cada movimiento en `src/catalog/domain/move-rules.ts`.

No hay objetos ni combates dobles: los movimientos y habilidades que dependen de eso no tienen efecto en Token
Clash y no se pueden elegir. Si un save trae uno, se reemplaza por otro al azar de los que sí funcionan; si no
hay reemplazo, el Pokémon queda con menos movimientos o sin habilidad. El género sale del save o de la
proporción de la especie, y se muestra porque afecta a movimientos como Atracción.

## Pokémon (PokeAPI)

El save solo aporta números: especie, cadena evolutiva, rareza, nivel, IVs y si es shiny. Todo lo demás sale de
[PokeAPI](https://pokeapi.co): nombre, las seis stats base, tipos reales, habilidades, peso, proporción de
género, de qué especie evoluciona, los movimientos que aprende cada especie por nivel y los sprites (los animados de Negro/Blanco cuando
existen, de frente, de espalda y shiny). Los datos de combate de cada movimiento (prioridad, banderas, efectos)
salen de los datos con licencia MIT de [Pokémon Showdown](https://github.com/smogon/pokemon-showdown). Por
defecto, cada Pokémon usa los últimos movimientos que aprendió hasta su nivel; en `/coleccion` se cambian. Un
Pokémon evolucionado también puede usar lo que aprendían sus preevoluciones hasta ese nivel (Raichu tiene los de
Pichu, Pikachu y Raichu).

Los datos viven en `src/catalog/data/` (`pokeapi.json`, `movedex.json` y `abilities.json`). Los sprites y los gritos no
se versionan: `npm install` descarga los sprites en `public/sprites/` (o `npm run sprites`) y los gritos reales
de [PokeAPI/cries](https://github.com/PokeAPI/cries) en `public/cries/` (o `npm run cries`).
Las animaciones de batalla y sus sonidos vienen de [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets):
`npm install` (o `npm run anims`; `-- --refresh` para bajar todo de nuevo) descarga la animación de cada movimiento
de `src/catalog/data/movedex.json`, las de estados, ataduras, protección, clima, campos y cargas, sus hojas de sprites y
fondos (`public/anims/`), sus sonidos y los efectos de Poké Ball, golpes, debilitado y stats (`public/sfx/`).
El mismo script baja la música de PokeRogue a `public/music/` con sus puntos de loop: cada escena de batalla toca
un tema de combate contra entrenadores acorde a lo que muestra (Alola en la playa, el gimnasio de Sinnoh en la cueva,
el Team Aqua en el océano, la campeona de Sinnoh en la nieve, etc.; la lista está en `public/music.js`), los menús
tocan las pistas tranquilas de bioma (`town`, `tall_grass`, `laboratory`, `plains`), la preparación
`menu` y al ganar suena `bw/victory_trainer` (o `bw/victory_champion` en un torneo). No hay
música sintética. `public/battle-anims.js` las reproduce cuadro a cuadro sobre el campo; lo que no tenga animación usa los efectos
sintéticos de `public/fx.js` y `public/music.js`. El campo de batalla replica el de PokeRogue: un escenario lógico de
320×180 escalado al ancho disponible, con nuestros fondos (`public/backgrounds/`) escalados al ancho del campo y
sus plataformas, los Pokémon anclados en (106, 142) y (236, 84) a tamaño de sprite real, cajas y cuadro de texto con el
estilo del resto de la app, y los mismos tiempos de golpe
(parpadeo), barra de PS (5 ms por punto), debilitado, retirada y entrada con Poké Ball. El servidor nunca llama a la
PokeAPI (en producción no tiene salida a internet). Para refrescar los datos, con Node 22 o más:

```sh
node scripts/import-pokeapi.mjs   # ~2-3 min, reescribe los JSON de src/catalog/data/ y los sprites
```

Las especies que la PokeAPI no conoce quedan como tipo Normal, con stats según su rareza.

Tipos: los 18 reales con la tabla de efectividad real (×2, ×0.5, ×0), en `public/types.js`, que comparten el
servidor y el navegador.

Del save se guarda solo eso (más el total de tokens para las stats); el nombre del equipo, los logs y los
nombres de especies se descartan. Saves importados antes de esta versión: "Actualizar save" para tomar la etapa
evolutiva exacta.

## Créditos

Proyecto sin fines comerciales, para jugar entre amigos. Pokémon y sus nombres son de Nintendo, Creatures Inc. y
GAME FREAK inc.

- Datos y sprites: [PokeAPI](https://pokeapi.co/); gritos: [PokeAPI/cries](https://github.com/PokeAPI/cries).
- Movimientos y su texto: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) (MIT).
- Música: las pistas de [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets) (las
  composiciones de la comunidad, como `cave`, `tall_grass`, `snowy_forest`, `lake`, `sea` o `plains`, son de Bird_Obsession,
  Lmz, Andr06 y Firel con CC BY-NC-SA 4.0; el resto lo marcan como material de Nintendo). Se descargan al instalar.
- Animaciones de batalla, sus sonidos, la Poké Ball y los efectos de sonido: [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets), de
  Pagefault Games y sus colaboradores. Las animaciones y los sonidos `PRSFX-` son de
  [Pokémon Reborn](https://www.rebornevo.com/); las animaciones `GEN8-` son del Gen 8 Animation Project
  (CC BY-NC-SA 4.0). Los audios se descargan al instalar y no se versionan.

## Desarrollo

Backend en [NestJS](https://nestjs.com) con TypeScript, organizado por dominios; datos en SQLite con
[Drizzle](https://orm.drizzle.team). El frontend (`public/`) sigue siendo JS de módulos sin build. Cómo está
armado y por qué: [ARQUITECTURA.md](ARQUITECTURA.md).

```sh
npm install
npm run dev          # compila y levanta http://localhost:8080 (recompila al guardar), datos en ./data
npm test             # typecheck estricto + 200 tests: reglas, motor, IA, persistencia y flujo completo por WebSocket
npm run build        # TypeScript → dist/
npm run db:generate  # tras cambiar un *.schema.ts: genera la migración SQL en drizzle/
```

Node 22.13 o más (usa `node:sqlite`, que viene con Node: no hay módulos nativos que compilar).

| Carpeta | Qué hay |
| --- | --- |
| `src/catalog/` | Especies, movimientos, habilidades y tipos de PokeAPI (`data/*.json`) y la Pokédex. Solo datos y reglas puras. |
| `src/combat/` | El motor de batalla, la elección de 3, el sorteo aleatorio, la IA y Skynet (cliente y proxy de Jev). |
| `src/trainers/` | Entrenadores: importar el save, la colección, el equipo, la sesión. Dueño de `trainers` y `roster_entries`. |
| `src/arena/` | Salas 1 contra 1, emparejamiento, peleas en vivo y torneos. Dueño de `challenges` y `tournament*`. |
| `src/chat/` | El chat de salas y torneos (en memoria). |
| `src/stats/` | La página de stats: solo lee de los otros dominios. |
| `src/realtime/` | El protocolo WebSocket (`/ws`). |
| `src/web/` | El frontend estático y los health checks. |
| `src/shared/` | Configuración, errores de dominio, HTTP (guards, filtro de errores) y la base de datos. |
| `src/legacy/` | La migración única desde `data/db.json`. |
| `drizzle/` | Migraciones SQL generadas por drizzle-kit; la app las aplica al arrancar. |
| `test/` | Tests en TypeScript (`node:test`); `test/web/` son los del frontend, en JS. |

Datos externos:

- `scripts/import-pokeapi.mjs`: genera `src/catalog/data/pokeapi.json`, `movedex.json` y `abilities.json`.
- `scripts/sprites.mjs`: descarga los sprites a `public/sprites/` (corre solo en `npm install`).
- `scripts/sync-battle-anims.js`: compacta las animaciones de PokeRogue en `public/anims/<clave>.json` (versión del jugador y del rival cuando difieren), baja sus imágenes y sonidos y arma `public/sfx/moves/moves.json` con los tiempos de cada sonido (corre solo en `npm install`).
- `scripts/sync-cries.js`: descarga los gritos (`latest` y `legacy`) a `public/cries/` y escribe `cries.json`, que el navegador usa para elegir el archivo según el sprite (corre solo en `npm install`).
- `public/battle-anims.js`: intérprete propio del formato de animación de PokeRogue (cuadros de 50 ms, focos en atacante, objetivo o pantalla, fondos).
- `public/types.js`: tipos y tabla de efectividad, compartidos por el navegador y el servidor.
- Skynet (`src/combat/infrastructure/jev/`) le pasa a Jev solo lo que vería un jugador de ese lado (sin nombres de
  entrenador ni apodos) y las acciones válidas como una pregunta Choice. Si Jev no responde en 4 s o falla, decide la IA
  Muy difícil. Variables: `JEV_API_URL` (en producción, el proxy) o `JEV_API_KEY` para llamar directo a TypeSafe; sin
  ninguna de las dos no hay Skynet. `JEV_MODEL` fija la versión (por defecto `jev-1.14.0`).

### Datos

Todo vive en `DATA_DIR/token-clash.db` (SQLite, modo WAL). Nada se borra: los desafíos y torneos quedan para siempre.
Hasta la versión 0.1 los datos estaban en `data/db.json`: el primer arranque con SQLite lo importa entero en una
transacción y lo deja intacto como respaldo (si un deploy vuelve a la imagen anterior, esa sigue encontrando sus datos).
No se vuelve a importar. Para comprobar una copia real sin tocar nada:
`LEGACY_DB=/ruta/a/db.json node --test dist/test/legacy-import.test.js` (tras `npm test` o `npm run build`).

Las batallas en curso viven en memoria: reiniciar el servicio corta las peleas activas (quedan como "cortadas").

## Deploy (Podman + Cloudflare Tunnel)

La app corre en un contenedor sin puertos publicados, solo lectura, sin capabilities, en una red interna
sin salida. Solo `cloudflared` (en esa red y en una con salida) la alcanza. Los datos viven en `./data`
(`token-clash.db`, más el `db.json` de antes de SQLite como respaldo).
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
