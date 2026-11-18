# Arquitectura

Token Clash es un backend de NestJS armado por **dominios** (bounded contexts, en el vocabulario de DDD). Este
documento explica cómo está organizado, qué reglas sigue y por qué, usando el propio juego como ejemplo.

## 1. Los dominios

Cada carpeta de `src/` es un dominio con su propio lenguaje y sus propias reglas:

| Dominio | De qué se trata | Dueño de |
| --- | --- | --- |
| `catalog` | Especies, movimientos, habilidades y tipos (datos de PokeAPI y Pokémon Showdown), la Pokédex, los artículos de la tienda y los sprites de entrenador | archivos `src/catalog/data/*.json` y las listas compartidas de `public/` |
| `combat` | Cómo se pelea: motor de batalla, qué movimientos se pueden usar, elegir 3 de 6, sorteo aleatorio, IA, Skynet | nada (es puro) |
| `trainers` | Quién juega: entrenador, colección, equipo, sesión, importar el save | tablas `trainers`, `roster_entries` |
| `arena` | Dónde se pelea: salas, emparejamiento, peleas en vivo, torneos | tablas `challenges`, `tournaments`, `tournament_seats`, `tournament_matches` |
| `chat` | Mensajes en salas y torneos | memoria (se borra al reiniciar, a propósito) |
| `stats` | La página de stats y los logros | nada: lee de los otros dominios y le pide los cambios a `trainers` |

Más tres piezas que no son dominios sino entradas y plomería: `realtime` (el protocolo WebSocket), `web`
(archivos estáticos y health checks) y `shared` (configuración, errores, HTTP, base de datos).

```
           realtime (WS)   web          HTTP controllers de cada dominio
                │            │                      │
                ▼            ▼                      ▼
   stats ──▶  arena ──────▶ trainers ──────▶ combat ──────▶ catalog
     │         │ │             ▲               (puro)        (solo datos)
     │         │ ▼             │
     │         │ chat          │
     └─────────┴───────────────┘
```

Las flechas son "usa a". Nunca hay una flecha de vuelta: `trainers` no sabe que existen las salas, `combat` no
sabe que existen los entrenadores, `catalog` no sabe que existe el motor, y `chat` guarda mensajes por canal sin
saber qué es una sala.

## 2. Las capas dentro de un dominio

Los dominios con estado (`trainers`, `arena`) tienen cuatro carpetas:

