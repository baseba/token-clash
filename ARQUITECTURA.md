# Arquitectura

Token Clash es un backend de NestJS armado por **dominios** (bounded contexts, en el vocabulario de DDD). Este
documento explica cómo está organizado, qué reglas sigue y por qué, usando el propio juego como ejemplo.

## 1. Los dominios

Cada carpeta de `src/` es un dominio con su propio lenguaje y sus propias reglas:

| Dominio | De qué se trata | Dueño de |
| --- | --- | --- |
| `catalog` | Especies, movimientos, habilidades y tipos (datos de PokeAPI y Pokémon Showdown), la Pokédex, los artículos de la tienda, los sprites de entrenador y las canciones de la radio con su duración | archivos `src/catalog/data/*.json` y las listas compartidas de `public/` |
| `combat` | Cómo se pelea: motor de batalla, qué movimientos se pueden usar, elegir 3 de 6, sorteo aleatorio, IA, Skynet | nada (es puro) |
| `trainers` | Quién juega: entrenador, colección, equipo, cuenta y sesiones, importar el save | tablas `trainers`, `roster_entries`, `trainer_sessions` |
| `arena` | Dónde se pelea: salas, emparejamiento, peleas en vivo, torneos | tablas `challenges`, `tournaments`, `tournament_seats`, `tournament_matches` |
| `chat` | Mensajes en salas y torneos | memoria (se borra al reiniciar, a propósito) |
| `radio` | Las estaciones de los entrenadores: la cola que elige el dueño, qué suena y quién escucha | tabla `radio_stations` (los oyentes, en memoria) |
| `tower` | La Torre: subidas con tu colección, pisos y caminos, experiencia, evolución, premios y récords | tabla `tower_runs` |
| `stats` | La página de stats y los logros | nada: lee de los otros dominios y le pide los cambios a `trainers` |

Más tres piezas que no son dominios sino entradas y plomería: `realtime` (el protocolo WebSocket), `web`
(archivos estáticos, health checks y la vista previa de los links, que lee la arena con `ArenaQueries`) y `shared` (configuración, errores, HTTP, base de datos).

```
           realtime (WS)   web          HTTP controllers de cada dominio
                │            │                      │
                ▼            ▼                      ▼
   stats ──▶  arena ──────▶ trainers ──────▶ combat ──────▶ catalog
     │         │ │             ▲               (puro)        (solo datos)
     │         │ ▼             │
     │         │ chat          │
     └─────────┴───────────────┘

   realtime (WS), HTTP ──▶ radio ──▶ trainers
                             └─────▶ catalog

   HTTP ──▶ tower ──▶ arena (cada piso es una sala contra la IA)
              ├────▶ trainers (tu colección)
              └────▶ combat, catalog
```

Las flechas son "usa a". Nunca hay una flecha de vuelta: `trainers` no sabe que existen las salas, `combat` no
sabe que existen los entrenadores, `catalog` no sabe que existe el motor, y `chat` guarda mensajes por canal sin
saber qué es una sala. `radio` usa `catalog` (qué canciones hay y cuánto dura cada una) y `trainers` (el nombre
del DJ), y nadie sabe que existe: escuchar una estación no tiene nada que ver con las salas, y un jugador puede
escucharla mientras pelea. `tower` usa `arena` para jugar cada piso: le pide una sala contra la IA con sus
propios equipos y su puesta en escena (`Staging`: escenario, música, sprite del rival, a dónde volver y la etiqueta del piso) y escucha
`matchFinished` para avanzar la subida, como un torneo. La arena no sabe que la torre existe.
`src/architecture.spec.ts` lo revisa.

## 2. Las capas dentro de un dominio

Los dominios con estado (`trainers`, `arena`, `radio`) tienen cuatro carpetas:

```
src/trainers/
  domain/           Reglas del negocio. TypeScript puro: sin Nest, sin SQL, sin HTTP.
    trainer.ts            el agregado Trainer (un equipo nunca repite especie, máximo 6…)
    save-file.ts          leer un save de PokeTokenBar
    save-file.spec.ts     su test, al lado
    trainer.repository.ts el PUERTO: qué necesita el dominio del almacenamiento, en sus palabras
  application/      Casos de uso: orquestan el dominio y los repositorios.
    trainers.service.ts   importar un save, cambiar el equipo, registrar un resultado…
    accounts.service.ts   la cuenta: registrarse, entrar, salir, la contraseña y las sesiones
    shop.service.ts       comprar, equipar, reciclar y cambiar el look
  infrastructure/   ADAPTADORES: cómo se cumple el puerto con tecnología concreta.
    trainer.schema.ts     las tablas en Drizzle
    trainer.mapper.ts     agregado ⇄ filas
    drizzle-trainer.repository.ts
  interface/        Cómo entra el mundo: HTTP.
    dto/                  la forma de cada petición (import-save.dto.ts, update-profile.dto.ts…)
    trainers.controller.ts, session.guard.ts, trainer.presenter.ts
  trainers.module.ts
```

