// Who you meet in the Tower, where and what they say. The server builds each floor from it (trainer,
// types its team uses, scene, music) and the browser draws it. Trainers are the keys of
// public/trainer-sprites.js: their battle sprite and their overworld sprite (public/overworlds/,
// made at install by scripts/sync-overworlds.js) are the same character. A scene is one of our battle
// backgrounds (public/backgrounds.js); the map of a floor is drawn after it.

export const TOWER_LENGTHS = [10, 25, 50, null];
export const GYM_EVERY = 5;
export const LEAGUE_BLOCK = 25;
export const ELITE_FLOORS = 4;
export const PARTY_LIMIT = 6;
export const START_LEVEL = 5;
export const MAX_LEVEL = 100;
export const LAB_OFFERS = 6;
export const STARTERS = 3;
export const LAB_SCENE = 'path';
export const PROFESSOR = { key: 'prof_rowan', name: 'Profesor Rowan' };

/** Where a team of each type fights. */
export const TYPE_SCENES = {
  normal: ['path', 'tall-grass'], fire: ['desert', 'mountain-night'], water: ['lake', 'beach', 'ocean'], grass: ['tall-grass', 'path-2'],
  electric: ['desert-night', 'path-2'], ice: ['snow', 'snow-night'], fighting: ['mountain-2', 'path'], poison: ['path-night', 'lake-night'],
  ground: ['desert', 'mountain-2'], flying: ['mountain-2', 'beach-2'], psychic: ['cave-night', 'path-night'], bug: ['tall-grass', 'tall-grass-night'],
  rock: ['cave', 'mountain'], ghost: ['path-night', 'cave-night'], dragon: ['ocean-night', 'mountain-night'], dark: ['beach-night', 'path-night'],
  steel: ['cave-2', 'mountain'], fairy: ['path-2', 'tall-grass'],
};
export const ROUTE_SCENES = ['tall-grass', 'path', 'lake', 'beach', 'mountain', 'desert', 'path-2', 'beach-2', 'cave', 'snow', 'ocean', 'underwater'];

export const REGIONS = {
  kanto: ['brock', 'misty', 'lt_surge', 'erika', 'koga', 'janine', 'sabrina', 'blaine', 'giovanni', 'lorelei', 'bruno', 'agatha', 'lance', 'blue', 'red'],
  johto: ['falkner', 'bugsy', 'whitney', 'morty', 'chuck', 'jasmine', 'pryce', 'clair', 'will', 'karen'],
  hoenn: ['roxanne', 'brawly', 'wattson', 'flannery', 'norman', 'winona', 'tate', 'liza', 'juan', 'sidney', 'phoebe', 'glacia', 'drake', 'steven', 'wallace'],
  sinnoh: ['roark', 'gardenia', 'maylene', 'crasher_wake', 'fantina', 'byron', 'candice', 'volkner', 'aaron', 'bertha', 'flint', 'lucian', 'cynthia'],
  unova: ['cilan', 'chili', 'cress', 'lenora', 'burgh', 'elesa', 'clay', 'skyla', 'brycen', 'drayden', 'iris', 'roxie', 'marlon', 'shauntal', 'grimsley', 'caitlin', 'marshal', 'alder'],
  kalos: ['viola', 'grant', 'korrina', 'ramos', 'clemont', 'valerie', 'olympia', 'wulfric', 'malva', 'siebold', 'wikstrom', 'drasna', 'diantha'],
  alola: ['hala', 'olivia', 'acerola', 'kahili', 'molayne', 'kukui', 'hau'],
  galar: ['milo', 'nessa', 'kabu', 'bea', 'allister', 'opal', 'gordie', 'melony', 'piers', 'raihan', 'leon'],
  paldea: ['katy', 'brassius', 'iono', 'kofu', 'ryme', 'tulip', 'grusha', 'larry', 'rika', 'poppy', 'hassel', 'geeta', 'nemona', 'kieran', 'crispin', 'amarys', 'lacey', 'drayton'],
};

export const MUSIC = {
  gym: { kanto: 'battle_kanto_gym', johto: 'battle_johto_gym', hoenn: 'battle_hoenn_gym', sinnoh: 'battle_sinnoh_gym', unova: 'battle_unova_gym', kalos: 'battle_kalos_gym', alola: 'battle_alola_elite', galar: 'battle_galar_gym', paldea: 'battle_paldea_gym' },
  elite: { kanto: 'battle_johto_gym', johto: 'battle_johto_gym', hoenn: 'battle_hoenn_elite', sinnoh: 'battle_unova_elite', unova: 'battle_unova_elite', kalos: 'battle_kalos_elite', alola: 'battle_alola_elite', galar: 'battle_galar_elite', paldea: 'battle_paldea_elite' },
  champion: { kanto: 'battle_kanto_champion', johto: 'battle_johto_champion', hoenn: 'battle_hoenn_champion_g5', sinnoh: 'battle_sinnoh_champion', unova: 'battle_champion_alder', kalos: 'battle_kalos_champion', alola: 'battle_alola_champion', galar: 'battle_galar_champion', paldea: 'battle_champion_geeta' },
  route: 'battle_trainer',
  lateRoute: 'battle_rival_2',
  hideout: 'battle_rocket_grunt',
};

