# Token Clash

Batallas por turnos entre jugadores con los Pokémon que cada uno crió en
[PokeTokenBar](https://github.com/chattymin/PokeTokenBar) a punta de tokens.

En vivo: **https://clash.mirrordev.xyz**

> **Un proyecto personal, solo para jugar entre compañeros de pega.** Token Clash no es un juego para el público ni
> lo va a ser: no se publica, no se promociona, no se vende y no tiene ni va a tener ningún uso comercial. El código
> está a la vista y el sitio existe para que un grupo chico de compañeros de trabajo juegue entre sí, nada más. No
> tiene relación con Nintendo, Creatures, GAME FREAK ni The Pokémon Company, ni con los fan games y proyectos cuyos
> datos y recursos usamos (PokeAPI, Pokémon Showdown, PokeRogue, Pokémon Reborn, pokeemerald-rogue, los decompilados
> de pret y otros): sus autores no lo respaldan ni participan en él. Cada recurso lleva su crédito en
> [Créditos](#créditos). Si eres autor de alguno y prefieres que no lo usemos, abre un issue y lo sacamos.

## Cómo se juega

1. En PokeTokenBar: Ajustes → Backup & Transfer → Exportar (`PokeTokenBar-Save-YYYY-MM-DD.json`).
2. En la web, **Crear cuenta** con tu nombre de entrenador, una contraseña y el save. Con el mismo nombre y
   contraseña entras desde otro dispositivo.
3. En **Colección** armas tu equipo de 6 y eliges los movimientos y la habilidad de cada uno.
4. En **Nueva batalla** eliges el modo: con tu equipo o aleatoria (los dados sortean de tu colección), contra otro
   jugador (sala pública o privada), un torneo de 4, 8 o 16, o contra la IA. **La Torre** es una subida de pisos
   con Pokémon de tu colección que crecen en el camino.

Cada uno ve los 6 del otro y elige 3. Todos pelean a nivel 100, sin importar el nivel del save: gana la estrategia,
no quién quemó más tokens. Fuera de la Torre no hay objetos, y no hay combates dobles. Lo demás se ve jugando.

## Desarrollo

```sh
nvm use              # toma la versión de .nvmrc
npm install
npm run dev          # compila y levanta http://localhost:8080 (recompila al guardar), datos en ./data
npm test             # typecheck, chequeos, specs, e2e y tests del frontend
npm run build        # TypeScript → dist/
npm run db:generate  # tras cambiar un *.schema.ts: genera la migración SQL en drizzle/
```

Node 22.13 o más (usa `node:sqlite`). `npm run dev` y `npm test` avisan si la versión de tu terminal es más vieja.
Para probar sin tu propio save, sube `test/fixtures/export.json`. Las reglas del código están en
[AGENTS.md](AGENTS.md).

### El parche de PokeTokenBar (`public/poketokenbar/`)

El PokeTokenBar oficial cría solo hasta la #649. `gen6-9.patch` lo abre hasta la #1025: regiones de Kalos a Paldea,
sprites animados de las mismas tiras de Essentials que usa el juego, y los graduados con la cadena cortada que pasan a
su forma final nueva. `install.sh` clona el tag oficial, revisa su commit, aplica el parche y compila la app en el Mac
del jugador; Colección muestra el comando. `test/web/poketokenbar-patch.test.js` revisa que el parche anime las mismas
especies con los mismos archivos y tiempos que `public/upstream/essentials.json`.

Cuando PokeTokenBar saque una versión nueva, aplica el parche sobre ella y vuelve a exportarlo:

```sh
git clone https://github.com/chattymin/PokeTokenBar.git && cd PokeTokenBar
git switch -c gen6-9 v2.5.7 && git am ../token-clash/public/poketokenbar/gen6-9.patch
git rebase --onto <tag nuevo> v2.5.7 && swift test
git format-patch --stdout --no-signature <tag nuevo>..HEAD > ../token-clash/public/poketokenbar/gen6-9.patch
```

y cambia `TAG` y `COMMIT` en `install.sh`.

Cada cambio al parche lleva una versión nueva en `version.json`: la versión oficial más un número de build
(`2.5.7.1`, `2.5.7.2`…) y el `sha256` del parche, que el test exige. El instalador la graba en la app junto a la
dirección de Token Clash, y la app parchada solo ofrece actualizarse cuando `version.json` trae una más nueva: el
aviso abre Colección con el comando, nunca la versión oficial.

### Chequeo de estructura (`npm run deslop`)

`tools/deslop/` es un port de [`deslop-please`](https://github.com/deterministic-machines/deslop-please) a
TypeScript. Revisa `src/` y corre en `npm test`: cualquier diagnóstico hace fallar el test. El código de test no
cuenta.

| Regla | Reporta |
| --- | --- |
| `module-cycle` | Carpetas o archivos hermanos que se usan en círculo. |
| `tangle` | Clases, funciones o constantes que se conocen en círculo, en más de un módulo o más de siete. |
| `field-leak` | Código de afuera que trabaja sobre un campo de una clase que guarda sus campos. |
| `shallow-module` | Una carpeta que muestra más de siete funciones, con una lista de más de siete, y no esconde más de las que muestra. Un dominio con módulo de Nest se juzga entero, no capa por capa. |
| `wide-directory` | Una carpeta con más de 15 archivos y carpetas. |
| `long-file` | Un archivo con más de 2.000 líneas. |

Hay una sola excepción, en `tools/deslop/debt.allow`: `shallow-module` en `src::catalog::domain`, una biblioteca
de consulta que usan cinco dominios y `web`, cada uno para algo distinto. El día que el catálogo deje de mostrar
más de lo que esconde, borra la entrada: una entrada que ya no hace falta solo avisa, no falla. Un diagnóstico
nuevo se arregla en el código, no en ese archivo. Para ver también lo excusado: `node dist/tools/deslop/main.js`
sin `--allow`.

Cada diferencia a propósito con el original y cada caso que la regla no ve está fijado en una fila de
`tools/deslop/lint/leaks.rows.spec.ts`, `leaks.spec.ts` (por ejemplo `Object.assign`), `check.parity.spec.ts`,
`shallow.spec.ts` o `tools/deslop/cli.spec.ts`. Una forma nueva se agrega como fila. Todavía sin fila, `field-leak`
tampoco ve: un cast aplicado después del uso, `Reflect` y `.call`, las claves computadas, el estado en closures o en
variables de módulo, y los generadores.

## Cómo está armado

Una carpeta de `src/` por dominio (`trainers`, `arena`, `combat`, `catalog`, `tower`, `radio`, `chat`, `stats`),
más `realtime` (WebSocket), `web` (archivos estáticos y vistas previas de links), `shared`, `platform` (la plomería
de Nest) y `app` (la raíz de composición). `src/architecture.spec.ts` dice en una tabla qué carpeta usa a cuál.

### ¿Por qué no se ve como la guía de Nest?

La guía de Nest arma una carpeta por feature con su `dto/`, `entities/`, controller, service y module. Acá el primer
nivel es igual, una carpeta por dominio con su `*.module.ts`, pero adentro hay capas:

| Guía por feature | Acá | Por qué |
| --- | --- | --- |
| `users.service.ts` hace reglas y acceso a datos | `domain/` (reglas) + `application/` (casos de uso) | las reglas se testean sin Nest ni base de datos |
| `entities/user.entity.ts` es el objeto y la tabla a la vez | `domain/trainer.ts` + `infrastructure/trainer.schema.ts` + un mapper | el dominio no depende de cómo se guarda |
| `dto/` junto al controller | `interface/dto/` | igual, dentro de la capa que habla HTTP |

Para un CRUD basta la estructura por feature. Las capas valen la pena cuando hay reglas de verdad (un torneo, una
pelea, un equipo que no repite especie) y para mostrar la regla de dependencia, que es el objetivo de esta demo:

```
src/trainers/
  domain/           reglas en TypeScript puro: trainer.ts, save-file.ts y el puerto trainer.repository.ts
  application/      casos de uso: trainers.service.ts, accounts.service.ts, shop.service.ts
  infrastructure/   el adaptador: trainer.schema.ts (Drizzle), trainer.mapper.ts, drizzle-trainer.repository.ts
  interface/        HTTP: dto/, trainers.controller.ts, session.guard.ts, trainer.presenter.ts
  trainers.module.ts
```

`domain/` no importa ninguna otra capa, ni Nest, ni Drizzle. El puerto es una clase abstracta que sirve de token de
inyección, y el módulo exporta sus servicios, nunca su repositorio: otro dominio que quiere cambiar algo de
`trainers` se lo pide a `TrainersService`.

### Recorrido de una petición

`POST /api/challenges/:id/accept`, entrar a la sala de otro:

```
SecurityHeadersMiddleware, ApiProtectionMiddleware   cabeceras, origen y límite por IP   (platform/http)
SessionGuard (@Authenticated)                        Bearer token → Trainer, o 401       (trainers/interface)
ChallengesController.accept                          lee la URL, llama al caso de uso    (arena/interface)
ChallengesService.accept                             orquesta                            (arena/application)
  joinBlocker(challenge, …)                          ¿se puede entrar? regla pura        (arena/domain/lobby.ts)
    Challenge.joinBlocker(trainerId)                   las reglas de la sala misma       (arena/domain)
  DuelService.join → Challenge.join(...)             cambia el agregado                  (arena/domain)
    ChallengeRepository.save(challenge)                lo guarda                         (arena/infrastructure)
ArenaViews.challenge                                 lo que ve el cliente                (arena/application)
```

Si una regla dice que no, el dominio lanza un `DomainError` con un tipo (`conflict`, `not-found`…), nunca un código
HTTP, y `DomainErrorFilter` (`platform/http`) lo traduce a 409, 404… Un DTO (un esquema de Zod en `interface/dto/`)
revisa la forma de la petición antes del controller, con `@Body({ schema: NewChallengeDto })`. Lo que depende del
estado, como si al torneo le queda lugar, lo revisa el dominio.

### Cómo agregar algo

Ejemplo: "un entrenador puede ponerle un título a su perfil".

1. **Dominio:** `title` en `TrainerState` y `Trainer.setTitle()` con sus reglas, probado en `trainer.spec.ts`.
2. **Persistencia:** la columna en `trainer.schema.ts`, el campo en `trainer.mapper.ts` y `npm run db:generate`.
3. **Caso de uso:** `TrainersService.updateProfile()` llama a `setTitle()` y guarda.
4. **Entrada:** `title` en `UpdateProfileDto` (y en `trainer-dtos.spec.ts`), y en `trainerSummary` para que el
   frontend lo vea.

Si la arena quiere mostrar el título, lo pide con `TrainersService.byId()`. Nunca lee la tabla `trainers`.

## Tu primer PR

Necesitas una cuenta de GitHub, [Git](https://git-scm.com/downloads) y Node 22.13 o más nuevo.

1. **Haz fork.** En https://github.com/baseba/token-clash aprieta **Fork** y después **Create fork**.
2. **Clona tu fork:**

   ```sh
   git clone https://github.com/<tu-usuario>/token-clash.git
   cd token-clash
   git remote add upstream https://github.com/baseba/token-clash.git
   ```

   `origin` es tu fork, donde subes tus cambios; `upstream` es el repo original, de donde traes lo nuevo.
3. **Crea una rama.** No trabajes directo en `main`: `git switch -c arregla-bug-de-la-tienda`.
4. **Haz el cambio y pruébalo** con `npm install`, `npm run dev` y `npm test` (ver [Desarrollo](#desarrollo)).
   `npm test` tiene que pasar.
5. **Commitea y sube la rama:**

   ```sh
   git status
   git add -A
   git commit -m "fix(shop): el botón de comprar se desactiva sin tokens"
   git push -u origin arregla-bug-de-la-tienda
   ```

   Revisa en `git status` que vayan solo los archivos que cambiaste.
6. **Abre el PR.** En tu fork aparece **Compare & pull request** (si no, **Pull requests** → **New pull request**).
   Revisa que diga `base repository: baseba/token-clash` y `base: main`. Ponle un título como `fix(shop): …` y cuenta
   qué arregla y por qué.
7. **Responde la revisión** con más commits en la misma rama y `git push`: el PR se actualiza solo.

`main` solo acepta PRs con el CI en verde, y al mergear se despliega solo a https://clash.mirrordev.xyz. Si `main`
avanzó mientras trabajabas, commitea lo tuyo y ponte al día con `git fetch upstream` y `git rebase upstream/main`.
Si Git se detiene por un conflicto, arregla los archivos que nombra, haz `git add` de cada uno y sigue con
`git rebase --continue` (`git rebase --abort` te deja como estabas). Después corre `npm test` de nuevo. Si ya habías
subido la rama, súbela con `git push --force-with-lease`.

¿Solo quieres reportar un bug o proponer una idea? Abre un [issue](https://github.com/baseba/token-clash/issues/new).

## Deploy

La app corre en Podman, en un contenedor sin puertos publicados, solo lectura, sin capabilities y en una red interna
sin salida. Solo `cloudflared` (en esa red y en una con salida) la alcanza. Skynet le pregunta a Jev por
`token-clash-jev`, un proxy en las mismas dos redes que reenvía `POST /v1/systemone` a TypeSafe y le agrega la
clave: la app no tiene salida ni la clave. Los datos viven en `DATA_DIR/token-clash.db` (SQLite) y nada se borra.
Las peleas en curso viven en memoria: reiniciar las corta.

Una sola vez: el túnel (`cloudflared tunnel create token-clash`,
`cloudflared tunnel route dns token-clash clash.mirrordev.xyz` y su token en el secret
`cloudflared-token-clash-token` de Podman) y la clave de Jev
(`podman secret create token-clash-jev-key archivo-con-la-clave`). Sin el proxy, Skynet juega como Muy difícil.

**Automático.** `token-clash-deploy.timer` corre `deploy/deploy.sh` cada 2 minutos: cuando `origin/main` tiene un
commit con el CI en verde y no hay peleas en curso, construye la imagen y reinicia, y si no queda sana vuelve a la
anterior. Un cambio en `deploy/*.container`, `*.network`, `*.service`, `*.timer` o `deploy.sh` no se despliega solo:
queda en el log (`journalctl --user -u token-clash-deploy -n 50`) hasta que alguien lo instale a mano. Para instalar
o actualizar el deploy automático:

```sh
cd ~/code/token-clash
install -m 755 deploy/deploy.sh ~/.local/bin/token-clash-deploy
cp deploy/token-clash-deploy.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now token-clash-deploy.timer
```

**A mano**, para cambios del host o con el automático apagado, cuando nadie esté peleando:

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

## Créditos

Proyecto personal sin fines comerciales, que no se publica para el público: existe solo para jugar entre
compañeros de pega (ver la nota del inicio). Pokémon y sus nombres son de Nintendo, Creatures Inc. y GAME FREAK inc.
Los datos y recursos de terceros son de sus autores, con sus licencias; aquí solo se usan para ese fin.

- Datos y sprites: [PokeAPI](https://pokeapi.co/) (especies, stats, tipos, habilidades y movimientos que aprende
  cada una, en `src/catalog/data/`); gritos: [PokeAPI/cries](https://github.com/PokeAPI/cries).
- Sprites animados de 6ª a 9ª generación: el pack del [Animated Pokemon System](https://eeveeexpo.com/resources/1544/)
  de Lucidious89 (basado en el Generation 8 Pack de Golisopod User y en EBDX de Luka S.J.), que tomamos de la copia de
  [rh-hideout-chinese/pokemon-engine](https://github.com/rh-hideout-chinese/pokemon-engine) fijada a un commit. Los
  sprites son de los colaboradores de los Smogon X/Y, Sun/Moon, Sword/Shield y Scarlet/Violet Sprite Projects, de los
  autores del plugin "Sprites Animados" (Tenshi of War, DPertierra, Skyflyer y los demás que lista el pack) y de
  Lucidious89, Regis, Rod, Kayzering y LcorpOfficial; el frente de Xerneas, que el pack trae quieto, es el de
  [Pokémon Showdown](https://play.pokemonshowdown.com/sprites/) (material de Nintendo, Creatures y GAME FREAK).
  `npm run sprites` los ubica (`public/upstream/essentials.json`) y `npm install` los baja y convierte en PNG
  animados en `public/animated/`; no se versionan.
- Movimientos y su texto: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) (MIT), de donde salen los
  datos de combate de cada movimiento.
- Música: las pistas de [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets) (las
  composiciones de la comunidad, como `cave`, `tall_grass`, `snowy_forest`, `lake`, `sea` o `plains`, son de Bird_Obsession,
  Lmz, Andr06 y Firel con CC BY-NC-SA 4.0; el resto lo marcan como material de Nintendo). El navegador las carga de jsDelivr.
- Sprites de entrenadores: [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets) (material de Nintendo,
  Creatures y GAME FREAK; `bug_type_superfan` es de Chani von Karpa y `aliana`, `celosia` y `mable` de Red, con
  CC BY-NC-SA 4.0). Se descargan al instalar y no se versionan.
- La Torre: íconos de objetos de [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets) (CC BY-NC-SA 4.0
  salvo lo que marcan como material de Nintendo) y de [PokeAPI/sprites](https://github.com/PokeAPI/sprites) (los
  objetos equipados), que el navegador carga de jsDelivr; sprites de mapa de los entrenadores de
  [Pokabbie/pokeemerald-rogue](https://github.com/Pokabbie/pokeemerald-rogue) y de los decompilados
  [pret/pokeemerald](https://github.com/pret/pokeemerald), [pret/pokefirered](https://github.com/pret/pokefirered) y
  [pret/pokeplatinum](https://github.com/pret/pokeplatinum) (material de Nintendo, Creatures y GAME FREAK). Se
  descargan al instalar, fijados a un commit, y no se versionan.
- Animaciones de batalla, sus sonidos, la Poké Ball y los efectos de sonido: [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets), de
  Pagefault Games y sus colaboradores. Las animaciones y los sonidos `PRSFX-` son de
  [Pokémon Reborn](https://www.rebornevo.com/); las animaciones `GEN8-` son del Gen 8 Animation Project
  (CC BY-NC-SA 4.0). El navegador carga las hojas y los audios de jsDelivr; no se versionan.
- Fuente de la miniatura de los links: [Nunito](https://github.com/googlefonts/nunito), de The Nunito Project Authors
  (SIL Open Font License 1.1, en `assets/fonts/OFL.txt`).