**La regla de dependencia:** `domain` no importa nada de las otras tres. `application` importa `domain`.
`infrastructure` e `interface` importan las dos anteriores. Por eso el dominio se testea sin base de datos ni
servidor (`save-file.spec.ts`, `tournament.spec.ts`…), y cambiar Drizzle por otra cosa solo toca
`infrastructure/`. `src/architecture.spec.ts` revisa los imports de cada archivo y falla si un `domain/` importa
Nest, Drizzle u otra capa.

El puerto es una clase abstracta (`TrainerRepository`) que además sirve de token de inyección de Nest.

En `trainers.module.ts`, el repositorio no está entre los `exports`:

```ts
providers: [TrainersService, AccountsService, ShopService, { provide: TrainerRepository, useClass: DrizzleTrainerRepository }],
exports: [TrainersService, AccountsService, ShopService],
```

`combat` y `catalog` son casi solo `domain/`: funciones puras con la aleatoriedad inyectada (`random = Math.random`),
así que sus tests reproducen una pelea entera con una semilla fija. La única lectura es la del catálogo: sus JSON
se leen una vez, al cargar el módulo, y la tabla de tipos es `public/types.js`, la misma que usa el navegador
(`catalog/domain/type-chart.ts` explica cómo). La tienda (`public/shop.js`) y los entrenadores
(`public/trainer-sprites.js`, `public/trainer-variants.js`) siguen el mismo camino: el catálogo les pone tipos en
`catalog/domain/shop.ts` y `trainer-sprites.ts`, y `tsconfig.json` los incluye en el build.

En general, un dominio tiene solo las capas que usa: `chat` no tiene HTTP propio (sus mensajes le llegan por la arena) y `stats` no guarda nada.

Un puerto es opcional: vale la pena cuando el adaptador podría cambiar o hay que reemplazarlo en los tests, como
el almacenamiento. `SkynetService` (`combat/application`) importa el cliente de Jev de `combat/infrastructure/`
directamente: hay un solo Jev, y sus tests le pasan un `fetch` falso.

### ¿Por qué no se ve como la guía de Nest?

La estructura que recomiendan Nest y la mayoría de las guías es *por feature*: una carpeta por tema con su
`dto/`, `entities/`, controller, service y module, todo al mismo nivel. Acá el primer nivel es igual (una carpeta por
dominio, cada una con su `*.module.ts`, más `shared/`), pero adentro hay capas. Las diferencias:

| Guía por feature | Acá | Por qué |
| --- | --- | --- |
| `users.service.ts` hace reglas y acceso a datos | `domain/` (reglas) + `application/` (casos de uso) | las reglas se testean sin Nest ni base de datos |
| `entities/user.entity.ts` es el objeto y la tabla a la vez | `domain/trainer.ts` + `infrastructure/trainer.schema.ts` + un mapper | el dominio no depende de cómo se guarda |
| `dto/` junto al controller | `interface/dto/` | igual, dentro de la capa que habla HTTP |
| `*.spec.ts` al lado del código, e2e en `test/` | igual | |

Para un CRUD, la estructura por feature basta. Las capas valen la pena cuando hay reglas de verdad (un torneo, una
pelea, un equipo que no repite especie), y para mostrar la regla de dependencia, que es el objetivo de esta demo.

## 3. Reglas entre dominios

1. **Cada dominio es dueño de sus tablas.** Nadie más las lee ni las escribe. Solo los `infrastructure/` usan
   Drizzle, y nadie importa la `infrastructure/` ni el repositorio de otro dominio: lo revisa
   `src/architecture.spec.ts`. Nest no lo impide, porque `DatabaseModule` es global y cualquier módulo podría
   inyectar la base; una consulta escrita a mano contra una tabla ajena tampoco la ve el test, queda a la revisión.