export const NAMES = {
  m: ['Tomás', 'Matías', 'Benjamín', 'Vicente', 'Joaquín', 'Agustín', 'Cristóbal', 'Diego', 'Felipe', 'Lucas', 'Maximiliano', 'Gaspar', 'Ignacio', 'Simón', 'Bruno', 'Martín', 'Sebastián', 'Nicolás', 'Andrés', 'Rodrigo', 'Pablo', 'Gonzalo', 'Emilio', 'Renato', 'Alonso', 'Julián', 'Facundo', 'Damián', 'Elías', 'Bastián', 'Ramiro', 'Hernán', 'Óscar', 'Raúl', 'Esteban', 'Fabián', 'León', 'Mateo', 'Thiago', 'Iván', 'Camilo', 'Patricio', 'Germán', 'Álvaro', 'Manuel'],
  f: ['Javiera', 'Antonia', 'Catalina', 'Florencia', 'Isidora', 'Martina', 'Josefa', 'Trinidad', 'Amanda', 'Emilia', 'Fernanda', 'Renata', 'Constanza', 'Valentina', 'Paz', 'Sofía', 'Agustina', 'Magdalena', 'Ignacia', 'Francisca', 'Daniela', 'Camila', 'Rocío', 'Belén', 'Macarena', 'Pía', 'Colomba', 'Laura', 'Elisa', 'Julieta', 'Olivia', 'Maite', 'Carolina', 'Bárbara', 'Gabriela', 'Montserrat', 'Violeta', 'Ana', 'Lucía', 'Inés', 'Clara', 'Rosario', 'Teresa', 'Alma', 'Victoria'],
};

/** Trainer classes that are women though their key doesn't end in _f. */
export const FEMALE_CLASSES = ['parasol_lady', 'jacinthe_holo', 'hex_maniac', 'aroma_lady', 'beauty', 'beauty_2', 'fairy_tale_girl', 'baker', 'maid', 'vicky', 'vivi', 'lass', 'picnicker', 'battle_girl', 'lady', 'socialite', 'nurse', 'kimono_girl', 'idol', 'cowgirl', 'madame'];
/** Classes of two trainers, by who they are: two men, two women, or a man and a woman. */
export const PAIR_CLASSES = { twins: 'ff', mysterious_sisters: 'ff', young_couple: 'mf', hooligans: 'mm', interviewers: 'mf', sis_and_bro: 'fm' };
/** Classes that are one character with a name of their own. */
export const NAMED_CLASSES = { jacinthe_holo: 'Jacinthe', vicky: 'Vicky', vito: 'Vito', vivi: 'Vivi', nate: 'Nate', rosa: 'Rosa', victor: 'Victor', victoria: 'Victoria', benga: 'Benga' };

// Lines are [when it sees you, when it loses]. "{o}" agrees with who says it: "cansado" or "cansada".

/** What a trainer says by the type of its theme: a few of each, so a climb rarely hears one twice. */
export const TYPE_LINES = {
  normal: [['¡Nada de trucos raros! Un buen combate y ya.', 'Bien jugado. Sin trucos y aun así me ganaste.'], ['Mis Pokémon no tienen nada especial… salvo que no se rinden.', 'Ok, ok. Lo especial lo tenían los tuyos.'], ['¿Una pelea rápida antes de seguir? ¡Vamos!', 'Rápida fue, sí… para ti.']],
  fire: [['¡Siente el calor! Mis Pokémon no se apagan fácil.', 'Me quemé solit{o}… Tus Pokémon arden más.'], ['¿Hace calor o soy yo? Spoiler: soy yo.', 'Me apagaste como fósforo mojado.'], ['Entreno junto al volcán todas las mañanas. ¡Prepárate!', 'Volveré al volcán a templarme de nuevo.']],
  water: [['¡Acabo de salir del agua y ya me quiero tirar de nuevo! Pero primero, tú.', 'Me ganaste… Volveré a nadar contra la corriente.'], ['La marea está a mi favor hoy. ¡Siente la ola!', 'La marea cambió… y me arrastró.'], ['El agua siempre encuentra su camino. ¿Y tú?', 'Encontraste el camino… por encima mío.']],
  grass: [['Mis Pokémon crecieron al sol de esta ruta. ¡Mira cómo pelean!', 'Hasta la mejor planta necesita más riego.'], ['Shh… no pises las flores. Bueno, sí, pelea conmigo.', 'Me dejaste marchit{o}.'], ['La naturaleza tiene paciencia. Yo no tanta: ¡a pelear!', 'Volveré a echar raíces y a crecer.']],
  electric: [['¡Vengo cargad{o} al máximo! ¿Aguantas la descarga?', 'Se me fueron las pilas…'], ['¡Bzzt! Hasta el pelo se me para de la emoción.', 'Cortocircuito total. Bien jugado.'], ['¿Sientes el cosquilleo? Es miedo… o estática.', 'Tus Pokémon tienen mejor conexión que los míos.']],
  ice: [['Aquí el frío templa a cualquiera. ¿Vienes abrigad{o}?', 'Me congelé en el peor momento… Bien jugado.'], ['Mis Pokémon nacieron en la nieve. ¡No les temen a nada!', 'Me dejaste más fri{o} que un témpano.'], ['Un consejo: no resbales. Otro: no pierdas.', 'Resbalé yo. Qué vergüenza.']],
  fighting: [['¡Hai! Mis puños y mis Pokémon entrenan juntos cada mañana.', '¡Osu! Fue una pelea limpia.'], ['¡Cien flexiones antes del desayuno! ¿Y tú cuántas?', 'Me faltaron flexiones, se nota.'], ['Una pelea honesta vale más que mil palabras. ¡En guardia!', 'Tu espíritu es fuerte. Me inclino ante ti.']],
  poison: [['Un poquito de veneno nunca le hizo mal a nadie… a mí.', 'Me salió el tiro por la culata.'], ['¿Sientes ese olorcito? Mis Pokémon ya empezaron.', 'Qué mal… me envenené con mi propia estrategia.'], ['Lo lento también mata. ¡Paciencia y veneno!', 'Fuiste más rápid{o} que mi veneno.']],
  ground: [['¡Estas tierras me han visto pelear mil veces!', 'Me tragó la tierra…'], ['Pisa firme, que aquí el suelo tiembla.', 'Temblé yo, no el suelo.'], ['Cavé un hoyo para esperarte. ¡Literal!', 'Y caí en mi propio hoyo.']],
  flying: [['¡Desde arriba se ve todo! Hasta tus errores.', 'Me cortaste las alas.'], ['Mis pájaros vuelan alto. ¿Tus Pokémon miran hacia arriba?', 'Aterrizaje forzoso…'], ['El viento sopla a mi favor. ¡Despegamos!', 'El viento cambió de dirección. Qué le vamos a hacer.']],
  psychic: [['Ya sabía que vendrías… y que perderías.', 'Mis visiones… se equivocaron.'], ['Estoy leyendo tu mente. Mmm… ¿en serio piensas en comida?', 'No vi venir eso. Y eso que veo todo.'], ['Cierra los ojos. Respira. Ahora pierde.', 'Mi concentración se quebró. Fuiste más fuerte.']],
  bug: [['¡Mira lo que atrapé hoy! Bueno, ahora mira cómo pelea.', '¡Mis bichos necesitan más sol!'], ['¡No subestimes a un bicho! Son más de lo que parecen.', 'Igual son los mejores bichos del mundo.'], ['Llevo toda la mañana en el pasto alto. ¡Estoy list{o}!', 'Vuelvo al pasto alto a buscar refuerzos.']],
  rock: [['¡Estas cuevas templan a cualquiera! A ver si tus Pokémon aguantan el peso.', '¡Uf! Tus Pokémon pisan más firme que estas rocas.'], ['Duro como piedra, ese es mi lema.', 'Hasta las piedras se rompen, parece.'], ['Encontré un fósil esta mañana. Hoy es mi día de suerte.', 'O no tanto…']],
  ghost: [['Shhh… ¿Escuchas eso? Algo te está siguiendo.', 'Los espíritus se fueron contigo…'], ['Je, je, je… ¿te dio frío de repente?', 'Hasta los fantasmas saben cuándo retirarse.'], ['Dicen que en esta ruta nadie pelea de noche. Yo sí.', 'Me voy a penar a otra parte…']],
  dragon: [['Los dragones no se rinden. Yo tampoco.', 'Hoy el dragón fuiste tú.'], ['Para domar un dragón hay que tener coraje. ¿Lo tienes?', 'Tienes coraje de sobra, se nota.'], ['¡Rugido de dragón! Bueno, el mío, pero igual asusta.', 'Mi rugido quedó en susurro.']],
  dark: [['¿Perdid{o}? Esta ruta no perdona a los novatos.', 'Está bien, está bien… pasa.'], ['No me mires así. Yo solo vine a ganar.', 'Hoy no era mi noche.'], ['En la oscuridad se pelea sin reglas. ¿Te atreves?', 'Sin reglas y aun así perdí…']],
  steel: [['Mis Pokémon están hechos para durar. ¿Y los tuyos?', 'Se me oxidó la estrategia.'], ['Acero pulido, estrategia afilada. ¡Vamos!', 'Me abollaste el orgullo.'], ['Ni un rasguño les vas a hacer. Bueno, intenta.', 'Varios rasguños. Muchos, en realidad.']],
  fairy: [['¡Qué lindos tus Pokémon! Los míos también… y pegan fuerte.', '¡Ay! Ni el encanto me salvó.'], ['Una pelea con brillos y todo. ¿Te animas?', 'Se me apagó el brillo…'], ['Lo tierno no quita lo valiente. ¡Te lo voy a demostrar!', 'Ok, me demostraste tú a mí.']],
};

