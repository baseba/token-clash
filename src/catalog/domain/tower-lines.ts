export type Line = readonly [hello: string, lose: string, win: string];

export const TYPE_LINES: Readonly<Record<string, readonly Line[]>> = {
  normal: [
    ['¡Nada de trucos raros! Un buen combate y ya.', 'Bien jugado. Sin trucos y aun así me ganaste.', 'Sin trucos, ¿ves? A veces lo simple basta.'],
    ['Mis Pokémon no tienen nada especial… salvo que no se rinden.', 'Ok, ok. Lo especial lo tenían los tuyos.', 'Te dije que no se rendían.'],
    ['¿Una pelea rápida antes de seguir? ¡Vamos!', 'Rápida fue, sí… para ti.', 'Rápida, como te prometí.'],
    ['Lo básico bien hecho le gana a cualquiera. Te lo voy a mostrar.', 'Parece que tu básico estaba mejor hecho.', 'Lo básico bien hecho. Te lo advertí.'],
  ],
  fire: [
    ['¡Siente el calor! Mis Pokémon no se apagan fácil.', 'Me quemé solit{o}… Tus Pokémon arden más.', 'Te lo dije: no se apagan fácil.'],
    ['¿Hace calor o soy yo? Spoiler: soy yo.', 'Me apagaste como fósforo mojado.', 'Era yo, el calor. Siempre soy yo.'],
    ['Entreno junto al volcán todas las mañanas. ¡Prepárate!', 'Volveré al volcán a templarme de nuevo.', 'El volcán no perdona. Yo tampoco.'],
    ['Trae agua si quieres, igual te vas a quemar.', 'Trajiste agua. Y de la buena.', 'Te avisé que trajeras agua.'],
  ],
  water: [
    ['¡Acabo de salir del agua y ya me quiero tirar de nuevo! Pero primero, tú.', 'Me ganaste… Volveré a nadar contra la corriente.', 'Primero tú, después el agua. Listo, me tiro.'],
    ['La marea está a mi favor hoy. ¡Siente la ola!', 'La marea cambió… y me arrastró.', 'Te dije que la marea estaba a mi favor.'],
    ['El agua siempre encuentra su camino. ¿Y tú?', 'Encontraste el camino… por encima mío.', 'El agua encontró su camino. Tú, no tanto.'],
    ['¿Sabes nadar? Porque te vas a mojar.', 'El que terminó empapad{o} fui yo.', 'Te advertí que te ibas a mojar.'],
  ],
  grass: [
    ['Mis Pokémon crecieron al sol de esta ruta. ¡Mira cómo pelean!', 'Hasta la mejor planta necesita más riego.', 'Te dije que miraras cómo peleaban.'],
    ['Shh… no pises las flores. Bueno, sí, pelea conmigo.', 'Me dejaste marchit{o}.', 'Y no pisaste las flores. Bien educad{o}, pero perdiste.'],
    ['La naturaleza tiene paciencia. Yo no tanta: ¡a pelear!', 'Volveré a echar raíces y a crecer.', 'La paciencia de la naturaleza siempre gana.'],
    ['Cuidado, que este pasto tiene dueño.', 'El pasto ahora es tuyo, parece.', 'Te dije que el pasto tenía dueño.'],
  ],
  electric: [
    ['¡Vengo cargad{o} al máximo! ¿Aguantas la descarga?', 'Se me fueron las pilas…', 'No aguantaste la descarga. Te avisé.'],
    ['¡Bzzt! Hasta el pelo se me para de la emoción.', 'Cortocircuito total. Bien jugado.', '¡Bzzt! Todavía me queda carga de sobra.'],
    ['¿Sientes el cosquilleo? Es miedo… o estática.', 'Tus Pokémon tienen mejor conexión que los míos.', 'Era miedo. Te lo dije.'],
    ['Mis Pokémon son más rápidos que un rayo. Literal.', 'Tú fuiste el rayo.', 'Ni lo viste venir, ¿cierto?'],
  ],
  ice: [
    ['Aquí el frío templa a cualquiera. ¿Vienes abrigad{o}?', 'Me congelé en el peor momento… Bien jugado.', 'Te faltó abrigo. Se notó.'],
    ['Mis Pokémon nacieron en la nieve. ¡No les temen a nada!', 'Me dejaste más fri{o} que un témpano.', 'Te dije que no le temían a nada.'],
    ['Un consejo: no resbales. Otro: no pierdas.', 'Resbalé yo. Qué vergüenza.', 'Resbalaste. Y perdiste. Seguiste mal mis consejos.'],
    ['¿Sientes esa brisa? Es el comienzo de tu derrota.', 'La brisa cambió de dirección.', 'Te lo dije: era el comienzo.'],
  ],
  fighting: [
    ['¡Hai! Mis puños y mis Pokémon entrenan juntos cada mañana.', '¡Osu! Fue una pelea limpia.', '¡Osu! Cada mañana de entrenamiento valió la pena.'],
    ['¡Cien flexiones antes del desayuno! ¿Y tú cuántas?', 'Me faltaron flexiones, se nota.', 'Te faltaron flexiones. Mañana empieza a las seis.'],
    ['Una pelea honesta vale más que mil palabras. ¡En guardia!', 'Tu espíritu es fuerte. Me inclino ante ti.', 'Fue honesta, y la gané. Sigue entrenando.'],
    ['El dolor es temporal. La victoria, para siempre.', 'Ok, el dolor sí es temporal. Pero duele.', 'Para siempre, como te dije.'],
  ],
  poison: [
    ['Un poquito de veneno nunca le hizo mal a nadie… a mí.', 'Me salió el tiro por la culata.', 'A mí no me hizo mal. A ti, harto.'],
    ['¿Sientes ese olorcito? Mis Pokémon ya empezaron.', 'Qué mal… me envenené con mi propia estrategia.', 'Te dije que ya habían empezado.'],
    ['Lo lento también mata. ¡Paciencia y veneno!', 'Fuiste más rápid{o} que mi veneno.', 'Lento, pero seguro. Te lo advertí.'],
    ['¿Antídotos? Ojalá hayas traído varios.', 'Al final el antídoto lo necesitaba yo.', 'No trajiste suficientes, ¿cierto?'],
  ],
  ground: [
    ['¡Estas tierras me han visto pelear mil veces!', 'Me tragó la tierra…', 'Mil y una. Y las gané todas.'],
    ['Pisa firme, que aquí el suelo tiembla.', 'Temblé yo, no el suelo.', 'Te dije que pisaras firme.'],
    ['Cavé un hoyo para esperarte. ¡Literal!', 'Y caí en mi propio hoyo.', 'El hoyo funcionó. Te lo dije.'],
    ['Mis Pokémon tienen los pies en la tierra. ¿Y los tuyos?', 'Los tuyos tenían los pies mejor puestos.', 'Los tuyos andaban en las nubes.'],
  ],
  flying: [
    ['¡Desde arriba se ve todo! Hasta tus errores.', 'Me cortaste las alas.', 'Desde arriba vi cada uno de tus errores.'],
    ['Mis pájaros vuelan alto. ¿Tus Pokémon miran hacia arriba?', 'Aterrizaje forzoso…', 'No miraron hacia arriba. Te avisé.'],
    ['El viento sopla a mi favor. ¡Despegamos!', 'El viento cambió de dirección. Qué le vamos a hacer.', 'El viento nunca miente.'],
    ['¿Ves esas plumas? Son lo último que vas a ver.', 'Lo último que vi fueron tus Pokémon.', 'Te dije que eran lo último.'],
  ],
  psychic: [
    ['Ya sabía que vendrías… y que perderías.', 'Mis visiones… se equivocaron.', 'Lo sabía. Lo vi venir desde el primer piso.'],
    ['Estoy leyendo tu mente. Mmm… ¿en serio piensas en comida?', 'No vi venir eso. Y eso que veo todo.', 'Pensabas en comida. Por eso perdiste.'],
    ['Cierra los ojos. Respira. Ahora pierde.', 'Mi concentración se quebró. Fuiste más fuerte.', 'Cerraste los ojos. Respiraste. Y perdiste.'],
    ['Tu próximo movimiento ya lo sé. Y el siguiente también.', 'Ese no lo sabía.', 'Te dije que ya los sabía todos.'],
  ],
  bug: [
    ['¡Mira lo que atrapé hoy! Bueno, ahora mira cómo pelea.', '¡Mis bichos necesitan más sol!', '¡Te dije que miraras cómo peleaba!'],
    ['¡No subestimes a un bicho! Son más de lo que parecen.', 'Igual son los mejores bichos del mundo.', 'Los subestimaste. Te lo advertí.'],
    ['Llevo toda la mañana en el pasto alto. ¡Estoy list{o}!', 'Vuelvo al pasto alto a buscar refuerzos.', 'Toda la mañana en el pasto alto. Valió la pena.'],
    ['Un bicho chico también pica fuerte.', 'Picó, pero no lo suficiente.', 'Pica fuerte, ¿cierto? Te lo dije.'],
  ],
  rock: [
    ['¡Estas cuevas templan a cualquiera! A ver si tus Pokémon aguantan el peso.', '¡Uf! Tus Pokémon pisan más firme que estas rocas.', 'No aguantaron el peso. Las cuevas no perdonan.'],
    ['Duro como piedra, ese es mi lema.', 'Hasta las piedras se rompen, parece.', 'Duro como piedra. Te lo dije.'],
    ['Encontré un fósil esta mañana. Hoy es mi día de suerte.', 'O no tanto…', 'Era mi día de suerte, de verdad.'],
    ['Las rocas no se apuran. Igual llegan.', 'Llegaste tú antes.', 'Llegué, como te dije.'],
  ],
  ghost: [
    ['Shhh… ¿Escuchas eso? Algo te está siguiendo.', 'Los espíritus se fueron contigo…', 'Te dije que algo te seguía. Y te alcanzó.'],
    ['Je, je, je… ¿te dio frío de repente?', 'Hasta los fantasmas saben cuándo retirarse.', 'Ese frío era tu derrota acercándose.'],
    ['Dicen que en esta ruta nadie pelea de noche. Yo sí.', 'Me voy a penar a otra parte…', 'Por algo nadie pelea de noche aquí.'],
    ['Mis Pokémon te estaban mirando desde que entraste.', 'Y tú los miraste de vuelta. Qué valiente.', 'Te miraban. Y te ganaron. Je, je.'],
  ],
  dragon: [
    ['Los dragones no se rinden. Yo tampoco.', 'Hoy el dragón fuiste tú.', 'Te dije que no nos rendíamos.'],
    ['Para domar un dragón hay que tener coraje. ¿Lo tienes?', 'Tienes coraje de sobra, se nota.', 'Te faltó coraje. Vuelve cuando lo tengas.'],
    ['¡Rugido de dragón! Bueno, el mío, pero igual asusta.', 'Mi rugido quedó en susurro.', 'Te asustaste, admítelo.'],
    ['Un dragón no pelea por pelear: pelea por orgullo.', 'Me dejaste sin orgullo.', 'Mi orgullo sigue intacto. El tuyo, no sé.'],
  ],
  dark: [
    ['¿Perdid{o}? Esta ruta no perdona a los novatos.', 'Está bien, está bien… pasa.', 'Te dije que no perdonaba a los novatos.'],
    ['No me mires así. Yo solo vine a ganar.', 'Hoy no era mi noche.', 'Vine a ganar, y gané. Así de simple.'],
    ['En la oscuridad se pelea sin reglas. ¿Te atreves?', 'Sin reglas y aun así perdí…', 'Sin reglas. Te avisé.'],
    ['Aquí nadie juega limpio. Yo menos.', 'Tú sí jugaste limpio. Y ganaste.', 'Nadie juega limpio aquí. Debiste escucharme.'],
  ],
  steel: [
    ['Mis Pokémon están hechos para durar. ¿Y los tuyos?', 'Se me oxidó la estrategia.', 'Durar, te dije. Los tuyos no duraron.'],
    ['Acero pulido, estrategia afilada. ¡Vamos!', 'Me abollaste el orgullo.', 'Afilada, como te dije.'],
    ['Ni un rasguño les vas a hacer. Bueno, intenta.', 'Varios rasguños. Muchos, en realidad.', 'Ni un rasguño. Te lo dije.'],
    ['El acero no se dobla. Se forja.', 'Me doblaste igual.', 'Forjado y sin una abolladura.'],
  ],
  fairy: [
    ['¡Qué lindos tus Pokémon! Los míos también… y pegan fuerte.', '¡Ay! Ni el encanto me salvó.', 'Te dije que pegaban fuerte.'],
    ['Una pelea con brillos y todo. ¿Te animas?', 'Se me apagó el brillo…', 'Brillos y victoria. Mi combinación favorita.'],
    ['Lo tierno no quita lo valiente. ¡Te lo voy a demostrar!', 'Ok, me demostraste tú a mí.', '¿Ves? Lo tierno no quita lo valiente.'],
    ['No te dejes engañar por el color rosado.', 'El rosado no bastó.', 'Te dejaste engañar por el rosado. Te avisé.'],
  ],
};

