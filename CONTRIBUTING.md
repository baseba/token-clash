# Cómo contribuir

1. Haz fork (o una rama, si tienes acceso de escritura) desde `main`.
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

## Ojo con

- El servidor no tiene salida a internet en producción: nada en `src/` puede llamar APIs externas en
  tiempo de ejecución. Los datos externos se bajan con scripts en `scripts/` y se commitean.
- Los sprites, gritos, sonidos y música los carga el navegador desde jsDelivr, fijados a un commit en
  `public/upstream.js`. Si cambias ese commit o agregas especies, formas, movimientos, sonidos o música, corre
  `npm run sprites`, `npm run cries` o `npm run anims` y commitea lo que cambie en `public/upstream/`
  (`test/web/upstream.test.js` o la instalación fallan si falta algo). Un archivo que transformamos (recortado, pintado, convertido) no
  va por ahí: se genera al instalar. La CSP abre a esos hosts solo `img-src` y `connect-src`.
- Los datos de PokeAPI (`src/catalog/data/*.json`) se commitean: si tocas
  `scripts/import-pokeapi.mjs`, córrelo (Node 22+) y sube lo que genera.
- Los cambios a `deploy/*.container`, `*.network`, `*.service`, `*.timer` y `deploy/deploy.sh` no se aplican solos:
  avisa en el PR para que se instalen a mano.
- El dominio es puro: nada en `*/domain/` importa Nest, Drizzle ni `node:http`, y el motor
  (`src/combat/domain/`) recibe la aleatoriedad inyectada. Mantenlo así para que se pueda testear.
  `src/architecture.spec.ts` falla si no.
- Cada dominio es dueño de sus tablas. Si otro dominio necesita algo, se lo pide a su servicio de aplicación
  (el único que exporta su módulo), nunca a su repositorio. Ver [ARQUITECTURA.md](ARQUITECTURA.md).
- Si cambias un `*.schema.ts`, corre `npm run db:generate` y commitea la migración de `drizzle/`. Nunca edites una
  migración ya publicada.
- Sin build ni dependencias nuevas en el frontend (`public/` es JS de módulos tal cual).
