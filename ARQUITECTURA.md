# Arquitectura

Token Clash es un backend de NestJS armado por **dominios** (bounded contexts, en el vocabulario de DDD). Este
documento explica cómo está organizado, qué reglas sigue y por qué, usando el propio juego como ejemplo.

## 1. Los dominios

Cada carpeta de `src/` es un dominio con su propio lenguaje y sus propias reglas:

| Dominio | De qué se trata | Dueño de |
| --- | --- | --- |
| `catalog` | Especies, movimientos, habilidades y tipos (datos de PokeAPI) y la Pokédex | archivos `src/catalog/data/*.json` |
| `combat` | Cómo se pelea: motor de batalla, elegir 3 de 6, sorteo aleatorio, IA, Skynet | nada (es puro) |
| `trainers` | Quién juega: entrenador, colección, equipo, sesión, importar el save | tablas `trainers`, `roster_entries` |
| `arena` | Dónde se pelea: salas, emparejamiento, peleas en vivo, torneos | tablas `challenges`, `tournaments`, `tournament_seats`, `tournament_matches` |
| `chat` | Mensajes en salas y torneos | memoria (se borra al reiniciar, a propósito) |
| `stats` | La página de stats | nada: solo lee |

Más tres piezas que no son dominios sino entradas y plomería: `realtime` (el protocolo WebSocket), `web`
(archivos estáticos y health checks) y `shared` (configuración, errores, HTTP, base de datos).

```
           realtime (WS)   web          HTTP controllers de cada dominio
                │            │                      │
                ▼            ▼                      ▼
   stats ──▶  arena ──────▶ trainers ──────▶ combat ──────▶ catalog
     │          │              ▲               (puro)         (puro)
     └──────────┴──────────────┘
```

Las flechas son "usa a". Nunca hay una flecha de vuelta: `trainers` no sabe que existen las salas, y `combat` no
sabe que existen los entrenadores.

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
`infrastructure/`.

El puerto es una clase abstracta (`TrainerRepository`) que además sirve de token de inyección de Nest:

```ts
// trainers.module.ts
providers: [TrainersService, { provide: TrainerRepository, useClass: DrizzleTrainerRepository }],
exports: [TrainersService], // ← el repositorio NO se exporta
```

`combat` y `catalog` son solo `domain/`: funciones puras con la aleatoriedad inyectada (`random = Math.random`),
así que sus tests reproducen una pelea entera con una semilla fija. En general, un dominio tiene solo las capas que
usa: `chat` no tiene HTTP propio (habla por el socket) y `stats` no guarda nada.

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

1. **Cada dominio es dueño de sus tablas.** Nadie más las lee ni las escribe.
2. **Si A necesita que cambie algo de B, se lo pide a B.** Al terminar una pelea, `arena` no hace
   `UPDATE trainers SET wins = wins + 1`: llama a `TrainersService.recordRankedResult()`. La regla de qué pelea
   cuenta para el ranking (no contra la IA, no en torneos) la decide `arena` (`Challenge.ranked`); llevar la cuenta
   es cosa de `trainers`. Nest lo hace cumplir: como `TrainersModule` exporta solo su servicio, inyectar
   `TrainerRepository` desde `arena` hace que la app no arranque.
3. **Entre dominios se referencian por id, sin foreign keys.** `challenges.host_id` es un texto. Así cada dominio
   podría vivir en otra base, y además un id de la arena puede ser una IA (`ai:hard`), que no es un entrenador.
   Las foreign keys existen solo *dentro* de un agregado (`roster_entries → trainers`).
4. **Copias, no referencias, cuando el pasado no debe cambiar.** Una sala guarda una copia del equipo de cada lado
   (`host_team`, un value object en JSON). Si mañana cambias tus movimientos, la pelea de ayer sigue igual.
5. **Eventos cuando la dependencia iría al revés.** Un torneo usa peleas (`TournamentsService` → `DuelService`).
   Cuando una pelea de torneo termina, la pelea no llama al torneo: publica `matchFinished` en `ArenaEvents` y el
   torneo, que está suscrito, avanza la llave.