/** Some classes have their own voice, used instead of their type's half of the time. */
export const CLASS_LINES = {
  hiker: [['¡Cada montaña tiene su cumbre, y yo las subí todas!', 'Me voy a descansar a la cumbre…'], ['Mis piernas aguantan cualquier cerro. ¿Y tus Pokémon?', 'Me ganaste en la subida.']],
  backpacker: [['Llevo meses viajando con mis Pokémon. ¡Somos un equipo!', 'Otra historia para mi diario de viaje.']],
  ruin_maniac: [['Estas ruinas guardan secretos… ¡y yo los voy a defender!', 'Las ruinas tendrán que esperar.']],
  worker: [['¡Casco puesto y manos a la obra! ¿Peleamos en mi descanso?', 'Se acabó la colación. A trabajar.']],
  scientist: [['Hipótesis: te voy a ganar. Comprobémoslo.', 'Hipótesis rechazada. Interesante…']],
  bird_keeper: [['Mis pájaros me avisaron que venías.', 'Vuelan alto, pero hoy aterrizaron.']],
  pilot: [['Pasajeros, abróchense los cinturones: viene turbulencia.', 'Aterrizaje de emergencia. Qué vergüenza.']],
  bug_catcher: [['¡Atrapé un bicho buenísimo! ¿Quieres verlo pelear?', '¡Mi red no atrapó la victoria!'], ['¡Cuidado con el pasto, que ahí viven mis amigos!', 'Me voy a buscar más bichos.']],
  fisherman: [['¡Picó uno grande! Ah, no, eras tú.', 'Se me cortó la caña…'], ['Paciencia, eso enseña la pesca. ¡Pero hoy no tengo!', 'Mejor vuelvo a pescar tranquilo.']],
  sailor: [['¡Ahoy! Ningún marinero le hace el quite a una pelea.', '¡Hombre al agua! O sea, yo.']],
  swimmer: [['¡Cien largos y todavía tengo energía para ti!', 'Me quedé sin aire…']],
  scuba_diver: [['Bajo el agua todo se ve distinto. Hasta mi estrategia.', 'Mejor vuelvo a las profundidades.']],
  parasol_lady: [['Que no me dé el sol, por favor. Peleemos rápido.', 'Ay, me insolé con tanta derrota.']],
  psychic: [['Tus cartas me dicen que vas a perder.', 'Las cartas… mintieron.']],
  hex_maniac: [['Je, je… preparé un hechizo solo para ti.', 'El hechizo rebotó. Típico.']],
  black_belt: [['¡Kiai! Mi cinturón negro no es de adorno.', 'Necesito otro cinturón… uno de humildad.']],
  biker: [['¡Brrrum! ¡Sal de mi camino o pelea!', 'Me quedé sin bencina…']],
  roughneck: [['¿Qué miras? ¿Quieres pelea? Ya, peleemos.', 'Ya, ya. No es para tanto.']],
  dragon_tamer: [['Domé dragones salvajes. Tú no eres tan difícil.', 'Eres más difícil que un dragón.']],
  guitarist: [['¡Esta pelea tiene banda sonora! ¡Uno, dos, tres!', 'Se me cortó una cuerda…']],
  beauty: [['Pelear con estilo es lo único que importa.', 'Perdí, pero con estilo.']],
  camper: [['¡Armé mi carpa aquí para esperar rivales como tú!', 'Desarmo la carpa y me voy.']],
  pokefan: [['¡Mis Pokémon son los más tiernos del mundo! Y los más fuertes.', 'Igual los quiero mucho.']],
  cyclist: [['¡No me bajo de la bici ni para pelear!', 'Se me salió la cadena.']],
  doctor: [['Tranquil{o}, después de la pelea reviso a tus Pokémon.', 'El paciente fui yo.']],
  officer: [['¡Alto ahí! Control de rutina: ¡muéstrame tus Pokémon!', 'Todo en orden. Puede circular.']],
  maid: [['Con permiso. Despejaré el camino… a mi manera.', 'Disculpe las molestias.']],
  waiter: [['¿Qué va a pedir? Le recomiendo una derrota bien servida.', 'La cuenta la pago yo, parece.']],
  clerk: [['Salí de la oficina a respirar. ¡Y a pelear!', 'Vuelvo a mi escritorio…']],
  baker: [['¡Recién salida del horno, como mis Pokémon!', 'Se me quemó el pan.']],
  artist: [['Cada pelea es una obra de arte. Esta será mi mejor cuadro.', 'Un cuadro triste, pero honesto.']],
  musician: [['¡Toco una melodía para cada ataque!', 'Desafiné justo al final.']],
  dancer: [['¡Pelear es como bailar! Sigue mi ritmo.', 'Perdí el ritmo…']],
  janitor: [['Termino de barrer y te barro a ti.', 'Me barriste tú.']],
  firebreather: [['¡Fuaaa! ¡Mira mis llamas!', 'Me quemé la lengua.']],
  snow_ace_trainer: [['Entreno donde nadie más se atreve. Por eso gano.', 'Me derretiste.']],
  depot_agent: [['¡Próxima estación: tu derrota!', 'Me pasé de estación.']],
  halloween_rival: [['¡Dulce o pelea! Bueno, pelea.', 'Me quedé sin dulces y sin pelea.']],
  fairy_tale_girl: [['Había una vez una pelea que gané. ¡Esta!', 'Este cuento no terminó como quería.']],
  aroma_lady: [['Huele a victoria. La mía, claro.', 'Ahora huele a derrota…']],
  backers: [['¡Ra, ra, ra! ¡A pelear con alegría!', '¡Igual aplaudo tu pelea!']],
  unknown: [['Estoy investigando a los entrenadores fuertes. Empiezo contigo.', 'Datos registrados. Eres fuerte.']],
  harlequin: [['¡Pasen y vean! ¡El show de la pelea!', 'Se cayó el telón…']],
  striker: [['¡Gol de media cancha, así gano yo!', 'Penal en contra…']],
  hoopster: [['¡Encesto todos mis ataques!', 'Me bloqueaste el tiro.']],
  smasher: [['¡Saque directo! ¿Lo devuelves?', 'Doble falta…']],
  ace_trainer: [['Entreno todos los días para subir esta torre. No me vas a frenar.', 'Necesito entrenar más…'], ['Un Entrenador Guay no pierde dos veces. ¡Esta es la primera!', 'Bueno, esta fue la primera.']],
  veteran: [['He visto mil batallas. Muéstrame si la tuya vale la pena.', 'Hace años que nadie me ganaba así.'], ['La experiencia gana a la juventud. ¿O no?', 'Me jubilo… otra vez.']],
  rival: [['¡Por fin te alcanzo! Esta vez gano yo.', '¡¿Otra vez?! Ya verás en el próximo piso.'], ['Mi equipo creció tanto como el tuyo. ¡Vamos!', 'Sigues un paso adelante…']],
  player: [['Yo también vengo subiendo. Veamos quién llega más alto.', 'Te dejo pasar… por ahora.']],
  youngster: [['¡Mis Pokémon son los mejores! ¡Te lo voy a demostrar!', '¡No es justo! ¡Me faltaba un turno!'], ['¿Tú también subes la torre? ¡Pelea conmigo!', 'Voy a ir a contarle a mi mamá…']],
  school_kid: [['¡Estudié todas las tablas de tipos! ¡Examen sorpresa!', 'Me faltó estudiar un capítulo…']],
  preschooler: [['¡Mira mi Pokémon! ¡Es el más lindo!', '¡Buaaa! ¡Pero igual es el más lindo!']],
  breeder: [['Cada uno de mis Pokémon salió de un huevo que cuidé yo.', 'Les voy a dar una baya a todos.']],
  expert_pokemon_breeder: [['Crié a estos Pokémon con IVs perfectos. Bueno, casi.', 'Tendré que cruzar otra generación.']],
  nursery_aide: [['¡Estos pequeños se portan muy bien conmigo!', '¡Tranquilos, a la siesta todos!']],
  ranger: [['Protejo esta zona y a sus Pokémon. Demuéstrame que eres de confianza.', 'Pasa, se nota que los cuidas.']],
};