export const ROOM_LINES: Readonly<Record<'tough' | 'calm', readonly Line[]>> = {
  tough: [
    ['Si viniste por aquí es porque buscas un desafío. Te lo daré.', 'Pocos me ganan en este camino. Te felicito.', 'Buscabas un desafío. Lo encontraste.'],
    ['Entrené todo el día para alguien como tú.', 'Tendré que entrenar toda la noche.', 'Todo el día entrenando. Valió cada minuto.'],
    ['¿Seguro que querías venir por aquí? No hay vuelta atrás.', 'Ok, sí estabas segur{o}.', 'Te pregunté si querías venir por aquí.'],
    ['Este camino es para los que no le temen a nada.', 'No le temes a nada, se nota.', 'Le temías a algo, al final.'],
  ],
  calm: [
    ['Ah, hola. ¿Una pelea tranquila? Sin apuro.', 'Fue una buena pelea. Sigue con calma.', 'Con calma, sin apuro. Hasta para perder.'],
    ['Vine a mirar el paisaje, pero una pelea no me viene mal.', 'Bueno, vuelvo al paisaje.', 'El paisaje se ve mejor después de ganar.'],
    ['Uy, recién estoy empezando con mis Pokémon. ¡Tenme paciencia!', 'Me falta harto, ya sé.', '¡Uy! ¿Gané? ¡Gané! Perdón, es mi primera vez.'],
    ['Por aquí se viene a pasear. Pero si quieres pelear, peleemos.', 'Paseo terminado.', 'Viniste a pasear y te fuiste perdiendo.'],
  ],
};