6. **Los modelos de lectura solo leen.** `stats` arma la página con consultas de solo lectura
   (`TrainersService.all()`, `ArenaQueries`). En un sistema grande tendría su propia proyección alimentada por
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
  DuelService.join → Challenge.join(...)             cambia el agregado                  (arena/domain)
  ChallengeRepository.save(challenge)                lo guarda                           (arena/infrastructure)
ArenaViews.challenge                                 lo que ve el cliente                (arena/application)
```

Si una regla dice que no, el dominio lanza un `DomainError` con un *tipo* (`conflict`, `not-found`…), nunca un
código HTTP. `DomainErrorFilter` (`shared/http`) traduce el tipo a 409, 404… y responde `{ "error": "…" }`. El
dominio no sabe que existe HTTP.

**DTO o dominio.** Un DTO (un esquema de [Zod](https://zod.dev) en `interface/dto/`) revisa la *forma* de la
petición: tipos, valores permitidos y defaults. `mode` es `team` o `random`, y si no viene es `team`. Si no cumple,
responde 400 antes de llegar al controller. Lo que depende del estado sigue siendo del dominio: si ese Pokémon conoce
ese movimiento, o si al torneo le queda lugar. Nest lo aplica solo con `@Body({ schema: NewChallengeDto })`, gracias
al `StandardSchemaValidationPipe` registrado en `app.module.ts`, y el esquema da también el tipo:
`type NewChallengeDto = z.infer<typeof NewChallengeDto>`.

## 5. Una pelea en vivo

Las peleas pasan por WebSocket. `GameGateway` (`realtime/`) recibe mensajes `{ "t": "pick", … }`, los enruta con
`@SubscribeMessage('pick')` y se los pasa a `DuelService`. Cada sala en curso tiene un `Room` en memoria
(`arena/application/presence.ts`) que avanza así:

```
sala de espera → cuenta regresiva → elegir 3 de 6 → se revelan → batalla (turnos con timer) → terminada
```

El estado de la batalla (`BattleState`) vive solo en memoria: el motor de `combat` es una función
`submit(battle, lado, acción) → eventos`. Lo único que se guarda es el resultado, en el agregado `Challenge`. Por
eso un reinicio corta las peleas en curso (quedan como `abandoned`).

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

## 7. Tests

| Qué | Dónde | Cómo |
| --- | --- | --- |
| Reglas puras (save, torneo, lobby, chat, stats, motor, IA) y DTOs | `*.spec.ts` al lado de cada archivo | funciones, sin Nest ni base de datos |
| Persistencia y migración | `src/legacy/legacy-json-import.spec.ts` | SQLite real en un directorio temporal |
| Todo junto | `test/app.e2e-spec.ts` | levanta la app compilada y juega peleas y torneos por HTTP y WebSocket, y la reinicia |
| Frontend | `test/web/*.test.js` | JS tal cual, como el navegador (no van en `public/` porque se publicarían) |

Los unitarios viven con su código, así que al mover o borrar un archivo su test lo acompaña. Los e2e prueban la app
entera, sin pertenecer a ningún dominio, y por eso van en `test/`. `tsconfig.json` deja los `*.spec.ts` fuera del
build (no llegan a la imagen). `npm test` hace primero el typecheck estricto de `src/`, compila los tests con
`tsconfig.test.json` y corre todo.

## 8. Decisiones y deudas conocidas

- **Salas y torneos en un solo dominio (`arena`).** Un torneo es una serie de salas: separarlos obligaría a pasar
  eventos para casi todo. Si los torneos crecieran (temporadas, inscripciones), serían candidatos a su propio
  dominio.
- **`catalog/domain/move-rules.ts` importa *tipos* de `combat`.** El catálogo marca qué movimientos funcionan en
  Token Clash (`supported`), y eso depende de qué reglas especiales tiene el motor. Solo se importan tipos (no hay
  dependencia en tiempo de ejecución), pero conceptualmente el catálogo conoce al motor. Lo correcto sería que
  `combat` calculara `supported`; queda pendiente porque toca mucho código del motor.
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