/** Two trainers who fight together speak as one. */
export const PAIR_LINES = [
  ['¡Somos dos y peleamos como uno! ¿Te la puedes?', 'Ni de a dos pudimos…'],
  ['¡Hey, mira! Alguien que quiere pelear con nosotros.', 'Bueno… al menos perdimos juntos.'],
  ['Practicamos esta combinación toda la semana. ¡Mírala!', 'Hay que practicarla otra semana más.'],
];

/** What a rival says on a tough way (it trained for this) or a calm one (it's in no hurry). */
export const ROOM_LINES = {
  tough: [['Si viniste por aquí es porque buscas un desafío. Te lo daré.', 'Pocos me ganan en este camino. Te felicito.'], ['Entrené todo el día para alguien como tú.', 'Tendré que entrenar toda la noche.'], ['¿Seguro que querías venir por aquí? No hay vuelta atrás.', 'Ok, sí estabas segur{o}.']],
  calm: [['Ah, hola. ¿Una pelea tranquila? Sin apuro.', 'Fue una buena pelea. Sigue con calma.'], ['Vine a mirar el paisaje, pero una pelea no me viene mal.', 'Bueno, vuelvo al paisaje.'], ['Uy, recién estoy empezando con mis Pokémon. ¡Tenme paciencia!', 'Me falta harto, ya sé.']],
};

