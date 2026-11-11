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

## Criaturas (Tuxemon)

El save solo aporta números: especie, cadena evolutiva, rareza, nivel, IVs y si es brillante. Cada cadena evolutiva
se convierte de forma determinista en una línea evolutiva de [Tuxemon](https://github.com/Tuxemon/Tuxemon), un juego
de criaturas de código abierto, y cada etapa en la etapa equivalente: nombre, sprites de frente y espalda, elemento y
nombres de ataques (en español cuando Tuxemon los tiene traducidos). La misma especie se ve igual para todos.
No se muestran nombres, sprites ni ataques de ninguna franquicia comercial.

El arte de Tuxemon es CC BY-SA 4.0 / CC BY 4.0 según cada autor: los créditos están en `public/creditos.txt`
(enlazado desde el pie de la página). Los sprites recortados (`public/sprites/`) y el catálogo
(`server/tuxemon.json`) se regeneran con:

```sh
git clone --depth 1 https://github.com/Tuxemon/Tuxemon /tmp/tuxemon
python3 scripts/import-tuxemon.py /tmp/tuxemon   # necesita Pillow y PyYAML
```

Hay ~1000 especies y 363 criaturas, así que dos especies distintas a veces caen en la misma criatura (para eso
están los apodos).

Elementos: Brasa > Brote > Marea > Brasa, y Chispa > Sombra > Roca > Chispa (×1.5 / ×0.67). Los tipos de Tuxemon se
agrupan en esos seis; los normales quedan como Neutro.

Del save se guarda solo eso (más el total de tokens para el ranking); el nombre del equipo, los logs y los
nombres de especies se descartan. Saves importados antes de esta versión: "Actualizar save" para tomar la etapa
evolutiva exacta.

## Desarrollo

```sh
npm install
npm run dev     # http://localhost:8080, datos en ./data
npm test        # parser, motor de batalla y flujo completo con WebSocket
```

- `server/save.js`: lee el export (`format: "poketokenbar.save"`) o el estado crudo.
- `server/creatures.js`: especie → criatura de Tuxemon (nombre, sprite, elemento, stats, golpes).
- `scripts/import-tuxemon.py`: genera `server/tuxemon.json`, `public/sprites/` y `public/creditos.txt`.
- `server/battle.js`: motor puro de batalla (aleatoriedad inyectada).
- `server/index.js`: HTTP + WebSocket, desafíos, ranking. Persistencia en `data/db.json`.
- `public/`: frontend sin build (JS de módulos, sprites PNG).

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