export const PAIR_LINES: readonly Line[] = [
  ['¡Somos dos y peleamos como uno! ¿Te la puedes?', 'Ni de a dos pudimos…', 'No te la pudiste. Somos dos, al final.'],
  ['¡Hey, mira! Alguien que quiere pelear con nosotros.', 'Bueno… al menos perdimos juntos.', 'Querías pelear con nosotros. Mala idea.'],
  ['Practicamos esta combinación toda la semana. ¡Mírala!', 'Hay que practicarla otra semana más.', '¡Una semana entera! ¿Viste? Funcionó.'],
  ['Uno ataca, el otro cubre. ¿Lo ves venir?', 'No cubrimos lo suficiente.', 'No lo viste venir. Te dijimos.'],
];

const PLAYER_LINES: readonly Line[] = [
  ['Yo también vengo subiendo. Veamos quién llega más alto.', 'Te dejo pasar… por ahora.', 'Yo llego más alto, parece.'],
  ['¿Otro entrenador subiendo la torre? Esto se pone bueno.', 'Se puso bueno, sí. Para ti.', 'Bueno para mí. Nos vemos arriba… bueno, yo.'],
  ['Mis Pokémon y yo venimos de muy lejos para esto.', 'De lejos venimos, y de lejos nos devolvemos.', 'Valió la pena el viaje.'],
];

