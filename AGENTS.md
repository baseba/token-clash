# AGENTS.md

Token Clash es un backend de NestJS 12 + TypeScript (ESM) + SQLite con Drizzle, con una carpeta de `src/` por
dominio, y un frontend de JS de módulos sin build en `public/`. Es una demo de cómo construir por dominios: el
código se lee de arriba abajo sin ayuda. No hay más documentación que este archivo y el [README](README.md), que
explica [cómo está armado](README.md#cómo-está-armado), el deploy y tu primer PR.

## Las reglas son chequeos

`npm test` tiene que pasar antes de abrir el PR, y el CI construye además la imagen con `npm run build`. Corre:

- el typecheck estricto, con `noUnusedLocals`: el código muerto se borra;
- `tools/no-comments.ts`: ningún comentario ni directiva en JS, TS, CSS, HTML, SVG ni `tsconfig*.json`, salvo en
  `deploy/`, `.github/` y `drizzle/`. Lo que un comentario explicaría va en un nombre, en el nombre de un test o en
  el PR;
- `tools/deslop/`: la estructura de `src/` (ciclos, enredos, campos que se filtran, módulos superficiales, carpetas
  anchas, archivos largos). Su única excepción y sus reglas están en el README;
- `src/architecture.spec.ts`: qué carpeta de `src/` usa a cuál (`USES`) y qué capa importa a cuál (`LAYER_USES`);
  `domain/` sin Nest, Drizzle ni HTTP; nadie entra a la `infrastructure/` ni al repositorio de otro dominio; solo
  `infrastructure/` usa Drizzle; ningún módulo exporta su repositorio; las foreign keys no salen de su schema; solo
  el cliente de Jev sale a la red: nadie más usa `fetch` ni abre un socket o un `WebSocket`, y `realtime/` solo los
  sirve;
- `src/conventions.spec.ts`: `domain/` nunca llama a `Math.random()`; ningún `catch` vacío; `domain/` y
  `application/` solo lanzan `DomainError`; las excepciones de Nest quedan en `platform/http/` y `web/`; cada
  `@Body()` y `@Query()` tiene schema; un DTO toma sus enums del dominio y aparece en el `*-dtos.spec.ts` de su
  carpeta; un test que lee una carpeta descargada al instalar se salta si falta; las dependencias son las de la
  lista y `public/` solo importa archivos de `public/`;
- los specs, los e2e (`test/*.e2e-spec.ts`) y los tests del frontend (`test/web/*.test.js`).

Si un chequeo falla, arregla el código. Cambiar un chequeo, una fila de sus tablas o `tools/deslop/debt.allow` es
una decisión de arquitectura: pregunta antes. Lo mismo para la pila (Zod, `app-config.ts`, `node:test` con
`node:assert/strict`, funciones puras con la aleatoriedad inyectada) y para cualquier dependencia nueva: proponer
`@nestjs/config`, class-validator, Jest o `TestingModule` se pregunta.

## Lo que ningún chequeo ve

- La regla vive en el agregado o en una función pura de `domain/`, con su spec al lado. El DTO revisa la forma de
  la petición y el dominio, lo que depende del estado. El endpoint va en el controller del dominio dueño de lo que
  cambia, y el controller solo llama a un caso de uso.
- Cada dominio es dueño de sus tablas: ninguna consulta escrita a mano toca la tabla de otro dominio, se le pide a
  su servicio.
- Un puerto (clase abstracta que sirve de token) solo si el adaptador puede cambiar o hay que reemplazarlo en los
  tests. Con un solo adaptador, impórtalo directo, como `SkynetService` con el cliente de Jev.
- Nombres completos, también en los specs: nada de una letra, salvo `i` y `j`, el parámetro de un callback de una
  sola expresión, los comparadores `(a, b)`, los genéricos `<T>` y el generador pseudoaleatorio.
- Un concepto, un nombre, un lugar: si renombras, renombra en todos lados, y un valor compartido se importa.
- Si renombras algo que nombra [Cómo está armado](README.md#cómo-está-armado), actualiza esa sección en el mismo PR.
- Identificadores en inglés. Los textos que ve el jugador, este archivo y el README, en español.
- Peleas, presencia y chat viven en memoria a propósito: no los persistas.
- Código viejo que rompe una regla no es un precedente.

## Deudas conocidas

- La tienda entra por `stats`: `AchievementsController` expone la tienda porque comprar un entrenador pide tener al
  original (`buyBlocker`). `equip` podría pasar a `TrainersController`.
- `combat` lleva cosméticos: `BattleState` guarda entrenador, marco y Poké Ball de cada lado solo para la vista.

## Producción

- El servidor no tiene salida a internet. Los datos externos se bajan con `scripts/` (`npm run sprites`, `cries`,
  `anims`, `radio` y `node scripts/import-pokeapi.mjs`), y lo que generan en `src/*/data/` y `public/upstream/` se
  commitea.
- Sprites, gritos, sonidos y música los baja el navegador de jsDelivr, fijados a un commit en `public/upstream.js`.
  Lo que transformamos (animaciones, entrenadores, sprites de mapa, tiles, sprites animados de Pokémon) se genera
  en `npm install` y no se versiona. La imagen instala con `--ignore-scripts` y corre esos scripts de sync ella misma (`deploy/Containerfile`):
  un script nuevo de `postinstall` también va ahí.
- El merge a `main` despliega solo cuando el CI pasa y no hay peleas en curso. Cada PR tiene que poder salir a
  producción por sí mismo, y lo que no está commiteado no llega.
- Un cambio en `deploy/*.container`, `*.network`, `*.service`, `*.timer` o `deploy/deploy.sh` no se aplica solo y
  frena el deploy automático hasta que alguien lo instale a mano (README, Deploy): va en un PR propio y se avisa.

## Datos y migraciones

- Al cambiar un `*.schema.ts`: actualiza el mapper, corre `npm run db:generate` y commitea la migración de
  `drizzle/`. Una migración publicada no se edita.
- Un deploy que falla vuelve a la imagen anterior, y esa imagen tiene que funcionar con la base nueva. Para volver
  obligatoria una columna o borrarla: dos PRs, expand (rellenar y seguir aceptando NULL) y contract.
- Una migración que reescribe datos se prueba sobre una copia de la base de producción antes del merge.

## Tests

- Cada regla nueva trae su spec; cada endpoint nuevo, su paso en `test/app.e2e-spec.ts`.
- `src/combat/domain/battle.replays.spec.ts` fija 40 batallas. Si el motor las mueve a propósito, actualiza el
  snapshot con `UPDATE_SNAPSHOTS=1` en un commit propio y explica el cambio en el PR.

## PRs

- Un PR hace una cosa. Un refactor no cambia comportamiento: un bug que encuentres va en su propio commit.
- Título `type(scope): subject`. Cuerpo en español, corto, con `## Why` primero.