/** Each villain team's grunts, by the start of their key. */
export const VILLAIN_LINES = {
  rocket: [['¡Team Rocket en acción! Entrega tus Pokémon y nadie sale herido.', '¡El Team Rocket despega de nuevo!']],
  aqua: [['¡El Team Aqua va a expandir los mares! Y tú estás en medio.', '¡Me hundiste!']],
  magma: [['¡El Team Magma necesita más tierra firme! Fuera de aquí.', '¡Me derretí!']],
  galactic: [['El Team Galaxia creará un universo nuevo. Sin ti, claro.', 'Esto no estaba en el plan del jefe…']],
  plasma: [['¡Libera a tus Pokémon! Dámelos a mí, digo, al Team Plasma.', 'Mis Pokémon no se quieren liberar de mí…']],
  flare: [['El Team Flare solo quiere un mundo bello. Tú no estás invitad{o}.', 'Qué feo perder así.']],
  skull: [['¡Yo, yo! ¡El Team Skull no se mueve de aquí, yo!', '¡Yo… perdí, yo!']],
  aether: [['La Fundación Æther protege a los Pokémon. De ti también.', 'Tendré que redactar un informe…']],
  macro: [['Macro Cosmos agradece su visita. Ahora, retírese.', 'Esto afectará mi evaluación de desempeño.']],
  star: [['¡El Team Star manda en este camino! ¡Pórtate bien y pierde!', '¡Ya, ya! Pasa, pero no le digas al jefe.']],
};