export const CLASS_LINES: Readonly<Record<string, readonly Line[]>> = {
  cyclist: [
    ['¡No me bajo de la bici ni para pelear!', 'Se me salió la cadena.', '¡Y ni me bajé de la bici!'],
    ['¡Cuidado, que voy sin frenos!', 'Ahora sí frené. Contra ti.', 'Te dije que iba sin frenos.'],
    ['¡Esta ruta es mi pista de entrenamiento!', 'Me pinchaste las ruedas.', 'Mi pista, mis reglas.'],
  ],
  ranger: [
    ['Protejo esta zona y a sus Pokémon. Demuéstrame que eres de confianza.', 'Pasa, se nota que los cuidas.', 'Todavía no confío en ti. Vuelve a intentarlo.'],
    ['Un Ranger conoce cada rincón de su zona.', 'No conocía este rincón: el de la derrota.', 'Conozco cada rincón. Incluido el de tu derrota.'],
    ['Mi deber es cuidar a los Pokémon. También en una pelea.', 'Los tuyos están bien cuidados, se nota.', 'Cuida mejor a tus Pokémon la próxima vez.'],
  ],
  breeder: [
    ['Cada uno de mis Pokémon salió de un huevo que cuidé yo.', 'Les voy a dar una baya a todos.', 'Cuidados desde el huevo. Te lo dije.'],
    ['Mis Pokémon comen bien, duermen bien y pelean mejor.', 'Ahora van a dormir más.', 'Comen bien, ¿ves? Se nota.'],
    ['¡Mira qué sanos están! Y qué fuertes.', 'Sanos, sí. Fuertes, falta.', 'Sanos y fuertes, como te dije.'],
  ],
  snow_ace_trainer: [
    ['Entreno donde nadie más se atreve. Por eso gano.', 'Me derretiste.', 'Por eso gano. Te lo dije.'],
    ['La nieve hasta las rodillas y yo igual entreno.', 'Me congelé las ideas.', 'Las rodillas en la nieve, la victoria en el bolsillo.'],
    ['Un Entrenador Guay no le teme al frío.', 'Al frío no. A ti, un poco.', 'Al frío no le temo. A ti, menos.'],
  ],
  psychic: [
    ['Tus cartas me dicen que vas a perder.', 'Las cartas… mintieron.', 'Las cartas nunca mienten.'],
    ['Veo tu aura. Está… nerviosa.', 'Mi aura es la que está nerviosa ahora.', 'Tu aura lo sabía. Por eso estaba nerviosa.'],
    ['Puedo mover cucharas con la mente. Y a tus Pokémon.', 'No pude mover ni la cuchara.', 'Moví a tus Pokémon. Directo al suelo.'],
  ],
  black_belt: [
    ['¡Kiai! Mi cinturón negro no es de adorno.', 'Necesito otro cinturón… uno de humildad.', '¡Kiai! Te dije que no era de adorno.'],
    ['Rompo tablas con la mano. ¿Quieres ver?', 'Me rompiste la racha.', 'Rompí la tabla. Y tu racha.'],
    ['Mis Pokémon y yo entrenamos bajo la cascada.', 'La cascada pega menos que tú.', 'La cascada nos hizo fuertes. Te lo advertí.'],
  ],
  school_kid: [
    ['¡Estudié todas las tablas de tipos! ¡Examen sorpresa!', 'Me faltó estudiar un capítulo…', '¡Un siete! Te dije que había estudiado.'],
    ['Mi profesora dice que soy el mejor de la clase.', 'Mi profesora va a estar decepcionada.', 'Mi profesora tenía razón.'],
    ['¿Sabías que el tipo Fuego es débil al Agua? ¡Yo sí!', 'Sabía la teoría. Me faltó la práctica.', 'La teoría funciona. Te lo dije.'],
  ],
  clerk: [
    ['Salí de la oficina a respirar. ¡Y a pelear!', 'Vuelvo a mi escritorio…', 'Respiré, peleé y gané. Buen recreo.'],
    ['Tengo una reunión en diez minutos. Sobra tiempo.', 'Voy a llegar tarde a la reunión.', 'Sobró tiempo, como te dije.'],
    ['Mis Pokémon también hacen horas extra.', 'Hoy no les pagan las horas extra.', 'Horas extra bien pagadas.'],
  ],
  preschooler: [
    ['¡Mira mi Pokémon! ¡Es el más lindo!', '¡Buaaa! ¡Pero igual es el más lindo!', '¡Te dije que era el más lindo! ¡Y el más fuerte!'],
    ['¡Mi mamá me dejó pelear con los grandes!', '¡Voy a decirle a mi mamá que me ganaste!', '¡Mamá! ¡Le gané a un grande!'],
    ['¡Juguemos! ¡Juguemos a los Pokémon!', '¡Ya no quiero jugar!', '¡Gané yo! ¡Otra vez, otra vez!'],
  ],
  youngster: [
    ['¡Mis Pokémon son los mejores! ¡Te lo voy a demostrar!', '¡No es justo! ¡Me faltaba un turno!', '¡Te dije que eran los mejores!'],
    ['¿Tú también subes la torre? ¡Pelea conmigo!', 'Voy a ir a contarle a mi mamá…', '¡Y tú creías que me ganabas!'],
    ['¡Mi Rattata está en el uno por ciento más fuerte!', 'Será el dos por ciento, entonces.', '¡Uno por ciento! ¡Te lo dije!'],
    ['¡Uso shorts porque son cómodos y fáciles de usar!', 'Los shorts no me salvaron.', '¡Los shorts nunca fallan!'],
  ],
  player: PLAYER_LINES,
  player_m_alternate: PLAYER_LINES,
  player_f_alternate: PLAYER_LINES,
  beauty: [
    ['Pelear con estilo es lo único que importa.', 'Perdí, pero con estilo.', 'Con estilo, como siempre.'],
    ['¿Te gusta mi peinado? Me tomó toda la mañana.', 'Me despeinaste.', 'Ni un pelo fuera de lugar. Te lo dije.'],
    ['La belleza también es fuerza.', 'Tu fuerza fue más bella.', 'Belleza y fuerza. Lo tengo todo.'],
  ],
  officer: [
    ['¡Alto ahí! Control de rutina: ¡muéstrame tus Pokémon!', 'Todo en orden. Puede circular.', 'Control reprobado. Vuelva a la fila.'],
    ['Esta ruta está bajo vigilancia. Y la vigilo yo.', 'Bajo vigilancia, y aun así me ganaste.', 'Te dije que yo vigilaba.'],
    ['Tengo una orden de pelea con su nombre.', 'Orden cumplida. Al revés, eso sí.', 'Orden cumplida. Que no se repita.'],
  ],
  worker: [
    ['¡Casco puesto y manos a la obra! ¿Peleamos en mi descanso?', 'Se acabó la colación. A trabajar.', 'Buen descanso. Ahora sí, a la obra.'],
    ['Levanto vigas todo el día. Una pelea es fácil.', 'Pesó más que una viga.', 'Más fácil que una viga, como te dije.'],
    ['Obra en construcción. Pase bajo su propio riesgo.', 'Se me cayó el andamio.', 'Te dije que era bajo tu propio riesgo.'],
  ],
  bird_keeper: [
    ['Mis pájaros me avisaron que venías.', 'Vuelan alto, pero hoy aterrizaron.', 'Me avisaron también que ibas a perder.'],
    ['¿Escuchas ese canto? Es un grito de guerra.', 'Ahora es un canto triste.', 'Grito de guerra, te dije.'],
    ['Cuido a mis aves desde que eran pichones.', 'Mis pichones necesitan crecer más.', 'Crecieron fuertes, ¿viste?'],
  ],
  camper: [
    ['¡Armé mi carpa aquí para esperar rivales como tú!', 'Desarmo la carpa y me voy.', 'Valió la pena armar la carpa.'],
    ['Nada como pelear al aire libre.', 'Al aire libre también se pierde.', 'Aire libre y victoria. ¡Qué día!'],
    ['¡Tengo malvaviscos para después de la pelea!', 'Me los voy a comer solo, de pena.', '¡Malvaviscos de victoria! ¿Quieres uno?'],
  ],
  backpacker: [
    ['Llevo meses viajando con mis Pokémon. ¡Somos un equipo!', 'Otra historia para mi diario de viaje.', 'Meses de viaje se notan. Te lo dije.'],
    ['Mi mochila pesa veinte kilos. Mis Pokémon, más.', 'Ahora la mochila pesa más.', 'Veinte kilos de puro entrenamiento.'],
    ['¡En cada región que visito, aprendo algo nuevo!', 'Aprendí que eres fuerte.', 'Aprendí a ganarle a gente como tú.'],
  ],
  unknown: [
    ['Estoy investigando a los entrenadores fuertes. Empiezo contigo.', 'Datos registrados. Eres fuerte.', 'Datos registrados. No tan fuerte, al final.'],
    ['¿Quién soy? Eso no importa. ¿Quién eres tú?', 'Ahora sé quién eres. Alguien fuerte.', 'Ya sé quién eres: alguien que perdió.'],
    ['Llevo una libreta con cada entrenador que encuentro.', 'Anotado: me ganaste.', 'Anotado: te gané.'],
  ],
  scientist: [
    ['Hipótesis: te voy a ganar. Comprobémoslo.', 'Hipótesis rechazada. Interesante…', 'Hipótesis confirmada. Como predije.'],
    ['Mis cálculos dicen que tengo un 87 % de ventaja.', 'Error de redondeo. Grave.', 'Ochenta y siete por ciento. Los números no mienten.'],
    ['¡Necesito datos de batalla para mi investigación!', 'Datos valiosos, aunque dolorosos.', 'Excelentes datos. Gracias por participar.'],
  ],
  roughneck: [
    ['¿Qué miras? ¿Quieres pelea? Ya, peleemos.', 'Ya, ya. No es para tanto.', '¿Viste? No había que mirar.'],
    ['Esta ruta es mía. Si quieres pasar, pelea.', 'Ok, la ruta es tuya.', 'La ruta sigue siendo mía.'],
    ['No me gustan los que suben la torre de buena gana.', 'Bueno, me caíste bien igual.', 'Te dije que no me gustaban.'],
  ],
  backers: [
    ['¡Ra, ra, ra! ¡A pelear con alegría!', '¡Igual aplaudo tu pelea!', '¡Ra, ra, ra! ¡Ganamos! ¡Te lo dijimos!'],
    ['¡Dame una V! ¡Dame una I! ¡Dame una… victoria!', 'Nos dieron una D… de derrota.', '¡V-I-C-T-O-R-I-A! ¡Lo sabíamos!'],
    ['¡Nuestro equipo tiene más ánimo que nadie!', 'Ánimo sí. Pelea, falta.', '¡El ánimo gana partidos! ¡Te lo dijimos!'],
  ],
  scuba_diver: [
    ['Bajo el agua todo se ve distinto. Hasta mi estrategia.', 'Mejor vuelvo a las profundidades.', 'Distinto y mejor, como te dije.'],
    ['Aguanto la respiración tres minutos. ¿Y tú, la pelea?', 'Me quedé sin aire primero.', 'Tú te quedaste sin aire. Te avisé.'],
    ['Allá abajo hay Pokémon que nadie ha visto. Yo los entrené.', 'Vuelvo a las profundidades a entrenar.', 'Te dije que nadie los había visto pelear.'],
  ],
  swimmer: [
    ['¡Cien largos y todavía tengo energía para ti!', 'Me quedé sin aire…', '¡Cien largos y una victoria!'],
    ['¡El agua está perfecta para una pelea!', 'Ahora me quiero hundir.', 'Perfecta, te dije.'],
    ['Nado con mis Pokémon todas las mañanas.', 'Mañana nado el doble.', 'Se nota el entrenamiento, ¿no?'],
  ],
  halloween_rival: [
    ['¡Dulce o pelea! Bueno, pelea.', 'Me quedé sin dulces y sin pelea.', '¡Pelea ganada! Ahora dame un dulce.'],
    ['¿Te gusta mi disfraz? Da miedo, ¿cierto?', 'Ahora da pena.', 'Te dije que daba miedo.'],
    ['Este año me disfracé de campeón. ¿Se nota?', 'Mejor me disfrazo de otra cosa.', '¡Disfraz y título!'],
  ],
  pokefan: [
    ['¡Mis Pokémon son los más tiernos del mundo! Y los más fuertes.', 'Igual los quiero mucho.', 'Los más tiernos y los más fuertes, te dije.'],
    ['¡Tengo fotos de mis Pokémon en toda la casa!', 'Voy a sacar una foto de esta derrota.', '¡Otra foto para la pared! La de la victoria.'],
    ['Cuido a mis Pokémon como a mi familia.', 'Mi familia necesita más entrenamiento.', 'La familia unida jamás será vencida.'],
  ],
  expert_pokemon_breeder: [
    ['Crié a estos Pokémon con IVs perfectos. Bueno, casi.', 'Tendré que cruzar otra generación.', 'Casi perfectos bastaron. Te lo dije.'],
    ['Veinte generaciones de crianza para llegar a esto.', 'Veintiuna, entonces.', 'Veinte generaciones no se le ganan a cualquiera.'],
  ],
  waiter: [
    ['¿Qué va a pedir? Le recomiendo una derrota bien servida.', 'La cuenta la pago yo, parece.', 'Su derrota, bien servida. ¿Algo más?'],
    ['Mesa para uno… y para mis Pokémon.', 'Cerramos la cocina.', 'Plato del día: victoria. Se lo dije.'],
    ['Atiendo diez mesas a la vez. Una pelea, sin problema.', 'Se me cayó la bandeja.', 'Bandeja en alto, como siempre.'],
  ],
  doctor: [
    ['Tranquil{o}, después de la pelea reviso a tus Pokémon.', 'El paciente fui yo.', 'Ahora sí los reviso. Lo necesitan.'],
    ['Diagnóstico: necesitas perder un poco.', 'Diagnóstico equivocado.', 'El diagnóstico era correcto.'],
    ['Mis Pokémon saben primeros auxilios. Y ataques.', 'Ahora los auxilios son para mí.', 'Ataques primero, auxilios después.'],
  ],
  snow_worker: [
    ['Despejo la nieve de esta ruta. Y a los que pasan, también.', 'Me despejaste tú a mí.', 'Ruta despejada. Te lo advertí.'],
    ['Con este frío, una pelea es lo único que calienta.', 'Me calentaste de más.', 'Ahora sí entré en calor.'],
    ['Pala en mano desde las cinco. Una pelea es un descanso.', 'Mejor vuelvo a la pala.', 'Buen descanso. Y ganado.'],
  ],
  twins: [
    ['¡Somos gemelas! ¡Pensamos igual y peleamos igual!', '¡Perdimos igual también!', '¡Te dijimos que pensábamos igual!'],
    ['¿Quién es quién? ¡Adivina mientras peleamos!', 'Tú tampoco adivinaste. Ni nosotras.', '¡No adivinaste! ¡Ni la pelea!'],
  ],
  interviewers: [
    ['¡Estamos grabando! ¿Una pelea para el noticiero?', 'Esto no sale al aire.', '¡Exclusiva! Le ganamos a un entrenador en vivo.'],
    ['¿Qué se siente subir la torre? Cuéntanos después de pelear.', 'Ahora la entrevista es para ti.', 'Cuéntanos qué se siente perder. En cámara.'],
  ],
  hiker: [
    ['¡Cada montaña tiene su cumbre, y yo las subí todas!', 'Me voy a descansar a la cumbre…', '¡Otra cumbre conquistada! Te lo dije.'],
    ['Mis piernas aguantan cualquier cerro. ¿Y tus Pokémon?', 'Me ganaste en la subida.', 'Tus Pokémon no aguantaron el cerro.'],
    ['¡Hey! ¿También vienes a escalar?', 'Mejor bajo por el otro lado.', 'Para escalar, hay que entrenar. Como yo.'],
  ],
  harlequin: [
    ['¡Pasen y vean! ¡El show de la pelea!', 'Se cayó el telón…', '¡Aplausos para el ganador! O sea, yo.'],
    ['¡Para mi próximo truco, haré desaparecer a tu equipo!', 'El truco me salió al revés.', '¡Desaparecido! Te lo dije.'],
    ['¡Malabares con Pokébolas! ¿Cuál se abrirá primero?', 'Se me cayeron todas.', '¡Ni una al suelo!'],
  ],
  bug_catcher: [
    ['¡Atrapé un bicho buenísimo! ¿Quieres verlo pelear?', '¡Mi red no atrapó la victoria!', '¡Te dije que era buenísimo!'],
    ['¡Cuidado con el pasto, que ahí viven mis amigos!', 'Me voy a buscar más bichos.', '¡Mis amigos te ganaron!'],
    ['¡Mi red nunca falla!', 'Hoy falló.', '¡Te dije que nunca fallaba!'],
  ],
  nursery_aide: [
    ['¡Estos pequeños se portan muy bien conmigo!', '¡Tranquilos, a la siesta todos!', '¡Muy bien, niños! Le ganamos.'],
    ['Cuido a los Pokémon más chiquitos de la guardería.', 'Necesitan crecer un poco más.', 'Chiquitos, pero valientes.'],
    ['Shh… que se despiertan. Bueno, ya despertaron. ¡A pelear!', 'Ahora sí, a dormir.', 'Despertaron con energía, ¿viste?'],
  ],
  young_couple: [
    ['¡Peleamos juntos desde que nos conocimos!', 'Bueno, perder juntos también es romántico.', '¡El amor gana! Te lo dijimos.'],
    ['¿Una cita? No, una pelea de a dos.', 'La cita salió mal.', 'Mejor cita imposible.'],
  ],
  ace_trainer: [
    ['Entreno todos los días para subir esta torre. No me vas a frenar.', 'Necesito entrenar más…', 'Te dije que no me ibas a frenar.'],
    ['Un Entrenador Guay no pierde dos veces. ¡Esta es la primera!', 'Bueno, esta fue la primera.', 'Ni una vez, de hecho.'],
    ['Estudié tu equipo desde que entraste.', 'Estudié mal, parece.', 'Lo estudié bien. Se notó.'],
    ['Las medallas no se ganan solas. Yo tengo ocho.', 'Ocho medallas y aun así…', 'Ocho medallas por algo.'],
  ],
  aroma_lady: [
    ['Huele a victoria. La mía, claro.', 'Ahora huele a derrota…', '¿Lo hueles? Victoria. Te lo dije.'],
    ['Mis flores calman a cualquiera. Menos a mis Pokémon.', 'Me quedé con las flores marchitas.', 'Calma para mí, tormenta para ti.'],
  ],
  rival: [
    ['¡Por fin te alcanzo! Esta vez gano yo.', '¡¿Otra vez?! Ya verás en el próximo piso.', '¡Te lo dije! ¡Esta vez gano yo!'],
    ['Mi equipo creció tanto como el tuyo. ¡Vamos!', 'Sigues un paso adelante…', 'Creció más que el tuyo, parece.'],
    ['Llevo toda la subida pisándote los talones.', 'Y tú me sigues pisando a mí.', 'Ahora soy yo el que va adelante.'],
    ['¿Te acuerdas de nuestra primera pelea? Hoy es distinto.', 'Igualito a la primera.', 'Te dije que hoy era distinto.'],
  ],
  veteran: [
    ['He visto mil batallas. Muéstrame si la tuya vale la pena.', 'Hace años que nadie me ganaba así.', 'No valió la pena. Todavía.'],
    ['La experiencia gana a la juventud. ¿O no?', 'Me jubilo… otra vez.', 'La experiencia gana. Te lo dije.'],
    ['Cuando yo empecé, esta torre tenía la mitad de pisos.', 'Y la mitad de rivales como tú.', 'Y aún así la subí entera.'],
  ],
  biker: [
    ['¡Brrrum! ¡Sal de mi camino o pelea!', 'Me quedé sin bencina…', '¡Brrrum! Te dije que te salieras.'],
    ['Mi moto y mis Pokémon hacen el mismo ruido.', 'Ahora hacen silencio.', '¡Ruido de victoria!'],
  ],
  dragon_tamer: [
    ['Domé dragones salvajes. Tú no eres tan difícil.', 'Eres más difícil que un dragón.', 'Nada difícil, como te dije.'],
    ['Mi capa la hice con escamas de dragón. Mudadas, no te asustes.', 'Me arrugaste la capa.', 'La capa sigue intacta.'],
  ],
  dancer: [
    ['¡Pelear es como bailar! Sigue mi ritmo.', 'Perdí el ritmo…', 'No seguiste mi ritmo. Te avisé.'],
    ['Un, dos, tres… ¡ataque!', 'Un, dos, tres… derrota.', '¡Y final! ¡Aplausos, por favor!'],
    ['Mis Pokémon ensayan conmigo cada coreografía.', 'Nos equivocamos de paso.', 'Coreografía perfecta.'],
  ],
  ruin_maniac: [
    ['Estas ruinas guardan secretos… ¡y yo los voy a defender!', 'Las ruinas tendrán que esperar.', 'Los secretos siguen a salvo.'],
    ['Encontré un muro con escrituras Unown. ¡Dice que voy a ganar!', 'Lo leí al revés.', 'El muro tenía razón.'],
  ],
  bug_type_superfan: [
    ['¡Los Pokémon bicho son lo mejor que existe! ¡Te lo voy a probar!', '¡Igual son lo mejor que existe!', '¡Probado! ¡Lo mejor que existe!'],
    ['¿Sabías que hay más de cien Pokémon bicho? Me sé todos.', 'Me faltó uno: el que me ganó.', 'Todos, y todos fuertes.'],
  ],
  firebreather: [
    ['¡Fuaaa! ¡Mira mis llamas!', 'Me quemé la lengua.', '¡Fuaaa! ¡Te dije que miraras!'],
    ['Escupo fuego desde chico. Mis Pokémon, también.', 'Hoy escupí humo nomás.', 'Fuego de verdad, ¿viste?'],
  ],
  hooligans: [
    ['¡Eh, eh! ¡Esta ruta la cuidamos nosotros!', 'Ya, ya, pasa nomás.', '¡Te dijimos que la cuidábamos!'],
    ['Dos contra uno no es trampa si lo pides tú.', 'Igual perdimos. Qué vergüenza.', 'No es trampa. Es estrategia.'],
  ],
  musician: [
    ['¡Toco una melodía para cada ataque!', 'Desafiné justo al final.', '¡Final perfecto! Como te dije.'],
    ['Esta canción se llama «Tu derrota».', 'Cambio el título: «Mi derrota».', 'El título era perfecto.'],
  ],
  pilot: [
    ['Pasajeros, abróchense los cinturones: viene turbulencia.', 'Aterrizaje de emergencia. Qué vergüenza.', 'Aterrizamos sin novedad. Te avisé de la turbulencia.'],
    ['Desde la cabina se ve toda la torre.', 'Ahora la veo desde el suelo.', 'Vista despejada. Victoria a la vista.'],
  ],
  fisherman: [
    ['¡Picó uno grande! Ah, no, eras tú.', 'Se me cortó la caña…', '¡Picaste! Te dije que eras tú.'],
    ['Paciencia, eso enseña la pesca. ¡Pero hoy no tengo!', 'Mejor vuelvo a pescar tranquilo.', 'Sin paciencia y aun así gané.'],
    ['Llevo tres horas esperando que algo pique.', 'Picó algo, pero me arrastró.', '¡Por fin! Tres horas valieron la pena.'],
  ],
  striker: [
    ['¡Gol de media cancha, así gano yo!', 'Penal en contra…', '¡Golazo! ¡Te lo dije!'],
    ['¡Mis Pokémon juegan en equipo, como en la cancha!', 'Nos faltó un delantero.', '¡Jugada de equipo! ¡Gol!'],
  ],
  depot_agent: [
    ['¡Próxima estación: tu derrota!', 'Me pasé de estación.', 'Estación de destino: tu derrota. Llegamos a la hora.'],
    ['Este tren no se detiene. Mis Pokémon tampoco.', 'Descarrilamos.', 'Te dije que no se detenía.'],
  ],
  guitarist: [
    ['¡Esta pelea tiene banda sonora! ¡Uno, dos, tres!', 'Se me cortó una cuerda…', '¡Y cierre con solo de guitarra!'],
    ['Mis Pokémon rockean más fuerte que mis parlantes.', 'Bajaron el volumen.', '¡Rock de victoria!'],
  ],
  hex_maniac: [
    ['Je, je… preparé un hechizo solo para ti.', 'El hechizo rebotó. Típico.', 'El hechizo funcionó. Je, je… te lo dije.'],
    ['Las estrellas dicen que hoy es tu día de mala suerte.', 'Las estrellas se equivocaron de persona.', 'Las estrellas nunca se equivocan.'],
  ],
  janitor: [
    ['Termino de barrer y te barro a ti.', 'Me barriste tú.', 'Listo. Barrido.'],
    ['Esta torre no se limpia sola, ¿sabes?', 'Ahora tengo que limpiar mi derrota.', 'Un desorden menos: tú.'],
  ],
  fairy_tale_girl: [
    ['Había una vez una pelea que gané. ¡Esta!', 'Este cuento no terminó como quería.', '…Y vivieron felices. Yo, sobre todo.'],
    ['¡En mi cuento, la princesa gana la pelea!', 'Cambiaré el final del cuento.', '¡Te dije que la princesa ganaba!'],
  ],
  sailor: [
    ['¡Ahoy! Ningún marinero le hace el quite a una pelea.', '¡Hombre al agua! O sea, yo.', '¡Ahoy! ¡Victoria en alta mar!'],
    ['He cruzado siete mares. Esta pelea es un charco.', 'Me hundí en el charco.', 'Un charco, te dije.'],
  ],
  jacinthe_holo: [
    ['Soy solo una proyección. Pero mis Pokémon pelean de verdad.', 'Proyección apagada.', 'De verdad, como te dije.'],
    ['¿Me ves? Qué bueno. Ahora mira cómo pierdes.', 'Me desconecté.', 'Señal clara: perdiste.'],
  ],
  infielder: [
    ['¡Batazo directo a tu equipo!', 'Strike tres. Estoy fuera.', '¡Jonrón! ¡Te lo dije!'],
    ['Mis Pokémon atrapan cualquier ataque, como una pelota.', 'Se nos cayó la pelota.', 'Atrapada. Out.'],
  ],
  parasol_lady: [
    ['Que no me dé el sol, por favor. Peleemos rápido.', 'Ay, me insolé con tanta derrota.', 'Rápido, como te pedí. Gracias.'],
    ['Mi sombrilla también sirve de escudo.', 'No sirvió de mucho.', 'Escudo perfecto, ¿viste?'],
  ],
  smasher: [
    ['¡Saque directo! ¿Lo devuelves?', 'Doble falta…', '¡Ace! Ni lo viste.'],
    ['Juego, set y partido. Y apenas empezamos.', 'Juego, set y partido… para ti.', 'Juego, set y partido. Te lo dije.'],
  ],
  hoopster: [
    ['¡Encesto todos mis ataques!', 'Me bloqueaste el tiro.', '¡Triple sobre la bocina!'],
    ['En la cancha y en la torre, salto más alto que nadie.', 'Saltaste más alto tú.', 'Más alto que nadie, te dije.'],
  ],
  linebacker: [
    ['¡Nadie pasa por mi línea!', 'Pasaste igual.', '¡Te dije que nadie pasaba!'],
    ['¡Placaje! Ese es mi movimiento favorito. Y el de mi equipo.', 'Me placaste tú.', '¡Placaje perfecto!'],
  ],
  vicky: [
    ['¡Los Winstrate peleamos en familia! Y yo soy la abuela.', 'Ay, mis huesos. Ganaste, corazón.', 'La abuela todavía tiene garra, ¿viste?'],
    ['Esta abuela no se jubila de las peleas.', 'Bueno, a lo mejor un poquito.', 'Ni jubilada pierdo.'],
  ],
  vivi: [
    ['¡Mi familia entera es fuerte! ¡Yo también!', '¡Le voy a contar a mi abuela!', '¡Le voy a contar a mi abuela que gané!'],
    ['¡Practico con mi familia todos los días!', 'Necesito practicar más con ellos.', '¡La práctica en familia funciona!'],
  ],
  vito: [
    ['Entreno con mi familia y nadie me gana en casa.', 'Fuera de casa es otra historia.', 'Ni en casa ni afuera. Te lo dije.'],
    ['Los Winstrate no nos rendimos.', 'Bueno, hoy me rindo.', 'Te dije que no nos rendíamos.'],
  ],
  nate: [
    ['¡Unova tiene los mejores entrenadores! Te lo demuestro.', 'Bueno, uno de los mejores.', '¡Los mejores! ¿Viste?'],
    ['Vengo de Aspertia. Allá aprendimos a no rendirnos.', 'Aprendí también a perder.', 'No nos rendimos. Te lo dije.'],
  ],
  rosa: [
    ['¡Esta torre es más divertida que el Pokéwood!', 'Bueno, esta escena salió mal.', '¡Toma uno! ¡Escena perfecta!'],
    ['Mis Pokémon y yo somos un equipo de estrellas.', 'Estrellas apagadas, hoy.', '¡Brillamos, como te dije!'],
  ],
  victor: [
    ['Subí hasta aquí de un tirón. ¿Y tú?', 'De un tirón también se cae.', 'De un tirón, y sigo.'],
    ['Mis Pokémon y yo tenemos un sueño: la cima.', 'El sueño sigue. Más lejos.', 'Un paso más cerca de la cima.'],
  ],
  victoria: [
    ['Entreno cada día un poco más. Hoy te toca a ti.', 'Mañana entreno el doble.', 'Cada día un poco más fuerte. Se nota.'],
    ['¿Lista la pelea? Yo nací lista.', 'Nací lista, pero no para esto.', 'Nací lista, te dije.'],
  ],
  benga: [
    ['¡Mi abuelo fue campeón! ¡Yo voy a ser mejor!', 'Mi abuelo se va a reír de mí.', '¡Mi abuelo va a estar orgulloso!'],
    ['¡Uf, estoy tan emocionado que no me puedo quedar quieto!', 'Ahora sí me quedé quieto.', '¡Te dije que estaba emocionado!'],
  ],
  mysterious_sisters: [
    ['…Nosotras… sabíamos que vendrías…', '…Esto no lo sabíamos…', '…Lo sabíamos. Lo sabíamos todo…'],
    ['¿Escuchas? Nuestros Pokémon susurran tu nombre.', 'Ahora susurran el tuyo con respeto.', 'Susurraban tu derrota.'],
  ],
  baker: [
    ['¡Recién salida del horno, como mis Pokémon!', 'Se me quemó el pan.', '¡Calentitos y ganadores!'],
    ['Amaso desde las cuatro de la mañana. Pelear es fácil.', 'Me dejaste como masa cruda.', 'Fácil, como te dije.'],
  ],
  artist: [
    ['Cada pelea es una obra de arte. Esta será mi mejor cuadro.', 'Un cuadro triste, pero honesto.', 'Mi obra maestra. ¡Firmada!'],
    ['Te voy a pintar… perdiendo.', 'El retrato salió al revés.', 'Retrato terminado. Igualito.'],
  ],
  maid: [
    ['Con permiso. Despejaré el camino… a mi manera.', 'Disculpe las molestias.', 'Camino despejado. Con permiso.'],
    ['¿Le sirvo un té antes de la pelea?', 'El té se enfrió.', 'Ahora sí, el té. Ganado.'],
  ],
};