2. **Si A necesita que cambie algo de B, se lo pide a B.** Al terminar una pelea, `arena` no hace
   `UPDATE trainers SET wins = wins + 1`: llama a `TrainersService.recordRankedResult()`. La regla de qué pelea
   cuenta para el ranking (no contra la IA, no en torneos) la decide `arena` (`isHumanDuel`, en `challenge.ts`, la
   misma que usan el historial y las stats); llevar la cuenta es cosa de `trainers`. Nest hace cumplir esta parte: como `TrainersModule` exporta sus tres servicios de aplicación
   (`TrainersService`, `AccountsService` y `ShopService`) y nunca su repositorio, inyectar `TrainerRepository` desde
   `arena` hace que la app no arranque.
3. **Entre dominios se referencian por id, sin foreign keys.** `challenges.host_id` es un texto. Así cada dominio
   podría vivir en otra base, y además un id de la arena puede ser una IA (`ai:hard`), que no es un entrenador.
   Las foreign keys existen solo *dentro* de un agregado (`roster_entries → trainers`).
4. **Copias, no referencias, cuando el pasado no debe cambiar.** Una sala guarda una copia del equipo de cada lado
   (`host_team`, un value object en JSON). Si mañana cambias tus movimientos, la pelea de ayer sigue igual.
5. **Eventos cuando la dependencia iría al revés.** Un torneo usa peleas (`TournamentsService` →
   `TeamPreviewService`, que arranca la cuenta regresiva de cada partido). Cuando una pelea de torneo termina, la
   pelea no llama al torneo: `LiveBattleService` publica `matchFinished` en `ArenaEvents` y el torneo, que está
   suscrito, avanza la llave.
6. **Los modelos de lectura no guardan nada.** `stats` arma la página con consultas de solo lectura
   (`TrainersService.all()`, `ArenaQueries`). En un sistema grande tendría su propia proyección alimentada por
   eventos; acá sería exagerado. Los logros desbloquean entrenadores y artículos de la tienda, pero comprar,
   equipar y reemplazar un entrenador que ya no corresponde se lo pide a `ShopService`, y elegir el entrenador del
   perfil, a `TrainersService` (regla 2).

## 4. Recorrido de una petición

`POST /api/challenges/:id/accept` (entrar a la sala de otro):

```
SecurityHeadersMiddleware, ApiProtectionMiddleware   cabeceras, origen y límite por IP   (shared/http)
SessionGuard (@Authenticated)                        Bearer token → Trainer, o 401       (trainers/interface)
StandardSchemaValidationPipe                         el body cumple su DTO, o 400        (shared/http, */interface/dto)
ChallengesController.accept                          lee la URL, llama al caso de uso    (arena/interface)
ChallengesService.accept                             orquesta                            (arena/application)
  joinBlocker(challenge, …)                          ¿se puede entrar? regla pura        (arena/domain/lobby.ts)
    Challenge.joinBlocker(trainerId)                   las reglas de la sala misma       (arena/domain)
  DuelService.join → Challenge.join(...)             cambia el agregado                  (arena/domain)
  ChallengeRepository.save(challenge)                lo guarda                           (arena/infrastructure)
ArenaViews.challenge                                 lo que ve el cliente                (arena/application)
```

Cada agregado cuida sus propios cambios de estado. `Challenge.join()` vuelve a preguntar `joinBlocker()` y no
deja entrar a una sala que no está abierta, `cancel()` solo deja cerrar al anfitrión mientras espera rival o
durante la confirmación, y `finish()` solo termina una pelea en curso. El diagrama de estados está arriba de
`challenge.ts`. `lobby.ts` agrega lo único que el agregado no sabe: si el anfitrión sigue conectado.

Si una regla dice que no, el dominio lanza un `DomainError` con un *tipo* (`conflict`, `not-found`…), nunca un
código HTTP. `DomainErrorFilter` (`shared/http`) traduce el tipo a 409, 404… y responde `{ "error": "…" }`. El
dominio no sabe que existe HTTP.

