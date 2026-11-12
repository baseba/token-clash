# Cómo contribuir

1. Haz fork (o una rama, si tienes acceso de escritura) desde `main`.
2. Instala y levanta el juego en local:

   ```sh
   npm install
   npm run dev     # http://localhost:8080, datos en ./data
   npm test
   ```

   Para probar sin tu propio save, sube `test/fixtures/export.json`.
3. Abre un PR contra `main`. `main` está protegida: solo entra por PR y con el CI (tests y build de la imagen) en
   verde.
4. Al mergear, se despliega solo a https://clash.mirrordev.xyz en unos minutos, cuando no haya peleas en curso
   (ver "Deploy automático" en el README). Si tu PR necesita un paso a mano (regenerar datos, cambiar algo del
   servidor), déjalo hecho en el PR: lo que no esté commiteado no llega a producción.

## Ojo con

- El servidor no tiene salida a internet en producción: nada en `server/` puede llamar APIs externas en
  tiempo de ejecución. Los datos externos se bajan con scripts en `scripts/` y se commitean.
- Los datos de PokeAPI (`server/pokeapi.json`, `public/sprites/`) se commitean: si tocas
  `scripts/import-pokeapi.mjs`, córrelo (Node 22+) y sube lo que genera.
- Los cambios a `deploy/*.container`, `*.network`, `*.service`, `*.timer` y `deploy/deploy.sh` no se aplican solos:
  avisa en el PR para que se instalen a mano.
- `server/battle.js` es puro (la aleatoriedad se inyecta): mantenlo así para que se pueda testear.
- Sin build ni dependencias nuevas en el frontend (`public/` es JS de módulos tal cual).