/** Bosses with a voice of their own: [when it sees you, when it loses]. */
export const BOSS_LINES = {
  brock: ['Mi voluntad es tan dura como la roca. ¡Adelante!', 'Tu determinación es admirable.'],
  misty: ['¡Mi estrategia es el ataque total con Pokémon de agua!', 'Vaya, sí que eres fuerte.'],
  lt_surge: ['¡Hey, recluta! Los Pokémon eléctricos me salvaron en la guerra. ¡Te van a electrocutar!', '¡Sorprendente! Tienes agallas, recluta.'],
  erika: ['Ah… disculpa, me quedé dormida con este sol. ¿Una pelea? Con gusto.', 'Perdí… Tus Pokémon son espléndidos.'],
  koga: ['¡Fua, ja, ja! Un ninja no pelea con fuerza: pelea con astucia.', '¡Has demostrado tu valía!'],
  sabrina: ['Supe que vendrías. Lo vi hace tres días.', 'Esta derrota… no la vi venir.'],
  blaine: ['¡Ja! ¡Espero que hayas traído Antiquemar!', 'Me consumí por completo.'],
  giovanni: ['Así que tú eres quien se mete en mis asuntos. Te enseñaré lo que es el poder.', 'Hoy me retiro. Pero el Team Rocket no desaparece.'],
  rocket_boss_giovanni_1: ['Así que tú eres quien se mete en mis asuntos. Te enseñaré lo que es el poder.', 'Hoy me retiro. Pero el Team Rocket no desaparece.'],
  lorelei: ['Nadie domina el hielo como yo. Te congelaré.', 'No está mal… nada mal.'],
  bruno: ['¡Mis músculos y mis Pokémon son puro entrenamiento!', '¿Cómo? Perdí…'],
  agatha: ['Je, je. Los Pokémon son para pelear, no para mimar.', 'Me dejaste con la boca abierta, criatura.'],
  lance: ['Los dragones son criaturas místicas. ¡Prepárate!', 'Tú y tus Pokémon tienen algo especial.'],
  blue: ['¡Por fin llegas! Te estuve esperando todo este tiempo.', '¿Qué? ¡No puede ser! ¡Elegí a los mejores Pokémon!'],
  red: ['…', '…!'],
  falkner: ['¡Los Pokémon pájaro no son débiles! Te lo voy a demostrar.', 'Tú… me cortaste las alas.'],
  bugsy: ['¡Soy el que más sabe de Pokémon bicho! Investigo todo.', 'Tengo mucho que investigar todavía.'],
  whitney: ['¡Todos dicen que mi Miltank es imparable! ¿Tú qué crees?', '¡Bua! ¡No es justo…! Bueno, ya, te lo ganaste.'],
  morty: ['Veo cosas que otros no ven. Y veo que vas a perder.', 'No lo vi… Mi entrenamiento no termina.'],
  chuck: ['¡GUAAAH! ¡Te ganaré con mi entrenamiento!', '¡Ay! Me dolió más que la cascada.'],
  jasmine: ['Eh… Hola. Mis Pokémon de acero son… bastante duros.', 'Eres muy fuerte… y amable con tus Pokémon.'],
  pryce: ['El hielo lleva siglos en estas tierras. Igual que mi paciencia.', 'Me impresionas. El hielo se derrite.'],
  clair: ['Soy la mejor domadora de dragones del mundo. ¡No lo olvides!', 'Perdí… No me lo puedo creer.'],
  roxanne: ['Estudié todas las estrategias del libro. ¡Pongámoslas a prueba!', 'Tengo mucho que aprender fuera del libro.'],
  brawly: ['¡Ola grande, pelea grande! ¡Vamos!', 'Me revolcó la ola.'],
  wattson: ['¡Wahahaha! ¡Me encantan los desafíos!', '¡Wahahaha! ¡Me dejaste sin carga!'],
  flannery: ['¡Mis Pokémon de fuego van a derretir todo! Eh… creo.', 'Ah… me pasé de entusiasta.'],
  norman: ['Mi hijo me habló de ti. Ahora veamos qué tan fuerte eres.', 'Peleaste con todo. Lo respeto.'],
  winona: ['Vuelo con mis Pokémon pájaro desde niña. ¡Despeguemos!', 'Nunca vi a alguien volar así.'],
  tate: ['¡Liza y yo pensamos igual! Bueno, hoy peleo yo.', 'Me faltó mi hermana…'],
  liza: ['¡Tate y yo somos uno! Hoy me toca a mí.', 'Sin Tate no es lo mismo…'],
  juan: ['Ah, la elegancia del agua. Bailemos esta pelea.', 'Qué elegancia la tuya. Bravo.'],
  wallace: ['Una pelea debe ser bella como el agua. Muéstrame tu arte.', 'Tu equipo brilla. Qué belleza.'],
  steven: ['Me fascinan las piedras raras… y los entrenadores raros. Veamos de qué estás hecho.', 'Eres una piedra preciosa, sin duda.'],
  sidney: ['Me gusta esa mirada. Hagamos esto entretenido.', 'Bien jugado. Sigue así.'],
  phoebe: ['Los espíritus de la montaña me acompañan.', 'Tu lazo con tus Pokémon es más fuerte que los espíritus.'],
  glacia: ['Vine de muy lejos buscando a alguien que me haga sentir calor.', 'Vaya… sentí un poco de calor.'],
  drake: ['¿Sabes lo que un entrenador necesita para pelear con dragones?', 'Sí lo sabes. Bien hecho.'],
  roark: ['Mis Pokémon de tipo Roca se forjaron en la mina. ¡Muéstrame si los tuyos son de buena piedra!', 'En la mina aprendí a reconocer una buena piedra, y tu equipo tiene temple.'],
  gardenia: ['¡Mis Pokémon planta están en su mejor momento! ¿Lista la pelea?', 'Ay… mis plantitas necesitan sol.'],
  maylene: ['Entreno descalza para sentir la tierra. ¡Vamos!', 'Necesito entrenar más. Mucho más.'],
  crasher_wake: ['¡La Ola Gigante ha llegado! ¡Prepárate para el chapuzón!', '¡Me revolcaste!'],
  fantina: ['Ah, ¿una pelea? ¡Me encantan! Mis fantasmas también.', 'Ah… très bien.'],
  byron: ['¡Ja, ja, ja! Mis Pokémon de acero no se doblan.', 'Se doblaron, parece.'],
  candice: ['¡Concentración total! En la nieve se ve quién tiene garra.', '¡Esa concentración sí que la tienes!'],
  volkner: ['Estaba aburrido. Espero que tú me despiertes.', 'Gracias. Me recordaste por qué peleo.'],
  aaron: ['Los Pokémon bicho son bellos y fuertes. ¡Te lo demostraré!', 'Tengo que entrenar más a mis bichos.'],
  bertha: ['Ay, mijo, no te pongas nervioso. Peleemos tranquilos.', 'Qué fuerte vienes, ¿eh?'],
  flint: ['¡Mi pasión arde! ¿Y la tuya?', 'Tu fuego ardió más.'],
  lucian: ['Estaba leyendo. Espero que esta pelea sea igual de interesante.', 'Un capítulo memorable.'],
  cynthia: ['Hay algo en cómo te miran tus Pokémon. Quiero verlo de cerca.', 'Hacía tiempo que no sentía algo así en una pelea. Tus Pokémon confían en ti; cuídalo.'],
  cilan: ['Permíteme servirte una pelea de primera calidad.', 'Un sabor inesperado. Delicioso.'],
  chili: ['¡Mis Pokémon de fuego están que arden!', '¡Me apagaste!'],
  cress: ['El agua refleja todo. Incluso tu derrota.', 'El reflejo se movió.'],
  lenora: ['Investigar es mi pasión. Veamos qué descubro de ti.', 'Descubrí que eres muy fuerte.'],
  burgh: ['¡Mis Pokémon son mi inspiración! Pintemos esta pelea.', 'Una obra maestra… tuya.'],
  elesa: ['Prepárate para una pelea que te deslumbre.', 'Me deslumbraste tú.'],
  clay: ['¡Ja! Mis Pokémon salen de la mina listos para todo.', 'Me ganaste limpio. Respeto.'],
  skyla: ['¡Despeguemos! Mis Pokémon y yo surcamos el cielo.', '¡Qué vuelo el tuyo!'],
  brycen: ['El frío forja el carácter. Veamos el tuyo.', 'Tu carácter es firme.'],
  drayden: ['Un dragón pelea con el corazón. ¿Y tú?', 'Tu corazón es fuerte.'],
  iris: ['¡Mis dragones y yo vamos con todo! ¿List{o}?', '¡Uf! ¡Eres demasiado fuerte!'],
  roxie: ['¡Sube el volumen! ¡Esta pelea va a ser un concierto!', '¡Qué tocata! Me ganaste.'],
  marlon: ['¡Las olas me traen buena onda! Peleemos.', 'Me dejaste sin onda.'],
  alder: ['Pelear es disfrutar con tus Pokémon. ¡Disfrutemos!', 'Qué bien lo pasé. Gracias.'],
  viola: ['¡Click! Quiero una foto de tu cara cuando pierdas.', 'La foto salió movida…'],
  grant: ['Escalar es superar obstáculos. Tú eres mi obstáculo.', 'Me superaste.'],
  korrina: ['¡Patines puestos y puños listos! ¡Vamos!', '¡Uf! Me caí de los patines.'],
  ramos: ['Ja, ja. Este viejo jardinero aún tiene fuerza.', 'Creciste más rápido que mis plantas.'],
  clemont: ['¡Mi nuevo invento calculó que voy a ganar!', 'Necesito ajustar el invento…'],
  valerie: ['Como una mariposa… mi pelea será suave y fatal.', 'Qué elegancia la tuya.'],
  olympia: ['Las estrellas dicen que esta pelea será inolvidable.', 'Las estrellas tenían razón.'],
  wulfric: ['¡Ja, ja! ¡Hace frío aquí! ¡Calentémonos peleando!', 'Me calentaste de verdad.'],
  diantha: ['Una pelea es un escenario. ¿Brillamos juntos?', 'Qué actuación tan hermosa la tuya.'],
  hala: ['¡Mis Pokémon y yo somos fuertes como una montaña!', '¡Qué fuerza la tuya!'],
  olivia: ['Mis Pokémon son tan sólidos como las rocas de esta isla.', 'Me dejaste sin palabras.'],
  acerola: ['¡Je, je! ¿Te gustan los fantasmas? A mí me encantan.', 'Mis fantasmitas se asustaron.'],
  kahili: ['Juego al golf con la misma precisión con que peleo.', 'Hoyo en uno… para ti.'],
  kukui: ['¡Woo! ¡Me encanta ver entrenadores fuertes!', '¡Woo! ¡Qué movimientos!'],
  hau: ['¡Vamos con todo! ¡Pero primero un malasada!', '¡Uf, qué buena pelea! ¿Vamos por malasadas?'],
  milo: ['Eh… hola. Mis Pokémon planta están felices. ¿Peleamos?', 'Me ganaste limpiamente.'],
  nessa: ['Sobre el agua o sobre la pasarela, siempre gano.', 'Hoy no fue mi día.'],
  kabu: ['Llevo años entrenando. El fuego no se apaga.', 'Tu fuego es más intenso.'],
  bea: ['Mis puños son tan duros como mi voluntad.', 'Volveré a entrenar.'],
  allister: ['…Hola. Mis fantasmas… quieren jugar.', '…Bien jugado.'],
  opal: ['Te haré una pregunta: ¿cuál es mi color favorito?', 'Rosado, querid{o}. Pero ganaste igual.'],
  gordie: ['Mis Pokémon de roca son puro estilo.', 'Me quitaste el estilo.'],
  melony: ['Ven, querid{o}. El frío no muerde… mucho.', 'Ay, qué bien lo hiciste.'],
  piers: ['Esta pelea será mi nueva canción.', 'Una canción triste… para mí.'],
  raihan: ['¡Selfie antes de la pelea! Ahora sí, a ganar.', 'Esta foto no la voy a subir.'],
  leon: ['¡Hagamos de esta pelea un campeonato inolvidable!', '¡Qué combate! Esto merece una foto.'],
  katy: ['¡Hola! Te preparé unos dulces. Después de la pelea, eso sí.', '¡Me ganaste! Igual te doy los dulces.'],
  brassius: ['¡El arte es explosión! ¡Esta pelea será mi obra!', 'Mi obra quedó inconclusa.'],
  iono: ['¡Hola, hola, electrofans! ¡Hoy transmitimos en vivo tu derrota!', '¡Corten, corten! Bueno… ¡igual fue un éxito de audiencia!'],
  kofu: ['¡Fresco como el pescado del mercado! ¡A pelear!', 'Me dejaste fuera de temporada.'],
  ryme: ['¡Yo, yo! ¡Mis rimas pegan fuerte!', 'Me quedé sin rima.'],
  tulip: ['La belleza tiene muchas formas. Te mostraré la mía.', 'Qué belleza la tuya.'],
  grusha: ['Me enfrío antes de pelear. ¿Y tú?', 'Me derretiste un poco.'],
  larry: ['Trabajé todo el día. Peleemos rápido, ¿ya?', 'Bueno, me voy a casa.'],
  rika: ['Uy, ¿te pusiste nervios{o}? Tranqui, peleemos.', 'Me dejaste sin preguntas.'],
  poppy: ['¡Hola! ¡Soy chiquita pero peleo grande!', '¡Bua! ¡Eres muy fuerte!'],
  hassel: ['El arte de pelear con dragones requiere pasión.', 'Qué obra de arte tu pelea.'],
  geeta: ['Como presidenta de la liga, voy a medirte con justicia.', 'Has demostrado tu valía. Sigue así.'],
  nemona: ['¡Por fin un rival que vale la pena! ¡Peleemos!', '¡Qué buena pelea! Volvamos a hacerlo pronto.'],
  kieran: ['Esta vez no voy a perder. Esta vez soy más fuerte.', '¿Por qué… por qué sigo perdiendo?'],
  archie: ['¡El Team Aqua hará crecer los mares! ¡Fuera de mi camino!', 'Tal vez… los mares ya son lo bastante grandes.'],
  maxie: ['El Team Magma ampliará la tierra para todos. No me detendrás.', 'Tal vez me equivoqué…'],
  cyrus: ['Las emociones son debilidad. Te lo demostraré.', 'Imposible… ¿emociones?'],
  ghetsis: ['¡Los Pokémon son herramientas! ¡Y tú eres un estorbo!', '¡No… mis planes!'],
  lysandre: ['El mundo será bello. Aunque tenga que destruirlo.', 'Así que este es el futuro que eliges.'],
  guzma: ['¡Guzma es el que destruye todo! ¡Hasta a ti!', '¡Ahhh! ¡Otra vez!'],
  lusamine: ['Mis criaturas hermosas… nadie me las quitará.', 'No… mi belleza…'],
  rose: ['Por el futuro de Galar, no puedo perder.', 'El futuro… es de ustedes, parece.'],
  archer: ['El Team Rocket volverá a su gloria. Empezando por ti.', 'Volveremos. Siempre volvemos.'],
  courtney: ['…Análisis completo. Vas a perder.', '…Error de cálculo.'],
  mars: ['¡El Team Galaxia tiene grandes planes! Y tú no estás en ellos.', '¡Qué rabia!'],
  plumeria: ['Si te metes con mis chiquillos, te metes conmigo.', 'Ok, me rindo. Eres fuerte.'],
};