```
src/trainers/
  domain/           Reglas del negocio. TypeScript puro: sin Nest, sin SQL, sin HTTP.
    trainer.ts            el agregado Trainer (un equipo nunca repite especie, máximo 6…)
    save-file.ts          leer un save de PokeTokenBar
    save-file.spec.ts     su test, al lado
    trainer.repository.ts el PUERTO: qué necesita el dominio del almacenamiento, en sus palabras
  application/      Casos de uso: orquestan el dominio y los repositorios.
    trainers.service.ts   importar un save, cambiar el equipo, registrar un resultado…
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

El puerto es una clase abstracta (`TrainerRepository`) que además sirve de token de inyección de Nest:

```ts
// trainers.module.ts
providers: [TrainersService, { provide: TrainerRepository, useClass: DrizzleTrainerRepository }],
exports: [TrainersService], // ← el repositorio NO se exporta
```

`combat` y `catalog` son casi solo `domain/`: funciones puras con la aleatoriedad inyectada (`random = Math.random`),
así que sus tests reproducen una pelea entera con una semilla fija. La única lectura es la del catálogo: sus JSON
se leen una vez, al cargar el módulo, y la tabla de tipos es `public/types.js`, la misma que usa el navegador
(`catalog/domain/type-chart.ts` explica cómo). La tienda (`public/shop.js`) y los entrenadores
(`public/trainer-sprites.js`, `public/trainer-variants.js`) siguen el mismo camino: el catálogo les pone tipos en
`catalog/domain/shop.ts` y `trainer-sprites.ts`, y `tsconfig.json` los incluye en el build. En general, un dominio tiene solo las capas que
usa: `chat` no tiene HTTP propio (sus mensajes le llegan por la arena) y `stats` no guarda nada.

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
   misma que usan el historial y las stats); llevar la cuenta es cosa de `trainers`. Nest hace cumplir esta parte: como `TrainersModule` exporta solo su servicio, inyectar
   `TrainerRepository` desde `arena` hace que la app no arranque.
3. **Entre dominios se referencian por id, sin foreign keys.** `challenges.host_id` es un texto. Así cada dominio
   podría vivir en otra base, y además un id de la arena puede ser una IA (`ai:hard`), que no es un entrenador.
   Las foreign keys existen solo *dentro* de un agregado (`roster_entries → trainers`).
4. **Copias, no referencias, cuando el pasado no debe cambiar.** Una sala guarda una copia del equipo de cada lado
   (`host_team`, un value object en JSON). Si mañana cambias tus movimientos, la pelea de ayer sigue igual.
5. **Eventos cuando la dependencia iría al revés.** Un torneo usa peleas (`TournamentsService` →
   `TeamPreviewService`, que arranca la cuenta regresiva de cada partido). Cuando una pelea de torneo termina, la
   pelea no llama al torneo: `LiveBattleService` publica `matchFinished` en `ArenaEvents` y el torneo, que está
   suscrito, avanza la llave.
6. **Los modelos de lectura solo leen.** `stats` arma la página con consultas de solo lectura
   (`TrainersService.all()`, `ArenaQueries`). Los logros desbloquean entrenadores y artículos de la tienda, pero
   `stats` no guarda nada: comprar, equipar y cambiar el look se lo pide a `TrainersService` (regla 2). En un sistema grande tendría su propia proyección alimentada por
   eventos; acá sería exagerado.

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
`submit(battle, lado, acción) → eventos`. Por dentro está repartido en un archivo por pregunta (en qué orden pasa un
turno, qué hace un movimiento, cuánto daño hace, qué pasa al final del turno…); el mapa está al principio de
`combat/domain/battle.ts`. Lo único que se guarda es el resultado, en el agregado `Challenge`. Por
eso un reinicio corta las peleas en curso (quedan como `abandoned`).

El chat también pasa por la arena. `ArenaChatService` decide en qué canal habla cada conexión (`ChatChannel`: el de
la sala, o el del torneo, que comparten todas sus salas), si habla como jugador o espectador, y quién escucha.
`chat` solo guarda los mensajes de cada canal y no sabe qué es una sala.

El dominio no sabe de WebSockets: la arena habla con un puerto `ClientConnection`
(`arena/application/connection.ts`) y el gateway envuelve cada socket en uno.

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
  exactamente los mismos datos.
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
| Reglas puras (save, torneo, lobby, chat, stats, motor, IA), DTOs y mensajes del socket | `*.spec.ts` al lado de cada archivo | funciones, sin Nest ni base de datos |
| Reglas de dependencia | `src/architecture.spec.ts` | lee los imports de cada archivo |
| Persistencia y migraciones | `src/legacy/legacy-json-import.spec.ts`, `src/arena/infrastructure/arena.migrations.spec.ts` | SQLite real en un directorio temporal |
| Todo junto | `test/app.e2e-spec.ts` | levanta la app compilada y juega peleas y torneos por HTTP y WebSocket, y la reinicia |
| Las salas por dentro | `test/rooms.e2e-spec.ts` | los frames que ve cada cliente en cada fase, quién se va y vuelve, y quién escucha cada mensaje del chat |
| Frontend | `test/web/*.test.js` | JS tal cual, como el navegador (no van en `public/` porque se publicarían) |

Los unitarios viven con su código, así que al mover o borrar un archivo su test lo acompaña. Los e2e prueban la app
entera, sin pertenecer a ningún dominio, y por eso van en `test/`. `tsconfig.json` deja los `*.spec.ts` fuera del
build (no llegan a la imagen). `npm test` hace primero el typecheck estricto de `src/`, compila los tests con
`tsconfig.test.json` y corre todo.

## 8. Decisiones y deudas conocidas

- **Salas y torneos en un solo dominio (`arena`).** Un torneo es una serie de salas: separarlos obligaría a pasar
  eventos para casi todo. Si los torneos crecieran (temporadas, inscripciones), serían candidatos a su propio
  dominio.
- **`combat` decide qué movimientos se pueden usar.** Un movimiento funciona en Token Clash (`supported`) si las
  reglas generales del motor lo cubren o si tiene una regla propia en `combat/domain/move-rules.ts`. Por eso lo
  calcula `combat/domain/moves.ts`, que lee cada fila de `movedex.json` (`moveEntry()`, en el catálogo) como la
  necesita el motor. Quien necesita saberlo le pregunta a `combat`: los entrenadores al validar sus movimientos
  (`validMoveset`), la IA, y el navegador en la colección. El catálogo sirve datos y no importa nada de otro
  dominio; `src/architecture.spec.ts` lo revisa. Hay una excepción a propósito: la lista `INERT`
  (`catalog/domain/abilities.ts`) dice qué habilidades no hacen nada en Token Clash, con el texto que lee el jugador.
  Es conocimiento del motor, pero no crea ninguna flecha hacia `combat`, así que se quedó en el catálogo.
- **La tienda entra por `stats`.** `AchievementsController` expone `GET /api/shop`, `POST /api/shop/buy` y
  `PUT /api/me/equip`, porque comprar un entrenador pide tener al original. Esa regla vive hoy en
  `AchievementsService.buy`, no en el dominio: `Trainer.buy` no la conoce. Lo limpio sería una función pura en
  `stats/domain/achievements.ts` con su spec, y `equip`, que no depende de logros, en `TrainersController`.
- **`combat` lleva cosméticos.** `BattleState` guarda el entrenador, el marco y la Poké Ball de cada lado para que
  la vista los muestre. Son datos de presentación de la arena; el motor no los usa para pelear.
- **El estado en vivo no se guarda.** Peleas, presencia y chat viven en memoria por diseño: es un juego entre
  amigos y retomar una pelea a medias tras un reinicio no vale la complejidad.

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
