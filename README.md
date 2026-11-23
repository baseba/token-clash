# Token Clash

Batallas por turnos entre jugadores con los Pokémon que cada uno crió en
[PokeTokenBar](https://github.com/chattymin/PokeTokenBar) a punta de tokens.

En vivo: **https://clash.mirrordev.xyz**

**Índice:** [Cómo se juega](#cómo-se-juega) · [Combate](#combate) · [Pokémon (PokeAPI)](#pokémon-pokeapi) ·
[Créditos](#créditos) · [Desarrollo](#desarrollo) · [Dónde está cada cosa](#dónde-está-cada-cosa) ·
[Datos](#datos) · [Deploy](#deploy-podman--cloudflare-tunnel)

¿Vas a cambiar el código? Empieza por [Dónde está cada cosa](#dónde-está-cada-cosa), las convenciones de
[AGENTS.md](AGENTS.md) y la estructura de [ARQUITECTURA.md](ARQUITECTURA.md).

## Cómo se juega

1. En PokeTokenBar: Ajustes → Backup & Transfer → Exportar (`PokeTokenBar-Save-YYYY-MM-DD.json`).
   También sirve el archivo vivo `~/Library/Application Support/PokeTokenBar/companion-state.json`.
2. En la web, **Crear cuenta**: tu nombre de entrenador, una contraseña y el save. El nombre es único (sin importar
   mayúsculas ni espacios) y es tu usuario: desde otro dispositivo eliges **Iniciar sesión** con tu nombre y tu
   contraseña, y juegas con la misma cuenta y el mismo save. Cada dispositivo tiene su propia sesión y cerrarla no
   cierra las demás. Las cuentas creadas antes solo vivían en el navegador: pueden agregar una contraseña en su perfil
   (es opcional, pero sin ella no se puede cerrar sesión ni entrar desde otro lado). El sitio tiene cuatro pestañas:
   - **Inicio:** tu equipo, las salas abiertas y la nueva batalla.
   - **Colección** (`/coleccion`): tus Pokémon ordenados por número de Pokédex, con filtros por nombre, tipo y
     shiny. Si tienes repetidos de una especie, queda el primero que capturaste (el shiny y el normal se muestran
     los dos, pero en un equipo solo puede ir uno).
   - **Pokédex** (`/pokedex`): las 649 especies de la 1.ª a la 5.ª generación. Las que no tienes salen sin información y las
     que tienes muestran sprite, stats base y línea evolutiva; una preevolución de algo que tienes también queda
     registrada. Cada una tiene un switch para verla shiny si la tienes shiny.
   - **Stats:** tus batallas y torneos, el ranking y las stats del servidor.
   - **La Torre** (`/torre`): un modo inspirado en PokeRogue y en Emerald Rogue con tu colección. Eliges dificultad
     (la de la IA) y largo (10, 25, 50 pisos o infinita). En el laboratorio, el Profesor Rowan te ofrece Pokémon de tu
     colección (balanceados, con un solo legendario como máximo) y te llevas 3, en nivel 5 y en la primera forma de su
     línea. En cada piso normal el camino se divide en 3 a 5 caminos, como en Emerald Rogue: una ruta, una ruta difícil (rival entrenado,
     en tu tope, premio raro), una tranquila (más débil, premio común), una parada (dos premios sin pelear), una
     madriguera (reclutas sin pelear), una guarida villana (premio épico) o un pacto oscuro (dejas ir a uno por dos
     premios épicos). Cada 5 pisos hay un líder de gimnasio y, al cierre de cada bloque de 25, cuatro del Alto Mando y
     un campeón, de todas las regiones y sin repetirse, con su tipo, su escenario, la música de su región y su as. Los
     entrenadores de ruta son de todas las clases: con tema (un Montañero trae Roca o Tierra), principiantes en la
     tranquila y veteranos (Entrenador Guay, tu Rival con su inicial) en la difícil. En la guarida esperan reclutas
     de cada equipo villano o, a veces, un comandante, un jefe del Team Star o (más arriba) un jefe con su as, que
     pelea como un líder. Cada equipo rival es un sorteo, no lo mejor de su tema: cualquier especie que calce puede
     venir, sin importar la dificultad, y casi no se repiten las que ya enfrentaste en la subida. La dificultad se
     nota en cómo elige sus 3 de lo que sacó: al azar en Fácil, lo mejor contra tu equipo en las difíciles. Ves cada piso como un mapa visto desde arriba, dibujado según el
     escenario de la pelea, con los sprites de mapa de los entrenadores; caminas hasta el rival, te ve y empieza la
     pelea en nuestros fondos. Subes la torre hacia arriba: donde el camino se divide llegas desde abajo a una
     encrucijada con caminos a la izquierda, a la derecha y de uno a tres hacia arriba, y entras al mapa siguiente
     por el lado contrario al que saliste (si sales por la izquierda, el rival te espera al otro lado); tras cada
     descanso vuelves a subir. Los niveles siguen a Emerald Rogue: la tranquila va 4 niveles bajo tu tope, la ruta 2, la difícil y los
     reclutas de la guarida justo en él, y los jefes y líderes villanos en él o uno más; ningún rival de ruta pasa a
     tu Pokémon más alto, ni un jefe más de uno. El nivel que ves en cada
     camino es el del equipo que trae. En la Torre se pelea con los IVs reales: los rivales tienen IVs cerca de los
     de tu equipo y, si vienen entrenados, más o menos tus EVs; desde el piso 3 saben movimientos de MT, y desde el 10
     de tutor y de huevo, más fuertes mientras más subes. Ganas experiencia (curva media-rápida y fórmula escalada de la 5.ª generación), subes
     de nivel sin pasar el tope del piso siguiente (más rápido mientras más lejos estás de él; los pisos sin pelea
     te entrenan a medio camino), evolucionas hacia la forma que criaste (las que evolucionan por
     piedra o intercambio lo hacen a un nivel justo según su poder) y aprendes movimientos. Entre pisos eliges premios
     de tres rarezas, cada uno dice a quién le sirve y por qué, en términos de la pelea (cómo quedan sus stats, si
     el caramelo lo hace evolucionar, si el movimiento es de su tipo o cobertura nueva). Son 33, en familias: movimientos (MT, MT Poderosa,
     MT de Apoyo, tutor, movimiento huevo, Seta Memoria, Memorias y Gemas de otro tipo, Garra Rápida con prioridad,
     Teralito de su tipo), EVs (vitaminas, Plumas para todo el equipo, Brazal Firme, Bolsa de Vitaminas), IVs
     (Pesas, Chapa y Chapa Dorada), naturaleza (Menta y Menta Ideal), habilidad (Cápsula y Parche), niveles
     (Caramelos, Repartir Exp. y Tarro de Caramelos), evolución (Piedra Evolutiva y Cordón Unión), reclutas (Huevo
     Suerte y Huevo Dorado), el Amuleto Iris, que lo vuelve shiny, y objetos equipados como los de PokeRogue y
     Emerald Rogue, uno por Pokémon: potenciadores de tipo, Cinta Fuerte, Periscopio y Lupa (comunes), Restos,
     Campana Concha, Bayas Zidra y Ziuela, Cinta Focus, Casco Dentado y Mineral Evolutivo (raros), y Vidasfera,
     Cinta Experto y Banda Focus (épicos). Los rivales más arriba también llevan objetos: primero el as de los
     líderes, después el de los rivales fuertes y al final equipos completos. Mientras más subes, más raros los premios, y desde el piso 25 hay uno más; tras un
     jefe eliges dos. Puedes cambiarlos una vez, el juego te pregunta antes de subir si dejas algo sin elegir, y cambias movimientos y
     habilidades. Cada piso se sortea al llegar (sus caminos y rivales no se conocen antes). Cada piso ganado da puntos:
     el piso (ruta 100, gimnasio 300, Alto Mando 450, campeón 800) más el equipo rival (nivel × stats base), por el
     camino (difícil ×1,5, tranquila ×0,6) y la dificultad (de ×0,5 en Fácil a ×3 en Skynet). Si pierdes, la subida
     termina. Se guarda después de cada piso y solo da puntos y récords, en un ranking por dificultad en Stats con el
     detalle piso por piso: no toca tokens ni el ranking de batallas.
   - **Reciclaje** (`/reciclaje`): los Pokémon repetidos de tu save (copias de una especie y variante que ya tienes;
     la colección se queda con la primera) se arrastran a una trituradora que los convierte en tokens, más mientras
     más raros y el triple si son shiny. Cada repetido se recicla una sola vez: queda en un registro aunque vuelvas
     a subir el save.
   - **Perfil** (`/perfil`, con el tema de la GTS de fondo; `/tienda` redirige aquí): arriba tu foto, tu nombre
     (editable) y tu saldo, y debajo la tienda por categorías. Gastas los tokens que usas desde que abrió la tienda
     (se suman al actualizar tu save) y los que ganas reciclando, en cosméticos: Poké Balls para lanzar tus Pokémon (Super, Ultra, Lujo, Rogue y
     Master de PokeRogue, seis propias generadas al instalar cambiando la paleta de la Poké Ball y once variantes de
     colores de la Super, Ultra, Lujo, Rogue y Master, que cambian el tono de cada parte sin perder el sombreado), 14 marcos de
     ventana para el texto de tus peleas, 14 marcos para tu foto de perfil y 35 entrenadores. Los precios van por rareza: Común 100 M, Raro 300 M, Épico 800 M, Legendario 2.000 M y Mítico
     5.000 M. Nada cambia cómo pelean tus Pokémon.
   - **Entrenadores** (pestaña del perfil): eliges tu entrenador entre los ~300 sprites de PokeRogue, agrupados por
     personaje: al tocar uno ves el original y sus recolores, cada uno con su logro (también los ya conseguidos).
     Todos los originales se ganan con logros (`src/stats/domain/achievements.ts`, metas en
     `src/catalog/domain/trainer-goals.ts`), más difíciles según su rareza: las clases comunes piden 3 Pokémon de su
     tipo o un Pokémon temático (los reclutas, a los de su equipo; el ❔ de la meta dice cuáles cuentan), las raras 5,
     las épicas 8; los protagonistas piden iniciales; los líderes de gimnasio 3, 6, 10 y 15 de su tipo, el Alto Mando
     12 y victorias, los campeones la Pokédex regional (cerca de un 30 % de la región), torneos o el ranking (Red: primer
     lugar y 15 victorias, o 250 especies en la Pokédex), los villanos ganarle a la IA. Líderes,
     Alto Mando, campeones y villanos tienen además una vía con su Pokémon emblemático. Solo cuentan especies de la 1.ª
     a la 5.ª generación. Los principiantes (Youngster, School Kid, Preschooler) llegan con el primer Pokémon.
     Cada personaje tiene recolores (al menos uno simple; campeones y jefes villanos 4, protagonistas 3): siempre piden
     desbloquear primero al original. Las versiones ♂ y ♀ de un mismo entrenador comparten recuadro y colores de
     recolor. Al menos uno se vende en la tienda, un nivel de rareza sobre el original pero a precio de recolor
     (`RECOLOR_PRICES`, bastante más barato que el resto de su rareza);
     el resto se gana con Pokémon del tipo de su color (Carmesí → Fuego, Zafiro → Agua…). Los recolores con nombre de
     Pokémon piden tenerlo y usan su paleta (Red Charizard, Lance Rayquaza, Maxie Kyogre…); cada uno tiene además
     una versión Shiny con la paleta shiny del Pokémon, que pide lo mismo y tenerlo en shiny. `npm run variants` los
     replanifica (`scripts/plan-trainer-variants.mjs` escribe `public/trainer-variants.js`) y los genera. El
     planificador lee cada sprite como rampas de sombras (`scripts/sprite-ramps.mjs`): pinta la ropa y, si se ve, el
     pelo, cada rampa completa y en el mismo orden de luz, sin tocar el contorno ni los brillos que comparten varias
     partes. Al instalar también se calcula dónde está la cara de cada sprite (`public/trainers/faces.json`) para
     centrar el ícono de perfil. Al arrancar, el servidor devuelve los tokens de entrenadores que dejaron de venderse y cambia el
     entrenador de quien usaba uno que ya no tiene. Ese sprite, en chico, es tu foto de perfil; en las peleas tu entrenador y el
     rival entran al campo, lanzan sus Pokémon y se retiran, y vuelven al terminar (el tuyo, en espejo y más grande).
     Las IAs usan un entrenador al azar por pelea (el mismo durante todo un torneo), como sus nombres.
3. En **Colección** armas tus 6, los ordenas arrastrando (el primero es el líder) y eliges los
   movimientos y la habilidad de cada uno. "Actualizar save" sube uno más nuevo, y su pestaña **Modo hacker**
   explica paso a paso cómo dejar el Mac subiéndolo solo: un script que lee tu contraseña del Llavero y un
   LaunchAgent de `launchd` que lo corre cada vez que PokeTokenBar escribe su archivo (`POST /api/sync`, con tu
   nombre y contraseña; no abre sesión y solo actualiza el save).
4. En **Nueva batalla** eliges el modo y el rival:
   - **🎒 Batalla con tu equipo:** los 6 que armaste.
   - **🎲 Batalla aleatoria:** los dados sortean hasta 6 de la colección de cada uno, sin repetir especie, con
     movimientos y habilidad al azar.
   - **Contra otro jugador:** se abre una sala de espera, pública por defecto o privada.
     - **Pública:** si ya hay una sala abierta con el mismo modo, entras a esa. Si no, se abre la tuya y
       aparece en **Salas abiertas** del inicio, donde cualquiera puede entrar con un clic. La lista se
       actualiza en vivo: las salas nuevas aparecen y las que parten o se cierran desaparecen sin recargar.
     - **Privada:** no aparece en Salas abiertas; solo entra quien tenga el link.
     - Una sala pública deja de aparecer si el anfitrión cierra la página. Cuando alguien entra, los dos se ven en
       la sala y cada uno aprieta **¡Estoy listo!**; con los dos listos parte una cuenta regresiva de 5 s antes de
       elegir sus Pokémon (80 s para elegir). Ningún jugador ve qué eligió el rival ni en qué orden; cuando los dos
       eligen, pasan 4 s y parte la pelea en vivo (60 s por turno; si alguien no elige, su Pokémon ataca solo). Con **🏳 Rendirse**, arriba a la derecha junto
       al reloj y con confirmación, pierdes al tiro: cuenta como derrota en el ranking y en un torneo avanza el rival.
       Cualquiera más con el link puede mirar: en la preparación ve los dos equipos completos, lo que cada uno va
       marcando mientras elige, los 3 elegidos de cada lado durante esos 4 s y, en cada
       Pokémon, contra cuántos rivales tiene ventaja de tipo (⚔️) y cuántos lo amenazan (⚠️). Las IAs esperan a que
       terminen los dados, marcan sus 3 de a uno y confirman 5 s después.
   - **Torneo:** con tu equipo o aleatorio, de 4, 8 o 16 jugadores, en sala pública o privada.
     - El dueño puede rellenar los asientos libres con IAs de cualquier dificultad y quitar a quien quiera.
     - Parte cuando la sala está llena y todos aprietan ¡Estoy listo! (las IAs siempre están listas).
     - Se sortean las llaves con una animación y las peleas se juegan de a una, en orden, cada una con su cuenta
       regresiva. Todos siguen la pelea en curso: si es tuya juegas y si no la miras en modo espectador, con una
       barra y un marco celestes que no se confunden con los de tu propia pelea (dorados).
     - Si una pelea termina empatada, avanza uno por sorteo. Si alguien del torneo no está en la sala de su pelea,
       sus turnos se juegan solos a los 15 s para no frenar al resto.
     - Al final de cada pelea todos ven quién ganó y quién quedó fuera; luego vuelven a las llaves, donde se anima
       al que avanza, y pasan a la siguiente pelea.
     - Las IAs llevan nombres al azar de una lista fija (por ejemplo «nora ai - difícil»), sin repetirse dentro
       de un torneo.
     - Los torneos terminados con al menos 2 personas entran a **Tus torneos** y a la sección **Torneos** de
       `/stats` (campeones, finales y últimos torneos). Sus peleas no suman al ranking 1 contra 1.
   - **Contra la IA:** Fácil, Media, Difícil, Muy difícil o Skynet, con Pokémon de la 1.ª a la 5.ª generación.
     Con tu equipo, los dados sortean sus 6 entre Pokémon completamente evolucionados, y cada dificultad acota
     ese grupo a los más fuertes por estadísticas base (100 %, 80 %, 60 %, 50 % y 40 %); en aleatoria sortea
     entre todos los completamente evolucionados y la dificultad solo cambia cómo pelea. **Skynet** le pregunta
     en cada turno a [Jev](https://docs.typesafe.ai) (el modelo de decisiones de TypeSafe) qué ataque usar o a
     quién sacar; solo aparece si el servidor tiene cómo llegar a Jev (ver Deploy). Las peleas contra la IA no
     cuentan para el ranking ni quedan en tu historial.

   En todos los modos, cada uno ve los 6 del otro (con sus tipos) y elige 3. Todos los Pokémon pelean a nivel 100,
   sin importar el nivel que tengan en el save: gana la estrategia, no quién quemó más tokens.
5. **Stats** (`/stats`) muestra el ranking (solo quienes han peleado contra otro jugador), las batallas
   recientes, los Pokémon más usados y los totales del servidor. Quien importó el mismo save en varias cuentas
   cuenta como un solo entrenador, y sus Pokémon y tokens se suman una sola vez.

## Combate

El motor (`src/combat/domain/`, que se lee desde `battle.ts`) sigue las reglas de los juegos para combates individuales: daño con STAB,
efectividad, críticos y variación; estados y volátiles (confusión, atracción, drenadoras, apresado…); clima,
campos, barreras (Reflejo, Pantalla de Luz, Velo Aurora), trampas de campo, Protección, Sustituto, prioridad,
golpes múltiples y movimientos de cambio, que cambian al Pokémon en el momento. Los que dañan al usuario siguen
las mismas reglas: retroceso según el daño causado (Cabeza Roca y Muro Mágico lo evitan), Cabeza Sorpresa y
Metaláser cuestan la mitad de los PS máximos, las patadas que fallan dañan al usuario, Explosión y Autodestrucción
lo debilitan (Humedad las bloquea) y los costos de PS de Tambor, Sustituto o Maldición no los evita Muro Mágico.
Los movimientos de apoyo pensados para un aliado (Pulso Cura, Cura Floral, Purificación, Decoración, Niebla
Aromática, Entrenamiento, Acupresión y Poder Polen) dejan elegir sobre quién se usan: tu Pokémon o el rival.
Las habilidades están en
`src/combat/domain/ability-effects.ts` y las reglas especiales de cada movimiento en `src/combat/domain/move-rules.ts`.

No hay objetos ni combates dobles: los movimientos y habilidades que dependen de eso no tienen efecto en Token
Clash y no se pueden elegir. Si un save trae uno, se reemplaza por otro al azar de los que sí funcionan; si no
hay reemplazo, el Pokémon queda con menos movimientos o sin habilidad. El género sale del save o de la
proporción de la especie, y se muestra porque afecta a movimientos como Atracción.

## Pokémon (PokeAPI)

El save solo aporta números: especie, cadena evolutiva, rareza, nivel, IVs y si es shiny. Todo lo demás sale de
[PokeAPI](https://pokeapi.co): nombre, las seis stats base, tipos reales, habilidades, peso, proporción de
género, de qué especie evoluciona, los movimientos que aprende cada especie por nivel y los sprites (los animados de Negro/Blanco cuando
existen, de frente, de espalda y shiny). Los datos de combate de cada movimiento (prioridad, banderas, efectos)
salen de los datos con licencia MIT de [Pokémon Showdown](https://github.com/smogon/pokemon-showdown). Por
defecto, cada Pokémon usa los últimos cuatro movimientos que aprende por nivel; en `/coleccion` se cambian. Un
Pokémon evolucionado también puede usar lo que aprendían sus preevoluciones (Raichu tiene los de Pichu, Pikachu
y Raichu).

Los datos viven en `src/catalog/data/` (`pokeapi.json`, `movedex.json` y `abilities.json`).

Los sprites, los gritos, los sonidos y la música no los sirve el juego. El navegador los baja de
[jsDelivr](https://www.jsdelivr.com/), que responde desde cerca, de los repos donde viven:
[PokeAPI/sprites](https://github.com/PokeAPI/sprites), los gritos reales de
[PokeAPI/cries](https://github.com/PokeAPI/cries) y
[pokerogue-assets](https://github.com/pagefaultgames/pokerogue-assets). Cada repo está fijado a un commit en
`public/upstream.js`, así que una URL nunca cambia de contenido, y si jsDelivr falla el navegador pide el mismo archivo
una vez a raw.githubusercontent.com. Los manifiestos de `public/upstream/` (`sprites.json`, `cries.json` y
`pokerogue.json`) dicen dónde está cada archivo en su repo y se versionan; `npm run sprites`, `npm run cries` y
`npm run anims` los regeneran contra el commit fijado, resolviendo una vez, con peticiones HEAD, el sprite que
reemplaza a uno que falta (un shiny de espalda que no existe muestra el shiny de frente).

Las animaciones de batalla y sus sonidos vienen de [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets):
`npm install` convierte la animación de cada movimiento de `src/catalog/data/movedex.json` y las de estados,
ataduras, protección, clima, campos y cargas a `public/anims/`, junta los tiempos de sus sonidos en
`public/sfx/moves/moves.json` y pinta las Poké Balls de la tienda en `public/anims/ui/`. Sus hojas de sprites, fondos y
sonidos, los efectos de Poké Ball, golpes, debilitado y stats, y la música se cargan desde jsDelivr; el mismo script
guarda los puntos de loop de la música en `public/music/loops.json`. Cada escena de batalla toca
un tema de combate contra entrenadores acorde a lo que muestra (Alola en la playa, el gimnasio de Sinnoh en la cueva,
el Team Aqua en el océano, la campeona de Sinnoh en la nieve, etc.; la lista está en `public/music.js`), los menús
tocan las pistas tranquilas de bioma (`town`, `tall_grass`, `laboratory`, `plains`), la preparación
`menu`, el perfil `title` (el tema original de PokeRogue) y al ganar suena `bw/victory_trainer` (o
`bw/victory_champion` en un torneo). No hay música sintética. La **📻 radio** de la cabecera trae las 175 pistas
de PokeRogue (`public/radio.js`), filtrables por batalla u otras, por región o generación y por las originales de
PokeRogue; mientras está encendida suena en vez de la música de cada pantalla, en todo el sitio y entre recargas.
Cada entrenador puede abrir además su **estación**: elige la cola y cualquiera, con o sin sesión, entra desde la
pestaña "Estaciones" a escuchar lo mismo al mismo tiempo. Cada canción suena una vez entera y después empieza la
siguiente; si la cola se vacía, la última sigue en loop. El servidor toca la cola con su reloj (por eso conoce la
duración de cada pista, en `src/catalog/data/radio-durations.json`) y la estación queda guardada aunque se reinicie.
`public/battle-anims.js` las reproduce cuadro a cuadro sobre el campo; lo que no tenga animación usa los efectos
sintéticos de `public/fx.js` y `public/music.js`. El campo de batalla replica el de PokeRogue: un escenario lógico de
320×180 escalado al ancho disponible, con nuestros fondos (`public/backgrounds/`) escalados al ancho del campo y
sus plataformas, los Pokémon anclados en (106, 142) y (236, 84) a tamaño de sprite real, cajas y cuadro de texto con el
estilo del resto de la app, y los mismos tiempos de golpe
(parpadeo), barra de PS (5 ms por punto), debilitado, retirada y entrada con Poké Ball. El servidor nunca llama a la
PokeAPI (en producción no tiene salida a internet). Para refrescar los datos, con Node 22 o más:

```sh
node scripts/import-pokeapi.mjs   # unos minutos, reescribe los JSON de src/catalog/data/ y los manifiestos de sprites y gritos
```

Las especies que la PokeAPI no conoce quedan como tipo Normal, con stats según su rareza.

Tipos: los 18 reales con la tabla de efectividad real (×2, ×0.5, ×0), en `public/types.js`, que comparten el
servidor y el navegador.

Del save se guarda solo eso (más el total de tokens para las stats); el nombre del equipo, los logs y los
nombres de especies se descartan. Saves importados antes de esta versión: "Actualizar save" para tomar la etapa
evolutiva exacta.

## Créditos

Proyecto sin fines comerciales, para jugar entre amigos. Pokémon y sus nombres son de Nintendo, Creatures Inc. y
GAME FREAK inc.

- Datos y sprites: [PokeAPI](https://pokeapi.co/); gritos: [PokeAPI/cries](https://github.com/PokeAPI/cries).
- Movimientos y su texto: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) (MIT).
- Música: las pistas de [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets) (las
  composiciones de la comunidad, como `cave`, `tall_grass`, `snowy_forest`, `lake`, `sea` o `plains`, son de Bird_Obsession,
  Lmz, Andr06 y Firel con CC BY-NC-SA 4.0; el resto lo marcan como material de Nintendo). El navegador las carga de jsDelivr.
- Sprites de entrenadores: [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets) (material de Nintendo,
  Creatures y GAME FREAK; `bug_type_superfan` es de Chani von Karpa y `aliana`, `celosia` y `mable` de Red, con
  CC BY-NC-SA 4.0). Se descargan al instalar y no se versionan.
- La Torre: íconos de objetos de [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets) (CC BY-NC-SA 4.0
  salvo lo que marcan como material de Nintendo) y de [PokeAPI/sprites](https://github.com/PokeAPI/sprites) (los
  objetos equipados), que el navegador carga de jsDelivr; sprites de mapa de los entrenadores de
  [Pokabbie/pokeemerald-rogue](https://github.com/Pokabbie/pokeemerald-rogue) y de los decompilados
  [pret/pokeemerald](https://github.com/pret/pokeemerald), [pret/pokefirered](https://github.com/pret/pokefirered) y
  [pret/pokeplatinum](https://github.com/pret/pokeplatinum) (material de Nintendo, Creatures y GAME FREAK). Se
  descargan al instalar, fijados a un commit, y no se versionan.
- Animaciones de batalla, sus sonidos, la Poké Ball y los efectos de sonido: [PokeRogue](https://github.com/pagefaultgames/pokerogue-assets), de
  Pagefault Games y sus colaboradores. Las animaciones y los sonidos `PRSFX-` son de
  [Pokémon Reborn](https://www.rebornevo.com/); las animaciones `GEN8-` son del Gen 8 Animation Project
  (CC BY-NC-SA 4.0). El navegador carga las hojas y los audios de jsDelivr; no se versionan.

## Desarrollo

Backend en [NestJS](https://nestjs.com) con TypeScript, organizado por dominios; datos en SQLite con
[Drizzle](https://orm.drizzle.team). El frontend (`public/`) sigue siendo JS de módulos sin build. Cómo está
armado y por qué: [ARQUITECTURA.md](ARQUITECTURA.md).

```sh
npm install
npm run dev          # compila y levanta http://localhost:8080 (recompila al guardar), datos en ./data
npm test             # typecheck estricto + más de 200 tests: reglas, motor, IA, persistencia y flujo completo por WebSocket
npm run build        # TypeScript → dist/
npm run db:generate  # tras cambiar un *.schema.ts: genera la migración SQL en drizzle/
```

Node 22.13 o más (usa `node:sqlite`, que viene con Node: no hay módulos nativos que compilar).

### Dónde está cada cosa

Por carpeta:

| Carpeta | Qué hay |
| --- | --- |
| `src/catalog/` | Especies, movimientos, habilidades y tipos de PokeAPI (`data/*.json`), la Pokédex y las listas que comparte con el navegador: la tienda y los entrenadores. Solo datos y reglas puras. |
| `src/combat/` | El motor de batalla, la elección de 3, el sorteo aleatorio, la IA y Skynet (cliente y proxy de Jev). |
| `src/trainers/` | Entrenadores: importar el save, la colección, el equipo, la cuenta y sus sesiones, el saldo, lo comprado y el reciclaje. Dueño de `trainers`, `roster_entries` y `trainer_sessions`. |
| `src/arena/` | Salas 1 contra 1, emparejamiento, peleas en vivo y torneos. Dueño de `challenges` y `tournament*`. |
| `src/chat/` | El chat de salas y torneos (en memoria). |
| `src/radio/` | Las estaciones de radio de los entrenadores: la cola que elige el DJ, qué suena y quién escucha. Dueño de `radio_stations`. |
| `src/tower/` | La Torre: subidas con tu colección, pisos, crecimiento, premios y récords. Dueño de `tower_runs`. |
| `src/stats/` | La página de stats y los logros. No guarda nada: los cambios del entrenador se los pide a `TrainersService`. |
| `src/realtime/` | El protocolo WebSocket (`/ws`). |
| `src/web/` | El frontend estático y los health checks. |
| `src/shared/` | Configuración, errores de dominio, HTTP (guards, filtro de errores) y la base de datos. |
| `src/legacy/` | La migración única desde `data/db.json`. |
| `src/architecture.spec.ts` | El test que hace cumplir la regla de dependencia entre capas y dominios. |
| `drizzle/` | Migraciones SQL generadas por drizzle-kit; la app las aplica al arrancar. |
| `src/**/*.spec.ts` | Tests unitarios (`node:test`), al lado del código que prueban. |
| `test/` | Tests e2e (`*.e2e-spec.ts`: levantan la app entera), los del frontend (`test/web/`, en JS) y el save de ejemplo (`fixtures/`). |
| `public/` | El frontend: `index.html`, `style.css`, `app.js` (toda la interfaz) y un módulo por tema. |
| `public/upstream.js`, `public/upstream/` | De qué commit de cada repo externo salen los sprites, gritos, sonidos y música, y los manifiestos que dicen dónde está cada archivo. |
| `scripts/` | Descargas e importaciones de datos externos (detalle abajo). |
| `deploy/` | Imagen, contenedores, redes y el deploy automático (ver [Deploy](#deploy-podman--cloudflare-tunnel)). |

Por tema:

| Tema | Reglas (servidor) | Entrada | Navegador |
| --- | --- | --- | --- |
| Importar el save | `src/trainers/domain/save-file.ts` | `POST /api/import` en `trainers/interface/trainers.controller.ts` | `public/savestore.js` |
| Cuenta: nombre único, contraseña y sesiones | `src/trainers/domain/credentials.ts` (largo y hash con scrypt), `nameKey` y sesiones en `src/trainers/domain/trainer.ts`, nombre libre en `trainers.service.ts` | `POST /api/login`, `POST /api/logout`, `PUT /api/me/password`, `POST /api/sync` (Basic, para el Mac; headers en `trainers/application/auth-headers.ts`) en `trainers/interface/trainers.controller.ts`; el token de cada request lo lee `session.guard.ts` | `public/app.js` |
| Colección, equipo, movimientos | `src/trainers/domain/trainer.ts` | `PUT /api/me`, `PUT /api/me/mons/:id` | `public/app.js` |
| Pokédex | `src/catalog/domain/pokedex.ts` | `GET /api/pokedex` en `trainers/interface/trainers.controller.ts` | `public/app.js` |
| Motor de batalla | `src/combat/domain/battle.ts` (mapa de archivos al principio), `move-rules.ts`, `ability-effects.ts` | WebSocket, por la arena | `public/battle-anims.js`, `public/fx.js` |
| IA y Skynet | `src/combat/domain/ai.ts`, `src/combat/application/skynet.service.ts`, `src/combat/infrastructure/jev/` | | |
| Salas y emparejamiento | `src/arena/domain/challenge.ts`, `lobby.ts` | `arena/interface/challenges.controller.ts` | `public/app.js` |
| Pelea en vivo (fases de la sala) | `src/arena/application/duel.service.ts`, `team-preview.service.ts`, `live-battle.service.ts`, `presence.ts`; lo que ve cada cliente, en `room-frames.ts` | `src/realtime/game.gateway.ts`, mensajes en `client-messages.ts` | `public/app.js`, `public/battle-anims.js` |
| Torneos | `src/arena/domain/tournament.ts`, `arena/application/tournaments.service.ts` | `arena/interface/tournaments.controller.ts` | `public/app.js` |
| Chat | `src/chat/domain/chat.ts`, canales en `arena/application/arena-chat.service.ts` | WebSocket | `public/app.js` |
| Ranking y stats | `src/trainers/domain/ranking.ts`, `src/stats/application/server-stats.ts` | `GET /api/stats` en `stats/interface/stats.controller.ts`, `GET /api/leaderboard` en `trainers/interface/trainers.controller.ts` | `public/app.js` |
| Logros y entrenador del perfil | `src/stats/domain/achievements.ts` | `GET /api/me/achievements`, `PUT /api/me/look` en `stats/interface/achievements.controller.ts` | `public/trainer-sprites.js` |
| Variantes de colores de entrenadores | `public/trainer-sprites.js` (a mano), `public/trainer-variants.js` (lo genera `scripts/plan-trainer-variants.mjs` con las rampas de `scripts/sprite-ramps.mjs`); `scripts/sync-trainers.js` pinta los sprites al instalar | | `public/app.js` |
| Tienda | artículos y precios en `public/shop.js` (tipados en `src/catalog/domain/shop.ts`); saldo y compra en `src/trainers/domain/trainer.ts`; "pide al original" en `src/stats/domain/achievements.ts` | `GET /api/shop`, `POST /api/shop/buy`, `PUT /api/me/equip` en `stats/interface/achievements.controller.ts`, con los DTOs de `trainers/interface/dto/shop.dto.ts` | `public/shop.js`, `public/app.js` (la tienda está en `/perfil`) |
| La Torre | `src/tower/domain/tower-run.ts` (la subida y sus estados), `floors.ts` (qué hay en cada piso), `growth.ts` (experiencia, evolución y movimientos), `lab.ts` (ofertas de tu colección), `foe-team.ts` (el equipo rival y cómo elige sus 3), `rewards.ts` (premios y sus rarezas), `score.ts` (puntos de cada piso); los objetos equipados en `src/catalog/domain/held-items.ts` (qué son) y `src/combat/domain/item-effects.ts` (qué hacen en batalla, con los hooks de las habilidades); salas del camino en `floors.ts` (`roomsAt`); personajes, escenarios y música en `public/tower-cast.js` (tipados en `src/catalog/domain/tower-cast.ts`) | `/api/tower/...` en `tower/interface/tower.controller.ts`; cada piso es una sala contra la IA con `staging` (`DuelService.startStaged`) | `public/app.js` (página `/torre`), `public/tower-map.js` (el mapa de cada piso y sus transiciones), `public/tower-tiles.js` (cómo se arma cada mapa y sus tiles), `public/overworld.js` (sprites de mapa) |
| Tipos y efectividad | `public/types.js` (lo comparten servidor y navegador) | | |
| Escenario de batalla y sprites de Pokémon | | | `public/backgrounds.js`, `public/creature.js` (URL de cada sprite según `public/upstream/sprites.json`) |
| Archivos externos (jsDelivr y respaldo en GitHub) | | | `public/upstream.js` (commits fijados, URLs y respaldo), `public/upstream/*.json`; la CSP que los permite está en `src/shared/http/security-headers.middleware.ts` |
| Reciclaje de repetidos | `src/trainers/domain/recycling.ts` (cuánto vale cada uno), `Trainer.recycle` en `trainer.ts`; los repetidos salen de `save-file.ts` | `GET` y `POST /api/me/recycling` en `trainers/interface/trainers.controller.ts` | `public/app.js` |
| Efectos al abrir la Poké Ball | | | `public/ball-fx.js` (efecto por Ball y rareza), `public/ball-burst.js` (los dibuja en un canvas) |
| Música, radio y sonidos | duración de cada pista en `src/catalog/domain/radio-tracks.ts` (la mide `scripts/sync-radio.js`) | | `public/music.js`, `public/radio.js`, `public/fx.js` |
| Estaciones de radio | `src/radio/domain/station.ts` (la cola y qué suena), `src/radio/application/radio.service.ts` (timers y oyentes) | `radio/interface/radio.controller.ts` (`/api/radio/...`), WebSocket `{ t: 'radio' }` en `src/realtime/game.gateway.ts` | `public/radio-station.js` (las pestañas y el socket de la estación), `public/music.js` |
| Notificaciones | | | `public/notify.js` |
| Configuración y variables de entorno | `src/shared/config/app-config.ts` | | |
| Seguridad HTTP y límites | `src/shared/http/` | | |
| Base de datos | `*/infrastructure/*.schema.ts`, `src/shared/infrastructure/database/` | | |
| CI | `.github/workflows/ci.yml` (`npm test` y la imagen) | | |


Datos externos:

- `scripts/import-pokeapi.mjs`: genera `src/catalog/data/pokeapi.json`, `movedex.json` y `abilities.json`.
- `scripts/sprites.mjs` (`npm run sprites`): escribe `public/upstream/sprites.json`, los cuatro sprites de cada especie y forma (de frente, shiny, de espalda y de espalda shiny) en PokeAPI/sprites, con el reemplazo de cada uno que falta ya resuelto.
- `scripts/sync-cries.js` (`npm run cries`): escribe `public/upstream/cries.json`, el grito de cada especie y forma en PokeAPI/cries (el actual o, si no hay, el antiguo).
- `scripts/sync-battle-anims.js`: compacta las animaciones de PokeRogue en `public/anims/<clave>.json` (versión del jugador y del rival cuando difieren), arma `public/sfx/moves/moves.json` con los tiempos de cada sonido y pinta las Poké Balls (corre solo en `npm install` y en la imagen). Falla si una animación nombra un archivo que `public/upstream/pokerogue.json` no ubica; `npm run anims` (`--manifest`) reescribe ese manifiesto: hojas, sonidos de movimientos, efectos y música.
- `scripts/sync-trainers.js`: descarga los entrenadores de la lista de `public/trainer-sprites.js` a `public/trainers/`,
  recortando el primer cuadro de cada hoja de sprites (corre solo en `npm install`, o `npm run trainers`). Los sirve el
  juego porque no son copias exactas: el recorte y las variantes de colores salen de acá.
- `scripts/sync-tilesets.js` (`npm run tiles`): arma `public/tiles/tower.png`, el atlas con los metatiles de
  Emerald (pret/pokeemerald) que usan los mapas de la torre (`ATLAS_KEYS` de `public/tower-tiles.js`). Corre en
  `npm install` y en la imagen; no se versiona.
- `scripts/sync-overworlds.js` (`npm run overworlds`): arma `public/overworlds/<clave>.png`, el sprite de mapa de
  cada entrenador y variante, en una hoja común de 16 cuadros de 32×32. Toma el oficial de la tabla
  `scripts/overworld-sources.json`. A quien no tiene oficial lo arma `scripts/overworld-compose.mjs` con piezas
  oficiales de su género (cuerpo y cabeza) repintadas con los colores de su sprite de batalla. Las variantes
  repintan sus rampas con las reglas del sprite de batalla (`scripts/overworld-recolor.mjs`): el reemplazo se decide
  en el cuadro de frente y se copia color por color a la espalda y los costados. Corre en `npm install` y en la
  imagen.
- `scripts/sync-radio.js` (`npm run radio`): baja cada canción de la radio del commit fijado de pokerogue-assets, mide su duración leyendo los frames del mp3 y escribe `src/catalog/data/radio-durations.json`. Córrelo si cambia el commit o la lista de `public/radio.js`: el servidor no arranca si a una canción le falta su duración.
- `scripts/upstream-files.js`: lo que comparten esos scripts para leer los repos externos en el commit fijado (reintentos, HEAD, manifiestos con una entrada por línea).
- `public/battle-anims.js`: intérprete propio del formato de animación de PokeRogue (cuadros de 50 ms, focos en atacante, objetivo o pantalla, fondos).
- `public/types.js`: tipos y tabla de efectividad, compartidos por el navegador y el servidor.
- Skynet (`src/combat/infrastructure/jev/`) le pasa a Jev solo lo que vería un jugador de ese lado (sin nombres de
  entrenador ni apodos) y las acciones válidas como una pregunta Choice. Si Jev no responde en 4 s o falla, decide la IA
  Muy difícil. Variables: `JEV_API_URL` (en producción, el proxy) o `JEV_API_KEY` para llamar directo a TypeSafe; sin
  ninguna de las dos no hay Skynet. `JEV_MODEL` fija la versión (por defecto `jev-1.14.0`).

### Datos

Todo vive en `DATA_DIR/token-clash.db` (SQLite, modo WAL). Nada se borra: los desafíos y torneos quedan para siempre.
Hasta la versión 0.1 los datos estaban en `data/db.json`: el primer arranque con SQLite lo importa entero en una
transacción y lo deja intacto como respaldo (si un deploy vuelve a la imagen anterior, esa sigue encontrando sus datos).
No se vuelve a importar. Para comprobar una copia real sin tocar nada:
`LEGACY_DB=/ruta/a/db.json node --test dist/src/legacy/legacy-json-import.spec.js` (tras `npm test`).

Las batallas en curso viven en memoria: reiniciar el servicio corta las peleas activas (quedan como "cortadas").

## Deploy (Podman + Cloudflare Tunnel)

La app corre en un contenedor sin puertos publicados, solo lectura, sin capabilities, en una red interna
sin salida. Solo `cloudflared` (en esa red y en una con salida) la alcanza. Los datos viven en `./data`
(`token-clash.db`, más el `db.json` de antes de SQLite como respaldo).
Para Skynet, la app le pregunta a Jev a través de `token-clash-jev`, un proxy en las mismas dos redes que solo
reenvía `POST /v1/systemone` a TypeSafe y le agrega la clave: la app sigue sin salida y sin la clave.

| Archivo | Se instala como |
| --- | --- |
| `deploy/Containerfile` | imagen `localhost/token-clash:latest` |
| `deploy/token-clash.network`, `deploy/token-clash-egress.network` | `~/.config/containers/systemd/` |
| `deploy/token-clash.container`, `deploy/cloudflared-token-clash.container`, `deploy/token-clash-jev.container` | `~/.config/containers/systemd/` |

Túnel (ya creado, una sola vez): `cloudflared tunnel create token-clash`,
`cloudflared tunnel route dns token-clash clash.mirrordev.xyz`, y el token directo al secret
`cloudflared-token-clash-token` de Podman.

Clave de Jev (una sola vez): `podman secret create token-clash-jev-key archivo-con-la-clave`. Sin el proxy
corriendo, Skynet sigue apareciendo pero juega como Muy difícil (`journalctl --user -u token-clash` lo avisa).

### Deploy automático

En el servidor, `token-clash-deploy.timer` corre `deploy/deploy.sh` cada 2 minutos. Desde GitHub nadie entra al
servidor: es el servidor el que va a buscar los cambios. Cuando `origin/main` tiene un commit nuevo:

1. Espera a que el CI de ese commit (`test` y `container`) esté en verde. Si falla, ese commit no se despliega.
2. Espera a que no haya peleas en curso (`/healthz/battles`, solo responde desde dentro del contenedor).
3. Hace fast-forward de `~/code/token-clash`, construye la imagen (la anterior queda como `token-clash:previous`) y
   reinicia. Si no queda sana, vuelve a la imagen anterior y no reintenta ese commit.

Si cambia algo del host (`deploy/*.container`, `*.network`, `*.service`, `*.timer` o el propio `deploy.sh`), no
despliega y lo deja anotado en el log: esos cambios se instalan a mano (abajo). Así, un PR mergeado nunca cambia
lo que corre fuera del contenedor.

```sh
journalctl --user -u token-clash-deploy -n 50   # qué hizo
systemctl --user list-timers token-clash-deploy # cuándo vuelve a mirar
```

Instalar o actualizar el deploy automático:

```sh
cd ~/code/token-clash
install -m 755 deploy/deploy.sh ~/.local/bin/token-clash-deploy
cp deploy/token-clash-deploy.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now token-clash-deploy.timer
```

### Deploy a mano

Para cambios del host, o si el automático está apagado (cuando nadie esté peleando):

```sh
cd ~/code/token-clash
git pull --ff-only
cp deploy/*.container deploy/*.network ~/.config/containers/systemd/   # si cambiaron
systemctl --user daemon-reload
podman tag token-clash token-clash:previous
podman build --format docker -t token-clash -f deploy/Containerfile .
systemctl --user restart token-clash
systemctl --user restart token-clash-jev   # usa la misma imagen
```

Volver a la versión anterior: `podman tag token-clash:previous token-clash:latest && systemctl --user restart token-clash`.