export const PROFESSOR_LINES = {
  hello: 'Así que tú vas a subir la torre. Revisé tu colección y aparté a los que mejor se ven para empezar. Llévate tres… y recuerda: un Pokémon crece al ritmo de quien lo acompaña.',
  picked: 'Buena elección. Ese tiene más de lo que muestra. ¡Anda, la torre te espera!',
  twist: 'Por cierto, me llegó un rumor sobre esta subida:',
};

export const RECRUIT_LINE = 'Tus Pokémon tienen buen temple. Elige a uno de estos de tu colección para lo que viene.';

/** Who you meet on a floor with no battle, and what they say. Each one has a few lines. */
export const STOP_PEOPLE = {
  rest: { speaker: 'Enfermera de la ruta', lines: ['Tus Pokémon se ven cansados. Déjamelos un rato… ¡Listo! Toma, también encontré esto para ti.', 'Bienvenid{o} a la parada. Descansa, que lo que viene es más difícil.', '¡Qué equipo tan bonito! Tengo un par de cosas que te pueden servir.'] },
  den: { speaker: 'Criadora', lines: ['Aquí se esconden Pokémon de tu colección que quieren acompañarte.', 'Shh… si te acercas despacio, alguno se va a querer unir.', 'Estos se escaparon de la guardería buscando aventura. ¿Te llevas uno?'] },
  deal: { speaker: 'Figura en la sombra', lines: ['Je… Tengo algo que te interesa. Pero todo tiene un precio.', 'Nadie sube esta torre sin sacrificar algo. ¿Qué me ofreces?', 'Dos tesoros por uno de los tuyos. Un trato justo, ¿no crees?'] },
};

