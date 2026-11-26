# Cómo contribuir

1. Haz fork (o una rama, si tienes acceso de escritura) desde `main`. Si nunca lo has hecho, sigue
   [Tu primer PR, paso a paso](#tu-primer-pr-paso-a-paso).
2. Instala y levanta el juego en local:

   ```sh
   npm install
   npm run dev     # http://localhost:8080, datos en ./data (SQLite)
   npm test
   ```

   Para probar sin tu propio save, sube `test/fixtures/export.json`.
3. Abre un PR contra `main`. `main` está protegida: solo entra por PR y con el CI (tests y build de la imagen) en
   verde.
4. Al mergear, se despliega solo a https://clash.mirrordev.xyz en unos minutos, cuando no haya peleas en curso
   (ver "Deploy automático" en el README). Si tu PR necesita un paso a mano (regenerar datos, cambiar algo del
   servidor), déjalo hecho en el PR: lo que no esté commiteado no llega a producción.

## Tu primer PR, paso a paso

Si nunca has hecho un fork ni un PR, sigue esto. Necesitas una cuenta de GitHub, [Git](https://git-scm.com/downloads)
y Node 22.13 o más nuevo.

1. **Haz fork.** Entra a https://github.com/baseba/token-clash y aprieta **Fork** arriba a la derecha y después
   **Create fork**. GitHub crea una copia del repo en tu cuenta: `https://github.com/<tu-usuario>/token-clash`.
2. **Clona tu fork** en tu computador:

   ```sh
   git clone https://github.com/<tu-usuario>/token-clash.git
   cd token-clash
   git remote add upstream https://github.com/baseba/token-clash.git
   ```

   `origin` apunta a tu fork, donde vas a subir tus cambios. `upstream` apunta al repo original, para traer lo
   nuevo.
3. **Crea una rama** para tu cambio. No trabajes directo en `main`:

   ```sh
   git switch -c arregla-bug-de-la-tienda
   ```

4. **Haz el cambio y pruébalo** con `npm install`, `npm run dev` y `npm test` (ver arriba). `npm test` tiene que
   pasar.
5. **Commitea y sube la rama a tu fork:**

   ```sh
   git status
   git add -A
   git commit -m "fix(shop): el botón de comprar se desactiva sin tokens"
   git push -u origin arregla-bug-de-la-tienda
   ```

   `git status` te muestra qué archivos vas a subir. Revisa que estén solo los que cambiaste.
6. **Abre el PR.** Entra a tu fork en GitHub. Aparece un aviso con el botón **Compare & pull request**.
   Si no aparece, ve a la pestaña **Pull requests** y aprieta **New pull request**. Revisa que diga
   `base repository: baseba/token-clash`, `base: main` a la izquierda y tu fork y tu rama a la derecha.
   Ponle un título como `fix(shop): …` y cuenta en la descripción qué arregla y por qué.
7. **Responde la revisión.** Si te piden cambios, haz otro commit en la misma rama y súbelo con `git push`. El PR
   se actualiza solo.

Si `main` avanzó mientras trabajabas, commitea lo tuyo y ponte al día:

```sh
git fetch upstream
git rebase upstream/main
```

Si Git se detiene por un conflicto, arregla los archivos que nombra, haz `git add` de cada uno y sigue con
`git rebase --continue`. Si te enredas, `git rebase --abort` deshace todo y te deja como estabas. Cuando el rebase
termine, corre `npm test` de nuevo.

El rebase reescribe tus commits, así que GitHub rechaza un `git push` normal si ya habías subido la rama. En ese caso
súbela con `git push --force-with-lease`, que solo pisa tu rama si nadie más la cambió. Si no la habías subido, usa
el `git push -u` del paso 5.

¿Solo quieres reportar un bug o proponer una idea sin programar? Abre un
[issue](https://github.com/baseba/token-clash/issues/new).

## Ojo con

- El servidor no tiene salida a internet en producción: nada en `src/` puede llamar APIs externas en
  tiempo de ejecución. Los datos externos se bajan con scripts en `scripts/` y se commitean.
- Los sprites, gritos, sonidos y música los carga el navegador desde jsDelivr, fijados a un commit en
  `public/upstream.js`. Si cambias ese commit o agregas especies, formas, movimientos, sonidos o música, corre
  `npm run sprites`, `npm run cries` o `npm run anims` y commitea lo que cambie en `public/upstream/`
  (`test/web/upstream.test.js` o la instalación fallan si falta algo). Un archivo que transformamos (recortado, pintado, convertido) no
  va por ahí: se genera al instalar. La CSP abre a esos hosts solo `img-src` y `connect-src`.
  El navegador guarda esos manifiestos un año bajo la versión del deploy, que se calcula al arrancar:
  después de regenerar uno, reinicia `npm run dev`.
- Los datos de PokeAPI (`src/catalog/data/*.json`) se commitean: si tocas
  `scripts/import-pokeapi.mjs`, córrelo (Node 22+) y sube lo que genera.
- Los cambios a `deploy/*.container`, `*.network`, `*.service`, `*.timer` y `deploy/deploy.sh` no se aplican solos:
  avisa en el PR para que se instalen a mano.
- El dominio es puro: nada en `*/domain/` importa Nest, Drizzle, `node:http` ni `src/platform/`, y el motor
  (`src/combat/domain/`) recibe la aleatoriedad inyectada. Mantenlo así para que se pueda testear.
  `src/architecture.spec.ts` falla si no.
- Cada dominio es dueño de sus tablas. Si otro dominio necesita algo, se lo pide a uno de los servicios de aplicación
  que exporta su módulo, nunca a su repositorio. Ver [ARQUITECTURA.md](ARQUITECTURA.md).
- Si cambias un `*.schema.ts`, corre `npm run db:generate` y commitea la migración de `drizzle/`. Nunca edites una
  migración ya publicada.
- Sin build ni dependencias nuevas en el frontend (`public/` es JS de módulos tal cual).
