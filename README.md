# Token Clash

Batallas por turnos entre colegas con las criaturas que cada uno crió en
[PokeTokenBar](https://github.com/chattymin/PokeTokenBar) a punta de tokens.

En vivo: **https://clash.mirrordev.xyz**

## Cómo se juega

1. En PokeTokenBar: Ajustes → Backup & Transfer → Exportar (`PokeTokenBar-Save-YYYY-MM-DD.json`).
   También sirve el archivo vivo `~/Library/Application Support/PokeTokenBar/companion-state.json`.
2. Arrástralo en la web con tu nombre de entrenador. Arma un equipo de 3.
3. "Crear link de desafío" → mándaselo a un colega. Cuando acepta, pelean en vivo (60 s por turno;
   si alguien no elige, su criatura ataca sola). Cualquiera más con el link puede mirar.
4. Ranking de victorias en la portada. Opción "Todos a nivel 50" para que gane la estrategia.

## Criaturas originales

El save solo aporta números: especie, rareza, nivel, IVs y si es brillante. Cada especie se convierte de forma
determinista en una criatura **original** (nombre, dibujo SVG, elemento y golpes generados), así que la misma
especie se ve igual para todos. No se muestran nombres, sprites ni ataques de ninguna franquicia.

Elementos: Brasa > Brote > Marea > Brasa, y Chispa > Sombra > Roca > Chispa (×1.5 / ×0.67).

Del save se guarda solo eso (más el total de tokens para el ranking); el nombre del equipo, los logs y los
nombres de especies se descartan.

## Desarrollo

```sh
npm install
npm run dev     # http://localhost:8080, datos en ./data
npm test        # parser, motor de batalla y flujo completo con WebSocket
```

- `server/save.js`: lee el export (`format: "poketokenbar.save"`) o el estado crudo.
- `server/creatures.js`: especie → criatura original (nombre, look, stats, golpes).
- `server/battle.js`: motor puro de batalla (aleatoriedad inyectada).
- `server/index.js`: HTTP + WebSocket, desafíos, ranking. Persistencia en `data/db.json`.
- `public/`: frontend sin build (JS de módulos, SVG generado).

Las batallas en curso viven en memoria: reiniciar el servicio corta las peleas activas (quedan como "cortadas").

## Deploy (Podman + Cloudflare Tunnel, mismo patrón que entre-amigos)

La app corre en un contenedor sin puertos publicados, solo lectura, sin capabilities, en una red interna
sin salida. Solo `cloudflared` (en esa red y en una con salida) la alcanza. Los datos viven en `./data`.

| Archivo | Se instala como |
| --- | --- |
| `deploy/Containerfile` | imagen `localhost/token-clash:latest` |
| `deploy/token-clash.network`, `deploy/token-clash-egress.network` | `~/.config/containers/systemd/` |
| `deploy/token-clash.container`, `deploy/cloudflared-token-clash.container` | `~/.config/containers/systemd/` |

Túnel (ya creado, una sola vez): `cloudflared tunnel create token-clash`,
`cloudflared tunnel route dns token-clash clash.mirrordev.xyz`, y el token directo al secret
`cloudflared-token-clash-token` de Podman.

Actualizar (cuando nadie esté peleando):

```sh
cd ~/code/token-clash
podman tag token-clash token-clash:previous
podman build --format docker -t token-clash -f deploy/Containerfile .
systemctl --user restart token-clash
```

Si cambia un `.container`, cópialo de nuevo y `systemctl --user daemon-reload` antes del restart.