/**
 * What can be different in a climb: each one draws one of these rumours at the start. It changes
 * which ways appear, the rewards and the points, so two climbs don't play the same.
 */
export const TWISTS = {
  night: { name: 'Noche cerrada', icon: 'planet', text: 'La torre está de noche: todas las rutas se ven oscuras y las guaridas villanas aparecen el doble.' },
  market: { name: 'Feria ambulante', icon: 'heart', text: 'Hay más paradas en el camino y cada descanso ofrece un premio más para elegir.' },
  wild: { name: 'Rutas salvajes', icon: 'skull', text: 'En cada piso hay una ruta difícil y todos los puntos valen 20 % más.' },
  tutors: { name: 'Temporada de tutores', icon: 'dex', text: 'Las MT y los tutores de movimientos aparecen mucho más entre los premios.' },
  sweet: { name: 'Caramelos de sobra', icon: 'sparkle', text: 'Los caramelos aparecen más seguido y suben un nivel más.' },
  migration: { name: 'Migración', icon: 'ball', text: 'Más madrigueras en el camino: más oportunidades de sumar Pokémon de tu colección.' },
  caps: { name: 'Mercado de chapas', icon: 'cap', text: 'Las Chapas, que llevan un IV al máximo, aparecen mucho más entre los premios.' },
};
export const TWIST_KEYS = Object.keys(TWISTS);

/**
 * Between two bosses you choose your way, like the adventure paths of Emerald Rogue: plain, tough or
 * calm trainers, a rest stop, a den to recruit, a villain hideout or a dark deal.
 */
export const ROOMS = {
  trainer: { label: 'Ruta', icon: 'swords', battle: true, hint: 'Un entrenador de la ruta.' },
  tough: { label: 'Ruta difícil', icon: 'skull', battle: true, hint: 'Rival entrenado y 2 niveles más. Premio raro o mejor.' },
  calm: { label: 'Ruta tranquila', icon: 'leaf', battle: true, hint: 'Rival más débil. Premio común.' },
  rest: { label: 'Parada', icon: 'heart', battle: false, hint: 'Sin pelea: dos premios a elegir.' },
  den: { label: 'Madriguera', icon: 'ball', battle: false, hint: 'Sin pelea: recluta uno de tu colección.' },
  hideout: { label: 'Guarida', icon: 'flag', battle: true, hint: 'Un recluta o jefe villano. Premio épico.' },
  deal: { label: 'Pacto oscuro', icon: 'diamond', battle: false, hint: 'Deja ir a uno de tu equipo a cambio de dos premios épicos.' },
};

/** The calm biome track that plays while you look at a floor of each scene (the battle has its own). */
const SCENE_MUSIC = { 'tall-grass': 'tall_grass', path: 'plains', lake: 'lake', beach: 'beach', mountain: 'mountain', desert: 'desert', cave: 'cave', snow: 'snowy_forest', ocean: 'sea', underwater: 'seabed' };
export const sceneMusic = (scene) => SCENE_MUSIC[String(scene).replace(/-(2|night)$/, '')] ?? 'town';
