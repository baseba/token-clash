# AGENTS.md

Token Clash es un backend de NestJS 12 + TypeScript (ESM) + SQLite con Drizzle, armado por dominios, y un frontend de
JS de módulos sin build en `public/`. Es también una demo didáctica de cómo construir por dominios: el código tiene que
leerse de arriba abajo sin ayuda.

## Antes de tocar algo

1. Ubica dónde vive lo que vas a cambiar en el índice del README, [Dónde está cada cosa](README.md#dónde-está-cada-cosa).
2. Si el cambio cruza un dominio, agrega una tabla o un endpoint, lee [ARQUITECTURA.md](ARQUITECTURA.md). Ahí están
   los dominios y sus flechas (§1), las capas (§2), las reglas entre dominios (§3), DTO o dominio (§4), la
   persistencia (§6), los tests (§7) y un ejemplo completo de cómo agregar algo (§9).
3. Lee "Ojo con" en [CONTRIBUTING.md](CONTRIBUTING.md): producción no tiene internet, los datos de PokeAPI se
   commitean y los cambios de `deploy/` se instalan a mano.

`ARQUITECTURA.md` es la fuente de verdad de la estructura. Este archivo solo agrega lo que se acordó y no está
escrito ahí.

## Convenciones de Nest

- Cada dominio es una carpeta con su `*.module.ts`. Adentro, solo las capas que usa (`domain/`, `application/`,
  `infrastructure/`, `interface/`). El módulo exporta su servicio de aplicación y nada más.
- Un endpoint nuevo va en el controller del dominio dueño de lo que cambia. El controller lee la petición y llama a
  un caso de uso. La regla vive en el agregado o en una función pura de `domain/`, con su spec al lado.
- Valida cada entrada en el borde con un esquema de Zod: HTTP en `interface/dto/` con `@Body({ schema })`, mensajes
  del socket en `realtime/client-messages.ts` y variables de entorno en `shared/config/app-config.ts`. Adentro,
  confía en los tipos.
- Para un valor que ya existe como unión en el dominio, exporta la lista desde el dominio y úsala en el DTO con
  `z.enum(...)`.
- Cuando una regla dice que no, lanza un `DomainError` con su tipo (`conflict`, `not-found`, `forbidden`…).
  `DomainErrorFilter` lo traduce a HTTP. Un solo estilo de error y ningún `catch` vacío.
- Agrega un puerto (clase abstracta que sirve de token) solo si el adaptador puede cambiar o hay que reemplazarlo en
  los tests. Si hay un solo adaptador, impórtalo directo, como `SkynetService` con el cliente de Jev.
- La pila es la que hay: Zod para validar, `app-config.ts` para la configuración, `node:test` con
  `node:assert/strict` para los tests y funciones puras con la aleatoriedad inyectada en vez de mocks de Nest.
  Proponer `@nestjs/config`, class-validator, Jest o `TestingModule` es una decisión de arquitectura: pregunta antes.
- Si otro dominio necesita algo, se lo pide a su servicio. Nunca lee su tabla ni inyecta su repositorio.
  `src/architecture.spec.ts` falla con un import prohibido.

## Código

- Nombres completos. Sin variables, parámetros ni alias de tipo de una letra. Solo se aceptan los índices `i` y
  `j`, el parámetro de un callback de una sola expresión (`(m) => m.id`) y el generador pseudoaleatorio.
- Un concepto, un nombre en todo el código. Si renombras, renombra en todos lados (con un codemod si son muchos).
- Identificadores y comentarios en inglés. Los textos que ve el jugador y la documentación van en español.
- Comenta solo el porqué: una decisión de diseño, una regla del dominio o entre dominios, una trampa externa. Cada
  archivo puede abrir con una cabecera corta que diga para qué existe en términos del dominio. Los comentarios
  didácticos que explican el diseño se quedan.
- `tsconfig.json` tiene `noUnusedLocals`: borra el código muerto en vez de comentarlo.
- Un valor compartido (un default, una lista) vive en un solo lugar y se importa. Por ejemplo, `DEFAULT_BALL` de
  `catalog/domain/shop.ts`.

## Datos y migraciones

- Al cambiar un `*.schema.ts`, actualiza el mapper y corre `npm run db:generate`. Commitea la migración de
  `drizzle/`. Nunca edites una migración publicada.
- Para volver obligatoria una columna o borrarla, usa dos PRs (expand y contract, `ARQUITECTURA.md` §6). Un deploy
  que falla vuelve a la imagen anterior, y esa imagen tiene que seguir funcionando con la base nueva.
- Una migración que reescribe datos se prueba sobre una copia de la base de producción antes del merge.

## Tests

- `npm test` corre el typecheck estricto, los specs, los e2e y los tests del frontend. Tiene que pasar antes de
  abrir el PR. Corre también `npm run build`.
- Specs unitarios al lado del archivo que prueban. E2e en `test/*.e2e-spec.ts`. Frontend en `test/web/*.test.js`.
- Cada regla nueva trae su spec. Cada endpoint nuevo aparece en `test/app.e2e-spec.ts`. Cada DTO nuevo, en el
  `*-dtos.spec.ts` de su dominio.
- Un test no depende de archivos que se descargan al instalar (`public/sprites`, `public/trainers`…). Si los
  necesita, se salta cuando faltan, como el test de `LEGACY_DB`.
- `src/combat/domain/battle.replays.spec.ts` fija 40 batallas completas. Si un cambio del motor las mueve a propósito,
  actualiza el snapshot con `UPDATE_SNAPSHOTS=1` en un commit propio y explica el cambio en el PR.

## PRs

- Un PR hace una cosa. Un refactor no cambia comportamiento: un bug que encuentres va en su propio commit.
- El merge a `main` despliega solo, así que cada PR tiene que poder salir a producción por sí mismo.
- Si el PR cambia la estructura o una regla escrita, actualiza `ARQUITECTURA.md` y el índice del README en el mismo PR.
- Título `type(scope): subject`. El cuerpo en español, corto, con `## Why` primero.