**DTO o dominio.** Un DTO (un esquema de [Zod](https://zod.dev) en `interface/dto/`) revisa la *forma* de la
petición: tipos, valores permitidos y defaults. `mode` es `team` o `random`, y si no viene es `team`. Si no cumple,
responde 400 antes de llegar al controller. Lo que depende del estado sigue siendo del dominio: si ese Pokémon conoce
ese movimiento, o si al torneo le queda lugar. Nest lo aplica solo con `@Body({ schema: NewChallengeDto })`, gracias
al `StandardSchemaValidationPipe` registrado en `app.module.ts`, y el esquema da también el tipo:
`type NewChallengeDto = z.infer<typeof NewChallengeDto>`.

Las otras dos entradas siguen la misma regla: se leen una vez, en el borde, y adentro se confía en los tipos. Los
mensajes del socket tienen sus esquemas en `realtime/client-messages.ts`, y las variables de entorno en
`shared/config/app-config.ts`, que detiene el servidor al arrancar si una no se puede leer.

## 5. Una pelea en vivo

Las peleas pasan por WebSocket. `GameWsAdapter` (`realtime/`) lee cada mensaje `{ "t": "pick", … }` con su
esquema, y `GameGateway` lo recibe ya tipado en `@SubscribeMessage('pick')` y se lo pasa al servicio de la arena
que corresponde. Si el dominio dice que no (un `DomainError`), el cliente recibe `{ "t": "error", "error": "…" }`.

Cada sala en curso tiene un `Room` en memoria (`arena/application/presence.ts`) con su `Challenge` y una sola
fase a la vez. La fase es una unión discriminada por `kind`, y cada una lleva solo sus datos: la confirmación
sabe quién está listo, la vista previa tiene su reloj y la batalla tiene su `BattleState`. No puede haber una
cuenta regresiva y una batalla al mismo tiempo. Tres servicios se pasan la sala, cada uno al siguiente:

```
waiting → readyCheck → countdown → preview → (se revelan) → battle (turnos con timer) → terminada
└──── DuelService ───┘ └─────── TeamPreviewService ───────┘ └──────── LiveBattleService ────────┘
```

`DuelService` sienta al rival, maneja la confirmación y la gente que entra y sale. `TeamPreviewService` lleva la
cuenta regresiva (en un torneo espera un rato a los que vienen llegando), el reloj para elegir 3 de 6 y las
elecciones de la IA. `LiveBattleService` juega los turnos, los de la IA y Skynet, y guarda el resultado. Lo que ve
cada cliente en cada fase lo arma `room-frames.ts`: el jugador ve su lado y el espectador ve
lo que ve el público.

El estado de la batalla (`BattleState`) vive solo en memoria: el motor de `combat` es una función
`submit(battle, lado, acción) → eventos`, y su entrada es `combat/domain/battle.ts`. Por dentro está repartido en
un archivo por pregunta (en qué orden pasa un turno, qué hace un movimiento, cuánto daño hace, qué pasa al final del
turno…) dentro de `combat/domain/engine/`, y las tablas de movimientos, habilidades y objetos están en
`combat/domain/rules/`. Las flechas van en un solo sentido: una tabla de `rules/` nunca importa un archivo de
`engine/`, y un efecto que dispara hooks recibe los triggers en vez de importar el motor de habilidades. Lo único
que se guarda es el resultado, en el agregado `Challenge`. Por eso un reinicio corta las peleas en curso (quedan
como `abandoned`).

El chat también pasa por la arena. `ArenaChatService` decide en qué canal habla cada conexión (`ChatChannel`: el de
la sala, o el del torneo, que comparten todas sus salas), si habla como jugador o espectador, y quién escucha.
`chat` solo guarda los mensajes de cada canal y no sabe qué es una sala.

El dominio no sabe de WebSockets: la arena habla con un puerto `ClientConnection` (`arena/application/connection.ts`)
y el gateway envuelve cada socket en uno. Cada página abre su socket. El puerto deja leer quién es y dónde está la
conexión, y la arena lo cambia solo con métodos que no nombran agregados: `signIn` pide algo con `id`, y `enterRoom` y
`follow`, el id. Así `realtime` no importa tipos de dominio. La conexión decide adónde puede entrar: `enterRoom` y
`follow` devuelven `false` si ya está en el lobby, en una sala o en un torneo, y `enterLobby` solo rechaza una
conexión que ya está en una sala o en el lobby. Por eso la página de un torneo puede abrir el lobby sin dejar de
seguir el torneo. `signIn` guarda solo la primera identidad: una conexión anónima puede firmar después, pero una
firmada no cambia de entrenador, así que abrir el lobby sin token no la deja fuera del asiento que tiene en el torneo.
Lo que lee un solo servicio vive en ese servicio: el último turno que vio cada espectador, en `LiveBattleService`, y
cuándo habló cada uno por última vez, en `ArenaChatService`.

## 6. Persistencia

- **Esquema por dominio:** `*/infrastructure/*.schema.ts`. `drizzle.config.ts` los junta y `npm run db:generate`
  escribe la migración SQL en `drizzle/`. La app las aplica al arrancar (`shared/infrastructure/database`).
- **Mappers:** el agregado nunca ve una fila ni la tabla un agregado (`trainer.mapper.ts`, `arena.mapper.ts`).
- **Identity map:** los repositorios cargan todo al arrancar y entregan siempre el mismo objeto por id; cada
  `save()` escribe al tiro en SQLite, en una transacción. Las salas en vivo tienen timers que guardan referencias a
  un `Challenge` o un `Tournament` y deben ver cada cambio. Con unas decenas de jugadores, todo cabe en memoria; si
  algún día no cabe, solo cambian los repositorios.
- **Driver:** `node:sqlite`, el que trae Node. No hay módulos nativos que compilar en la imagen de Alpine.
- **Migración desde JSON:** `src/legacy/legacy-json-import.ts` importa `data/db.json` una sola vez, en una
  transacción y con los mappers de cada dominio. `legacy-json-import.spec.ts` comprueba que leerlo de vuelta da
  exactamente los mismos datos. La corre `app.module.ts`, que se la pasa a `DatabaseModule.forRoot({ afterOpen })`:
  así `shared` no conoce `legacy`, y la importación pasa recién abierta y migrada la base, antes de que Nest entregue
  la base a algún repositorio (los repositorios cargan sus tablas al construirse). `test/legacy-import.e2e-spec.ts`
  levanta la app con un `db.json` y lo comprueba.
- **Datos viejos, normalizados una vez:** las salas anteriores a los modos o a la visibilidad no tenían esos campos.
  Se arreglaron en dos pasos (*expand/contract*), porque si un deploy falla `deploy.sh` vuelve a la imagen anterior:
  1. **Expand** (`…_backfill`): rellenó lo que siempre significaron (`team`, `private`), y desde esa versión la
     app escribe los dos campos. Las columnas siguieron aceptando NULL, porque la imagen de antes todavía lo escribía.
  2. **Contract** (`…_not_null`): una vez que ninguna imagen a la que se pueda volver escribía NULL, la columna pasó
     a `NOT NULL`. Antes vuelve a rellenar por si un rollback alcanzó a escribir alguna.

  `arena.migrations.spec.ts` prueba los dos pasos sobre una base creada con el primer esquema.

## 7. Tests

| Qué | Dónde | Cómo |
| --- | --- | --- |
| Reglas puras (save, torneo, lobby, chat, stats, motor, IA, estaciones de radio), DTOs y mensajes del socket | `*.spec.ts` al lado de cada archivo | funciones, sin Nest ni base de datos |
| Reglas de dependencia | `src/architecture.spec.ts` | lee los imports de cada archivo |
| Persistencia y migraciones | `src/legacy/legacy-json-import.spec.ts`, `src/arena/infrastructure/arena.migrations.spec.ts` | SQLite real en un directorio temporal |
| Todo junto | `test/app.e2e-spec.ts` | levanta la app compilada y juega peleas y torneos por HTTP y WebSocket, y la reinicia |
| La importación de `db.json` al arrancar | `test/legacy-import.e2e-spec.ts` | levanta la app con un `db.json` en el directorio de datos, lee lo importado por HTTP y la reinicia |
| Las salas por dentro | `test/rooms.e2e-spec.ts` | los frames que ve cada cliente en cada fase, quién se va y vuelve, y quién escucha cada mensaje del chat |
| Frontend | `test/web/*.test.js` | JS tal cual, como el navegador (no van en `public/` porque se publicarían) |
| Estructura de `src/` | `tools/deslop/` | `npm run deslop` reporta ciclos, enredos, campos que se filtran, módulos superficiales, carpetas anchas y archivos largos |

Los unitarios viven con su código, así que al mover o borrar un archivo su test lo acompaña. Los e2e prueban la app
entera, sin pertenecer a ningún dominio, y por eso van en `test/`. `tsconfig.json` deja los `*.spec.ts` fuera del
build (no llegan a la imagen). `npm test` hace primero el typecheck estricto de `src/`, compila los tests con
`tsconfig.test.json` y las herramientas de `tools/` con `tsconfig.tools.json` (estricto), falla si encuentra un
comentario (`tools/no-comments.ts`) y corre todo, también los specs de `tools/deslop/`. `npm run deslop` todavía no es
parte de `npm test`. Hoy reporta la deuda de estructura de `src/` y no falla el build. Sus reglas están en el README,
en [Chequeo de estructura](README.md#chequeo-de-estructura-npm-run-deslop).

## 8. Decisiones y deudas conocidas

- **Salas y torneos en un solo dominio (`arena`).** Un torneo es una serie de salas: separarlos obligaría a pasar
  eventos para casi todo. Si los torneos crecieran (temporadas, inscripciones), serían candidatos a su propio
  dominio.
- **`combat` decide qué movimientos se pueden usar.** Un movimiento funciona en Token Clash (`supported`) si las
  reglas generales del motor lo cubren o si tiene una regla propia en `combat/domain/rules/move-rules.ts`. Por eso lo
  calcula `combat/domain/moves.ts`, que lee cada fila de `movedex.json` (`moveEntry()`, en el catálogo) como la
  necesita el motor. Quien necesita saberlo le pregunta a `combat`: los entrenadores al validar sus movimientos
  (`validMoveset`), la IA, y el navegador en la colección. El catálogo sirve datos y no importa nada de otro
  dominio; `src/architecture.spec.ts` lo revisa. Hay una excepción a propósito: la lista `INERT`
  (`catalog/domain/abilities.ts`) dice qué habilidades no hacen nada en Token Clash, con el texto que lee el jugador.
  Es conocimiento del motor, pero no crea ninguna flecha hacia `combat`, así que se quedó en el catálogo.
- **La tienda entra por `stats`.** `AchievementsController` expone `GET /api/shop`, `POST /api/shop/buy` y
  `PUT /api/me/equip`, porque comprar un entrenador pide tener al original. Esa regla es `buyBlocker`, una función
  pura de `stats/domain/achievements.ts`, y `Trainer.buy` no la conoce. `equip` no depende de logros y podría pasar
  a `TrainersController`.
- **`combat` lleva cosméticos.** `BattleState` guarda el entrenador, el marco y la Poké Ball de cada lado para que
  la vista los muestre. Son datos de presentación de la arena; el motor no los usa para pelear.
- **Los archivos de terceros los carga el navegador.** Los sprites, los gritos, los sonidos y la música son copias
  exactas de archivos de PokeAPI/sprites, PokeAPI/cries y pokerogue-assets. El navegador los baja de jsDelivr, fijados a
  un commit en `public/upstream.js` (`upstreamURLs` arma la URL; nada más escribe un host), y si jsDelivr falla los
  pide una vez a raw.githubusercontent.com. Nuestro dominio queda lejos de muchos jugadores, y jsDelivr responde desde
  cerca. Dónde está cada archivo lo dicen los manifiestos versionados de `public/upstream/`, que los scripts escriben
  resolviendo una vez cada reemplazo (el navegador nunca prueba URLs). La regla de siempre sigue: nada en `src/` llama
  a un servicio externo. La CSP solo abre `img-src` y `connect-src` a esos dos hosts. Lo que transformamos (las
  animaciones convertidas, los tiempos de sus sonidos, las Poké Balls pintadas, los entrenadores recortados y sus
  variantes) se genera al instalar y lo servimos nosotros.
- **El estado en vivo no se guarda.** Peleas, presencia y chat viven en memoria por diseño: es un juego entre
  amigos y retomar una pelea a medias tras un reinicio no vale la complejidad.
- **Una estación de radio sí se guarda, y no depende de sus timers.** `Station` guarda cuándo empezó y cuándo
  termina la canción al aire, y `advance(now)` la pone al día desde ahí: cada lectura y escritura lo llama primero,
  y al arrancar el servidor cada estación cae en la canción que estaría sonando. El timer de cada estación solo
  avisa a los oyentes en el momento en que empieza la siguiente. Los oyentes sí viven en memoria: tras un reinicio
  cada navegador vuelve a sintonizar solo.

## 9. Cómo agregar algo

Ejemplo: "un entrenador puede ponerle un título a su perfil".

1. **Dominio:** agrega `title` a `TrainerState` y un método `Trainer.setTitle()` con sus reglas (largo, caracteres).
   Testéalo en `trainer.spec.ts`, al lado.
2. **Persistencia:** agrega la columna en `trainer.schema.ts`, mapéala en `trainer.mapper.ts` y corre
   `npm run db:generate`.
3. **Caso de uso:** `TrainersService.updateProfile()` llama a `setTitle()` y guarda.
4. **Entrada:** agrega `title: z.string().optional()` a `UpdateProfileDto`. El controller ya pasa el body a
   `updateProfile`. Agrégalo al presenter (`trainerSummary`) para que el frontend lo vea.

Si otro dominio quiere mostrar el título (por ejemplo la arena, en las salas), lo pide con `TrainersService.byId()`.
Nunca lee la tabla `trainers` directamente.