export const VILLAIN_LINES: Readonly<Record<string, readonly Line[]>> = {
  rocket: [
    ['¡Team Rocket en acción! Entrega tus Pokémon y nadie sale herido.', '¡El Team Rocket despega de nuevo!', 'Te dije que los entregaras. Ahora son míos… bueno, casi.'],
    ['El jefe Giovanni me va a ascender si te gano.', 'Adiós ascenso.', '¡Ascenso asegurado!'],
    ['Este escondite no lo encuentra nadie. ¿Cómo llegaste?', 'Llegaste y me ganaste. Doble vergüenza.', 'Llegaste, pero no saliste ganando.'],
  ],
  aqua: [
    ['¡El Team Aqua va a expandir los mares! Y tú estás en medio.', '¡Me hundiste!', 'Te dije que estabas en medio.'],
    ['¡Ahoy! Ningún terrestre pasa por aquí.', 'Me mandaste a la deriva.', 'Al agua contigo.'],
    ['Más mar para todos. ¿Quién podría estar en contra?', 'Tú, parece.', 'Nadie. Y menos tú.'],
  ],
  magma: [
    ['¡El Team Magma necesita más tierra firme! Fuera de aquí.', '¡Me derretí!', 'Te dije que te fueras.'],
    ['¡Más volcanes, más tierra, más Magma!', 'Menos Magma, hoy.', '¡Erupción de victoria!'],
    ['Aquí abajo hace calor. Y va a hacer más.', 'Me enfriaste.', 'Te avisé del calor.'],
  ],
  galactic: [
    ['El Team Galaxia creará un universo nuevo. Sin ti, claro.', 'Esto no estaba en el plan del jefe…', 'Universo nuevo, sin ti. Como te dije.'],
    ['Las emociones son un estorbo. Las tuyas también.', 'Siento… algo. Qué raro.', 'Sin emociones se gana mejor.'],
    ['¿Ves este uniforme? Es del espacio. Más o menos.', 'Aterricé de golpe.', 'Uniforme espacial, victoria espacial.'],
  ],
  plasma: [
    ['¡Libera a tus Pokémon! Dámelos a mí, digo, al Team Plasma.', 'Mis Pokémon no se quieren liberar de mí…', 'Te dije que los liberaras. Ahora es tarde.'],
    ['Los Pokémon merecen ser libres. Los tuyos, conmigo.', 'Los tuyos son libres de elegirte, parece.', 'Libres… de ti.'],
    ['¡Por la gloria del Team Plasma!', 'Menos gloria de la esperada.', '¡Gloria para el Team Plasma!'],
  ],
  flare: [
    ['El Team Flare solo quiere un mundo bello. Tú no estás invitad{o}.', 'Qué feo perder así.', 'Te dije que no tenías invitación.'],
    ['Mi traje cuesta más que tu equipo entero.', 'Y aun así me ganaste.', 'Se nota la inversión, ¿cierto?'],
    ['La belleza tiene un precio. Hoy lo pagas tú.', 'Lo pagué yo.', 'Pagado. Gracias.'],
  ],
  skull: [
    ['¡Yo, yo! ¡El Team Skull no se mueve de aquí, yo!', '¡Yo… perdí, yo!', '¡Yo, yo! ¡Te dijimos que no nos movíamos, yo!'],
    ['¿Buscas problemas? ¡Aquí los repartimos gratis!', 'Los problemas me tocaron a mí.', '¡Problemas gratis, yo! ¿Quieres más?'],
    ['¡Este es nuestro territorio, yo! ¡Fuera!', 'Bueno, ya, pasa, yo.', '¡Territorio Skull, yo!'],
  ],
  aether: [
    ['La Fundación Æther protege a los Pokémon. De ti también.', 'Tendré que redactar un informe…', 'Informe redactado: amenaza neutralizada.'],
    ['Acceso restringido. Identifíquese.', 'Acceso concedido. A la fuerza.', 'Acceso denegado. Retírese.'],
    ['Todo aquí es blanco y limpio. Como mi historial.', 'Mi historial tiene una mancha.', 'Historial impecable.'],
  ],
  macro: [
    ['Macro Cosmos agradece su visita. Ahora, retírese.', 'Esto afectará mi evaluación de desempeño.', 'Gracias por su visita. Vuelva pronto. O no.'],
    ['Su pelea no estaba en la agenda de hoy.', 'Reagendaré mi derrota.', 'Agenda cumplida.'],
    ['El presidente Rose cuenta conmigo.', 'El presidente no va a estar contento.', 'El presidente va a estar orgulloso.'],
  ],
  star: [
    ['¡El Team Star manda en este camino! ¡Pórtate bien y pierde!', '¡Ya, ya! Pasa, pero no le digas al jefe.', '¡Te dije que te portaras bien!'],
    ['¡Starfall Street! ¡Aquí nadie pasa sin pelear!', 'Pasaste peleando. Justo.', '¡Nadie pasa! ¡Te lo dije!'],
    ['¿Te crees de los rudos? Nosotros somos más.', 'Ok, eres de los rudos.', 'Somos más. Siempre.'],
  ],
};
