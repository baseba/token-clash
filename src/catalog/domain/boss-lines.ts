// What the Tower's bosses say in their own voice: gym leaders, the Elite Four, champions and the
// villains waiting in a hideout, each with at least two lines of [when it sees you, when it loses,
// when it beats you]. "{o}" agrees with who says it.
import type { Line } from './tower-lines.js';

const GIOVANNI: readonly Line[] = [
  ['Así que tú eres quien se mete en mis asuntos. Te enseñaré lo que es el poder.', 'Hoy me retiro. Pero el Team Rocket no desaparece.', 'Esto es el poder. No lo olvides.'],
  ['Pocos llegan hasta mí. Menos aún se van caminando.', 'Te fuiste caminando. Y ganando. Interesante.', 'Te dije que pocos se iban caminando.'],
];

export const BOSS_LINES: Readonly<Record<string, readonly Line[]>> = {
  brock: [
    ['Mi voluntad es tan dura como la roca. ¡Adelante!', 'Tu determinación es admirable.', 'La roca no se mueve. Entrena y vuelve.'],
    ['Mis Pokémon de roca resisten cualquier golpe. ¿Lo comprobamos?', 'Resistieron todo… menos a ti.', 'Comprobado. Resisten cualquier golpe.'],
  ],
  misty: [
    ['¡Mi estrategia es el ataque total con Pokémon de agua!', 'Vaya, sí que eres fuerte.', '¡Ataque total, te dije!'],
    ['¿Viniste a mojarte? ¡Porque te vas a empapar!', '¡Me empapé yo! Qué rabia.', '¡Empapad{o} de victoria! Bueno, yo.'],
  ],
  lt_surge: [
    ['¡Hey, recluta! Los Pokémon eléctricos me salvaron en la guerra. ¡Te van a electrocutar!', '¡Sorprendente! Tienes agallas, recluta.', '¡Ja! ¡Electrocutado, recluta! Te lo advertí.'],
    ['¡Firmes, recluta! Esto es un entrenamiento de verdad.', '¡Descanso! Te lo ganaste, recluta.', '¡Otra vuelta a la cancha, recluta!'],
  ],
  erika: [
    ['Ah… disculpa, me quedé dormida con este sol. ¿Una pelea? Con gusto.', 'Perdí… Tus Pokémon son espléndidos.', 'Qué agradable. Ahora vuelvo a mi siesta.'],
    ['Las flores de mi jardín son delicadas. Mis Pokémon, no tanto.', 'Mis flores necesitan más cuidado.', 'Delicadas, pero firmes. Como te dije.'],
  ],
  koga: [
    ['¡Fua, ja, ja! Un ninja no pelea con fuerza: pelea con astucia.', '¡Has demostrado tu valía!', '¡Fua, ja, ja! La astucia gana otra vez.'],
    ['¿Notaste el veneno? No. Nadie lo nota a tiempo.', 'Lo notaste. Impresionante.', 'No lo notaste a tiempo. Te lo dije.'],
  ],
  janine: [
    ['Soy la hija de Koga. Las técnicas ninja corren por mi sangre.', 'Mi padre va a querer saber de ti.', '¡Mi padre estaría orgulloso! Te lo advertí.'],
    ['¿Me ves? Qué bien. ¿Y ahora?', 'Me encontraste. Bien hecho.', 'No me viste venir. Ninja, al fin y al cabo.'],
  ],
  sabrina: [
    ['Supe que vendrías. Lo vi hace tres días.', 'Esta derrota… no la vi venir.', 'También vi esto. Hace tres días.'],
    ['Puedo mover objetos con la mente. Y a tus Pokémon.', 'Mi mente no alcanzó.', 'Te dije que los movía. Directo al suelo.'],
  ],
  blaine: [
    ['¡Ja! ¡Espero que hayas traído Antiquemar!', 'Me consumí por completo.', '¡Ja! ¡Te dije que trajeras Antiquemar!'],
    ['Adivinanza: ¿qué arde más que un volcán? ¡Mi equipo!', 'Respuesta equivocada. Era el tuyo.', '¡Respuesta correcta! ¡Mi equipo!'],
  ],
  giovanni: GIOVANNI,
  rocket_boss_giovanni_1: GIOVANNI,
  lorelei: [
    ['Nadie domina el hielo como yo. Te congelaré.', 'No está mal… nada mal.', 'Congelado. Te lo dije.'],
    ['El hielo es bello, frío y despiadado. Como mi estrategia.', 'Me derretiste el orgullo.', 'Bello, frío y despiadado. Como prometí.'],
  ],
  bruno: [
    ['¡Mis músculos y mis Pokémon son puro entrenamiento!', '¿Cómo? Perdí…', '¡Puro entrenamiento! ¿Lo sentiste?'],
    ['¡Hu-ah! ¡Te aplastaré con todo mi poder!', 'Me aplastaste tú.', '¡Hu-ah! Aplastado, como te dije.'],
  ],
  agatha: [
    ['Je. Los Pokémon son para pelear, no para mimar.', 'Me dejaste con la boca abierta, criatura.', 'Je, je. Te dije que no eran para mimar.'],
    ['Oak y yo fuimos rivales. Ese viejo te mandó, ¿cierto?', 'Dile a Oak que te enseñó bien.', 'Dile a Oak que todavía le gano a sus alumnos.'],
  ],
  lance: [
    ['Los dragones son criaturas místicas. ¡Prepárate!', 'Tú y tus Pokémon tienen algo especial.', 'Te lo advertí: los dragones no se doman fácil.'],
    ['Soy el maestro dragón. Muéstrame tu fuerza.', 'Una fuerza digna de un campeón.', 'Esa fuerza todavía no basta.'],
  ],
  blue: [
    ['¡Por fin llegas! Te estuve esperando todo este tiempo.', '¿Qué? ¡No puede ser! ¡Elegí a los mejores Pokémon!', '¡Ja! ¡Te dije que era el mejor del mundo!'],
    ['¡Huele a perdedor por aquí! Ah, eres tú.', 'Ahora el que huele a perdedor soy yo.', '¡Huele a perdedor! Te lo dije.'],
  ],
  red: [
    ['…', '…!', '……'],
    ['……!', '…', '…!'],
  ],
  will: [
    ['Entrené por todo el mundo para perfeccionar mis Pokémon psíquicos.', 'No puedo creer que haya perdido.', 'El mundo entero me entrenó para esto.'],
    ['Detrás de esta máscara veo tu derrota.', 'La máscara no me dejó ver bien.', 'Te dije que la veía.'],
  ],
  karen: [
    ['Los Pokémon fuertes. Los débiles. Eso es lo que la gente cree.', 'Los verdaderos entrenadores pelean con sus favoritos. Lo entendiste.', 'Pelea con tus favoritos y vuelve.'],
    ['Me gustan los Pokémon siniestros. Tienen carácter.', 'Tu carácter es mayor.', 'Carácter, te dije.'],
  ],
  falkner: [
    ['¡Los Pokémon pájaro no son débiles! Te lo voy a demostrar.', 'Tú… me cortaste las alas.', '¡Demostrado! Los pájaros no son débiles.'],
    ['Mi padre me enseñó todo sobre los Pokémon pájaro.', 'Mi padre me va a hacer entrenar más.', 'Mi padre estaría orgulloso.'],
  ],
  bugsy: [
    ['¡Soy el que más sabe de Pokémon bicho! Investigo todo.', 'Tengo mucho que investigar todavía.', '¡Investigación confirmada! Los bichos ganan.'],
    ['Un bicho bien entrenado puede con cualquiera.', 'Con cualquiera, menos contigo.', 'Con cualquiera, te dije.'],
  ],
  whitney: [
    ['¡Todos dicen que mi Miltank es imparable! ¿Tú qué crees?', '¡Bua! ¡No es justo…! Bueno, ya, te lo ganaste.', '¡Imparable! ¡Te lo dije!'],
    ['¡Me encantan los Pokémon tiernos! Y ganar.', '¡Buaaa! ¡Me gustaba más ganar!', '¡Tiernos y ganadores!'],
  ],
  morty: [
    ['Veo cosas que otros no ven. Y veo que vas a perder.', 'No lo vi… Mi entrenamiento no termina.', 'Te dije que lo veía.'],
    ['Los fantasmas de esta torre me hablan de ti.', 'Ahora me hablan bien de ti.', 'Me dijeron que perderías.'],
  ],
  chuck: [
    ['¡GUAAAH! ¡Te ganaré con mi entrenamiento!', '¡Ay! Me dolió más que la cascada.', '¡GUAAAH! ¡El entrenamiento nunca falla!'],
    ['¡Medito bajo la cascada todos los días! ¡Mira mi fuerza!', '¡Necesito una cascada más grande!', '¡La cascada me hizo invencible!'],
  ],
  jasmine: [
    ['Eh… Hola. Mis Pokémon de acero son… bastante duros.', 'Eres muy fuerte… y amable con tus Pokémon.', 'Eh… Te dije que eran duros. Perdón.'],
    ['El faro me enseñó a no rendirme.', 'El faro me va a enseñar algo más hoy.', 'El faro siempre ilumina el camino.'],
  ],
  pryce: [
    ['El hielo lleva siglos en estas tierras. Igual que mi paciencia.', 'Me impresionas. El hielo se derrite.', 'Mi paciencia y el hielo ganan otra vez.'],
    ['He vivido mucho. He visto entrenadores como tú.', 'No como tú, me equivoqué.', 'Y todos perdieron. Como tú.'],
  ],
  clair: [
    ['Soy la mejor domadora de dragones del mundo. ¡No lo olvides!', 'Perdí… No me lo puedo creer.', 'No lo olvides: la mejor del mundo.'],
    ['Mi primo Lance no es el único dragón de la familia.', 'Lance se va a reír de mí.', 'Lance va a tener que ponerse al día.'],
  ],
  roxanne: [
    ['Estudié todas las estrategias del libro. ¡Pongámoslas a prueba!', 'Tengo mucho que aprender fuera del libro.', 'El libro tenía razón.'],
    ['Lección de hoy: el tipo Roca resiste.', 'Lección aprendida. Por mí.', 'Lección aprendida. Por ti.'],
  ],
  brawly: [
    ['¡Ola grande, pelea grande! ¡Vamos!', 'Me revolcó la ola.', '¡Corrí la ola completa!'],
    ['Surfeo de día y peleo de noche. ¡Hoy toca pelear!', 'Mejor vuelvo a surfear.', '¡Pelea surfeada!'],
  ],
  wattson: [
    ['¡Wahahaha! ¡Me encantan los desafíos!', '¡Wahahaha! ¡Me dejaste sin carga!', '¡Wahahaha! ¡Con carga de sobra!'],
    ['¡Este viejo todavía genera electricidad!', '¡Apagón total!', '¡Wahahaha! ¡Te dije que todavía generaba!'],
  ],
  flannery: [
    ['¡Mis Pokémon de fuego van a derretir todo! Eh… creo.', 'Ah… me pasé de entusiasta.', '¡Sí! ¡Derretí todo! ¡Te lo dije! Eh… creo.'],
    ['Mi abuelo me dejó este gimnasio. ¡No lo voy a defraudar!', 'Abuelo… perdón.', '¡Abuelo, mira! ¡Gané!'],
  ],
  norman: [
    ['Mi hijo me habló de ti. Ahora veamos qué tan fuerte eres.', 'Peleaste con todo. Lo respeto.', 'Mi hijo tenía razón: todavía te falta.'],
    ['Un padre siempre pelea por dar el ejemplo.', 'Hoy el ejemplo lo diste tú.', 'El ejemplo está dado.'],
  ],
  winona: [
    ['Vuelo con mis Pokémon pájaro desde niña. ¡Despeguemos!', 'Nunca vi a alguien volar así.', 'Te dije que volábamos alto.'],
    ['El cielo es mi gimnasio. ¿Te atreves a subir?', 'Subiste más alto que yo.', 'Subiste, pero caíste.'],
  ],
  tate: [
    ['¡Liza y yo pensamos igual! Bueno, hoy peleo yo.', 'Me faltó mi hermana…', '¡Liza, gané! ¡Te dije que podía!'],
    ['Puedo leer tus movimientos. Liza me enseñó.', 'Liza me enseñó mal.', 'Gracias, Liza.'],
  ],
  liza: [
    ['¡Tate y yo somos uno! Hoy me toca a mí.', 'Sin Tate no es lo mismo…', '¡Tate, gané sola! Bueno, casi.'],
    ['Lo que piensa Tate, lo pienso yo. Y pensamos que ganamos.', 'Pensamos mal.', 'Pensamos bien.'],
  ],
  juan: [
    ['Ah, la elegancia del agua. Bailemos esta pelea.', 'Qué elegancia la tuya. Bravo.', 'Elegancia pura. Te lo advertí.'],
    ['Le enseñé todo a Wallace. Ahora te enseño a ti.', 'El alumno fui yo.', 'Lección terminada. Bravo, para mí.'],
  ],
  wallace: [
    ['Una pelea debe ser bella como el agua. Muéstrame tu arte.', 'Tu equipo brilla. Qué belleza.', 'Bella como el agua, te dije.'],
    ['Mi Milotic es la criatura más hermosa del mundo. Y la más fuerte.', 'Hermosa, sí. Fuerte, hoy no.', 'Hermosa y fuerte. Como te dije.'],
  ],
  steven: [
    ['Me fascinan las piedras raras… y los entrenadores raros. Veamos de qué estás hecho.', 'Eres una piedra preciosa, sin duda.', 'Todavía eres una piedra en bruto.'],
    ['Mi Metagross y yo hemos recorrido toda Hoenn.', 'Hoenn me queda chica después de esto.', 'Toda Hoenn, y nadie nos detiene.'],
  ],
  sidney: [
    ['Me gusta esa mirada. Hagamos esto entretenido.', 'Bien jugado. Sigue así.', 'Entretenido, ¿cierto? Para mí, sobre todo.'],
    ['No me importa ganar o perder. Bueno, un poco.', 'Ok, me importaba harto.', 'Un poco me importaba. Gracias por dejarme ganar.'],
  ],
  phoebe: [
    ['Los espíritus de la montaña me acompañan.', 'Tu lazo con tus Pokémon es más fuerte que los espíritus.', 'Los espíritus sabían que ganaría.'],
    ['Mi abuela me enseñó a hablar con los fantasmas.', 'Los fantasmas me dicen que eres fuerte.', 'Los fantasmas me lo dijeron. Je.'],
  ],
  glacia: [
    ['Vine de muy lejos buscando a alguien que me haga sentir calor.', 'Vaya… sentí un poco de calor.', 'Sigo con frío. Qué decepción.'],
    ['El hielo no perdona errores.', 'Ningún error. Impresionante.', 'Cometiste un error. Y otro.'],
  ],
  drake: [
    ['¿Sabes lo que un entrenador necesita para pelear con dragones?', 'Sí lo sabes. Bien hecho.', 'No lo sabías. Ahora sí.'],
    ['He navegado por todos los mares con mis dragones.', 'Por fin encontré quien me hunda.', 'Ni una tormenta como tú nos hunde.'],
  ],
  roark: [
    ['Mis Pokémon de tipo Roca se forjaron en la mina. ¡Muéstrame si los tuyos son de buena piedra!', 'En la mina aprendí a reconocer una buena piedra, y tu equipo tiene temple.', 'Tu equipo todavía no es de buena piedra.'],
    ['¡Casco puesto! Vamos a picar piedra.', 'Me picaste a mí.', '¡Piedra picada!'],
  ],
  gardenia: [
    ['¡Mis Pokémon planta están en su mejor momento! ¿Lista la pelea?', 'Ay… mis plantitas necesitan sol.', '¡En su mejor momento, te dije!'],
    ['Me encanta el bosque. Y también ganar en él.', 'El bosque se puso triste.', '¡El bosque celebra!'],
  ],
  maylene: [
    ['Entreno descalza para sentir la tierra. ¡Vamos!', 'Necesito entrenar más. Mucho más.', 'Sentí la tierra. Y la victoria.'],
    ['Mi Lucario y yo nos entendemos sin hablar.', 'Hoy nos entendimos para perder.', 'Sin palabras. Solo victoria.'],
  ],
  crasher_wake: [
    ['¡La Ola Gigante ha llegado! ¡Prepárate para el chapuzón!', '¡Me revolcaste!', '¡Chapuzón total! ¡Te lo advertí!'],
    ['¡Mi máscara es de luchador! ¡Y mi pelea también!', '¡Me sacaste la máscara!', '¡Llave final! ¡Ganó la Ola Gigante!'],
  ],
  fantina: [
    ['Ah, ¿una pelea? ¡Me encantan! Mis fantasmas también.', 'Ah… très bien.', 'Magnifique! Te lo dije.'],
    ['Mis fantasmas bailan antes de atacar. ¿Ves?', 'Hoy bailaron mal.', 'Un baile perfecto.'],
  ],
  byron: [
    ['¡Ja, ja, ja! Mis Pokémon de acero no se doblan.', 'Se doblaron, parece.', '¡Ja, ja, ja! ¡No se doblan!'],
    ['Mi hijo Roark pelea con rocas. Yo, con acero.', 'Roark se va a burlar de mí.', 'El acero le gana a la roca.'],
  ],
  candice: [
    ['¡Concentración total! En la nieve se ve quién tiene garra.', '¡Esa concentración sí que la tienes!', '¡Concentración total! ¡Y garra!'],
    ['¡Los Pokémon de hielo son lo más! ¡Te lo pruebo!', '¡Igual son lo más!', '¡Probado! ¡Son lo más!'],
  ],
  volkner: [
    ['Estaba aburrido. Espero que tú me despiertes.', 'Gracias. Me recordaste por qué peleo.', 'Sigo aburrido. Una lástima.'],
    ['Hace tiempo que nadie me hace sudar.', 'Me hiciste sudar. Bien.', 'Ni una gota. Como esperaba.'],
  ],
  aaron: [
    ['Los Pokémon bicho son bellos y fuertes. ¡Te lo demostraré!', 'Tengo que entrenar más a mis bichos.', '¿Ves? Bellos y fuertes.'],
    ['Un bicho nunca se rinde. Yo tampoco.', 'Bueno, hoy me rindo.', 'Nunca nos rendimos.'],
  ],
  bertha: [
    ['Ay, mijo, no te pongas nervioso. Peleemos tranquilos.', 'Qué fuerte vienes, ¿eh?', 'Tranquilos, te dije. La experiencia pesa.'],
    ['Esta abuela tiene más mañas que tú.', 'Te enseñé una maña sin querer.', 'Mañas de abuela. Nunca fallan.'],
  ],
  flint: [
    ['¡Mi pasión arde! ¿Y la tuya?', 'Tu fuego ardió más.', '¡Mi pasión ardió más! ¡Te lo dije!'],
    ['¡Mi peinado es puro fuego! ¡Mi pelea también!', 'Me apagaste el peinado.', '¡Fuego de pies a cabeza!'],
  ],
  lucian: [
    ['Estaba leyendo. Espero que esta pelea sea igual de interesante.', 'Un capítulo memorable.', 'Un capítulo predecible. Vuelvo a mi libro.'],
    ['Cada pelea es un libro. Ya leí el final de esta.', 'El final cambió. Qué giro.', 'El final era el que esperaba.'],
  ],
  cynthia: [
    ['Hay algo en cómo te miran tus Pokémon. Quiero verlo de cerca.', 'Hacía tiempo que no sentía algo así en una pelea. Tus Pokémon confían en ti; cuídalo.', 'Tus Pokémon confían en ti. Todavía les falta crecer contigo.'],
    ['Estudio los mitos de Sinnoh. Y a los entrenadores que los superan.', 'Tú podrías ser uno de esos mitos.', 'Todavía no eres un mito. Pero vas por buen camino.'],
  ],
  cilan: [
    ['Permíteme servirte una pelea de primera calidad.', 'Un sabor inesperado. Delicioso.', 'Primera calidad, como prometí.'],
    ['¿Qué combina con esta pelea? Un toque de planta.', 'Le faltó sazón.', 'Combinación perfecta.'],
  ],
  chili: [
    ['¡Mis Pokémon de fuego están que arden!', '¡Me apagaste!', '¡Que arden, te dije!'],
    ['¡Pedido caliente! ¡Sale una derrota para la mesa dos!', '¡Se me quemó el pedido!', '¡Pedido entregado, bien caliente!'],
  ],
  cress: [
    ['El agua refleja todo. Incluso tu derrota.', 'El reflejo se movió.', 'El reflejo no mintió.'],
    ['Un buen mesero sirve con calma. Y pelea igual.', 'Se me derramó el agua.', 'Servido con calma.'],
  ],
  lenora: [
    ['Investigar es mi pasión. Veamos qué descubro de ti.', 'Descubrí que eres muy fuerte.', 'Descubrí que todavía te falta.'],
    ['Un museo guarda historia. Hoy guardaré la tuya.', 'Tu historia quedó en la vitrina.', 'Tu derrota, en exhibición.'],
  ],
  burgh: [
    ['¡Mis Pokémon son mi inspiración! Pintemos esta pelea.', 'Una obra maestra… tuya.', 'Una obra maestra… mía.'],
    ['El arte es explosión de colores. ¡Como mis bichos!', 'Se me corrió la pintura.', '¡Colores de victoria!'],
  ],
  elesa: [
    ['Prepárate para una pelea que te deslumbre.', 'Me deslumbraste tú.', 'Deslumbrante, como te dije.'],
    ['Las luces de la pasarela me siguen a todas partes.', 'Hoy las luces te siguen a ti.', 'Las luces siempre me siguen.'],
  ],
  clay: [
    ['¡Ja! Mis Pokémon salen de la mina listos para todo.', 'Me ganaste limpio. Respeto.', '¡Ja! Listos para todo, te dije.'],
    ['Un minero no se rinde con la primera piedra.', 'Ni con la última, pero perdí igual.', 'Piedra a piedra, se gana.'],
  ],
  skyla: [
    ['¡Despeguemos! Mis Pokémon y yo surcamos el cielo.', '¡Qué vuelo el tuyo!', '¡Despegue perfecto, aterrizaje perfecto!'],
    ['Piloto carga y Pokémon. ¡Hoy te llevo a ti… al suelo!', 'Me llevaste tú a mí.', '¡Entrega completada!'],
  ],
  brycen: [
    ['El frío forja el carácter. Veamos el tuyo.', 'Tu carácter es firme.', 'Tu carácter aún no está forjado.'],
    ['En el cine hice de villano. Hoy también.', 'El villano perdió, como en las películas.', 'Esta vez gana el villano.'],
  ],
  drayden: [
    ['Un dragón pelea con el corazón. ¿Y tú?', 'Tu corazón es fuerte.', 'Te faltó corazón.'],
    ['Soy alcalde y líder. Hoy, solo líder.', 'El alcalde felicita al ganador.', 'Decreto oficial: perdiste.'],
  ],
  iris: [
    ['¡Mis dragones y yo vamos con todo! ¿List{o}?', '¡Uf! ¡Eres demasiado fuerte!', '¡Con todo, te dije!'],
    ['¡Crecí en el pueblo de los dragones! ¡Nada me asusta!', '¡Bueno, tú un poco!', '¡Nada me asusta! ¡Y menos tú!'],
  ],
  roxie: [
    ['¡Sube el volumen! ¡Esta pelea va a ser un concierto!', '¡Qué tocata! Me ganaste.', '¡Concierto de veneno! ¡Otra, otra!'],
    ['¡Mi banda y mis Pokémon tocan veneno puro!', 'Se me desafinó el veneno.', '¡Veneno puro, te dije!'],
  ],
  marlon: [
    ['¡Las olas me traen buena onda! Peleemos.', 'Me dejaste sin onda.', '¡Buena onda, buena ola, buena pelea!'],
    ['¡El mar es enorme y yo soy el más fuerte de él!', 'Ok, el segundo más fuerte.', '¡El más fuerte del mar!'],
  ],
  alder: [
    ['Pelear es disfrutar con tus Pokémon. ¡Disfrutemos!', 'Qué bien lo pasé. Gracias.', '¿Lo disfrutaste? Yo, mucho.'],
    ['He viajado por todo Unova buscando entrenadores como tú.', 'Encontré lo que buscaba.', 'Sigo buscando, parece.'],
  ],
  viola: [
    ['¡Click! Quiero una foto de tu cara cuando pierdas.', 'La foto salió movida…', '¡Click! ¡Foto perfecta!'],
    ['Mis bichos posan mejor que nadie.', 'Hoy posaron mal.', '¡Posaron perfecto!'],
  ],
  grant: [
    ['Escalar es superar obstáculos. Tú eres mi obstáculo.', 'Me superaste.', 'Obstáculo superado.'],
    ['Cada roca es un desafío. Y tú también.', 'Desafío fallido. Por mí.', 'Desafío cumplido.'],
  ],
  korrina: [
    ['¡Patines puestos y puños listos! ¡Vamos!', '¡Uf! Me caí de los patines.', '¡Patinada y victoria!'],
    ['¡Mi abuelo me enseñó la Megaevolución! ¡Mira!', '¡Abuelo, necesito más clases!', '¡Gracias, abuelo!'],
  ],
  ramos: [
    ['Ja. Este viejo jardinero aún tiene fuerza.', 'Creciste más rápido que mis plantas.', 'Ja. Las raíces viejas son fuertes.'],
    ['Las plantas crecen despacio, pero firme.', 'Tú creciste más rápido.', 'Despacio y firme, te dije.'],
  ],
  clemont: [
    ['¡Mi nuevo invento calculó que voy a ganar!', 'Necesito ajustar el invento…', '¡El invento funcionó! ¡Por fin!'],
    ['¡El futuro es ahora! ¡Gracias a la ciencia!', '¡El futuro explotó!', '¡La ciencia gana!'],
  ],
  valerie: [
    ['Como una mariposa… mi pelea será suave y fatal.', 'Qué elegancia la tuya.', 'Suave y fatal, como prometí.'],
    ['Diseño vestidos inspirados en las hadas. Y estrategias también.', 'Esta estrategia no estaba bien cosida.', 'Diseño perfecto.'],
  ],
  olympia: [
    ['Las estrellas dicen que esta pelea será inolvidable.', 'Las estrellas tenían razón.', 'Las estrellas lo sabían.'],
    ['Veo tu futuro en el cielo nocturno.', 'Tu futuro brilla más de lo que vi.', 'Tu futuro… no es hoy.'],
  ],
  wulfric: [
    ['¡Ja, ja! ¡Hace frío aquí! ¡Calentémonos peleando!', 'Me calentaste de verdad.', '¡Ja, ja! ¡Ahora sí estoy calentito!'],
    ['¡Mi Avalugg es como un iceberg! ¡Enorme y duro!', '¡Se derritió el iceberg!', '¡Iceberg a la vista!'],
  ],
  diantha: [
    ['Una pelea es un escenario. ¿Brillamos juntos?', 'Qué actuación tan hermosa la tuya.', 'El aplauso es para mí esta vez.'],
    ['En el cine siempre gano el papel principal.', 'Hoy el protagonista fuiste tú.', 'El papel principal sigue siendo mío.'],
  ],
  malva: [
    ['Soy Malva, del Alto Mando. Y odio perder.', 'Lo odio. De verdad lo odio.', 'Era obvio. No pierdo.'],
    ['¿Sabes cuánto fuego cabe en un solo Pokémon? Mucho.', 'Me apagaste. Qué molestia.', 'Mucho fuego, te dije.'],
  ],
  siebold: [
    ['Cocino como peleo: con precisión.', 'Un plato que no esperaba.', 'Precisión. Servido.'],
    ['Una pelea es un plato. Cada movimiento, un ingrediente.', 'Me faltó un ingrediente.', 'Receta perfecta.'],
  ],
  wikstrom: [
    ['¡Soy un caballero de acero! ¡En guardia!', '¡Me inclino ante tu nobleza!', '¡El acero del caballero no se quiebra!'],
    ['¡Mi espada y mi honor están listos!', '¡Mi honor está intacto, mi espada no!', '¡Honor y victoria!'],
  ],
  drasna: [
    ['Oh, qué adorable. ¿Peleamos un ratito?', 'Ay, eres más fuerte de lo que parecía.', 'Un ratito bastó, ¿ves?'],
    ['Mis dragones son tranquilos… hasta que no.', 'Hoy fueron muy tranquilos.', 'Te dije: hasta que no.'],
  ],
  hala: [
    ['¡Mis Pokémon y yo somos fuertes como una montaña!', '¡Qué fuerza la tuya!', '¡Fuertes como una montaña! ¡Ja!'],
    ['¡Soy el kahuna de Melemele! ¡Prueba mi fuerza!', '¡La isla te reconoce!', '¡La isla me da fuerza!'],
  ],
  olivia: [
    ['Mis Pokémon son tan sólidos como las rocas de esta isla.', 'Me dejaste sin palabras.', 'Sólidos, te dije.'],
    ['Vendo joyas. ¿Quieres una? Gánatela.', 'Toma, te la ganaste.', 'Te quedaste sin joya.'],
  ],
  acerola: [
    ['¡Je, je! ¿Te gustan los fantasmas? A mí me encantan.', 'Mis fantasmitas se asustaron.', '¡Je, je! ¡Los fantasmas ganan!'],
    ['¡Vivo en una casa embrujada! ¡Es lo máximo!', 'Me voy a esconder en el armario.', '¡Lo máximo! ¡Te lo dije!'],
  ],
  kahili: [
    ['Juego al golf con la misma precisión con que peleo.', 'Hoyo en uno… para ti.', 'Hoyo en uno. Como siempre.'],
    ['Mis pájaros apuntan mejor que mis palos de golf.', 'Hoy apuntaron mal.', 'Directo al hoyo.'],
  ],
  molayne: [
    ['Mis Pokémon de acero son tan pulidos como mis cálculos.', 'Un error en mis cálculos.', 'Cálculos exactos.'],
    ['Investigo los cielos desde el observatorio. Hoy, a ti.', 'Descubrí una estrella nueva: tú.', 'Observación completa.'],
  ],
  kukui: [
    ['¡Woo! ¡Me encanta ver entrenadores fuertes!', '¡Woo! ¡Qué movimientos!', '¡Woo! ¡Todavía tienes mucho que aprender!'],
    ['¡Investigo movimientos Pokémon recibiéndolos en el cuerpo!', '¡Ay! ¡Ese sí lo sentí!', '¡Woo! ¡Investigación exitosa!'],
  ],
  hau: [
    ['¡Vamos con todo! ¡Pero primero un malasada!', '¡Uf, qué buena pelea! ¿Vamos por malasadas?', '¡Gané! ¡Las malasadas las pagas tú!'],
    ['¡Mi abuelo Hala me entrenó! ¡Mira!', '¡Abuelo, perdí!', '¡Abuelo, gané!'],
  ],
  milo: [
    ['Eh… hola. Mis Pokémon planta están felices. ¿Peleamos?', 'Me ganaste limpiamente.', 'Felices y ganadores.'],
    ['Trabajo en la granja. Cosecho fuerza todos los días.', 'Mala cosecha, hoy.', 'Buena cosecha.'],
  ],
  nessa: [
    ['Sobre el agua o sobre la pasarela, siempre gano.', 'Hoy no fue mi día.', 'Siempre gano, te dije.'],
    ['Las olas no se detienen. Yo tampoco.', 'Me detuviste tú.', 'Ni las olas ni yo.'],
  ],
  kabu: [
    ['Llevo años entrenando. El fuego no se apaga.', 'Tu fuego es más intenso.', 'El fuego no se apaga. Te lo dije.'],
    ['Mi edad es mi ventaja: tengo más experiencia.', 'Tu juventud ganó hoy.', 'La experiencia gana.'],
  ],
  bea: [
    ['Mis puños son tan duros como mi voluntad.', 'Volveré a entrenar.', 'Tan duros como te dije.'],
    ['Entreno cada segundo. Hasta comiendo.', 'Comí poco hoy.', 'Cada segundo cuenta.'],
  ],
  allister: [
    ['…Hola. Mis fantasmas… quieren jugar.', '…Bien jugado.', '…Ganamos. Gracias por jugar.'],
    ['…Esta máscara me protege. De ti.', '…No me protegió.', '…Me protegió bien.'],
  ],
  opal: [
    ['Te haré una pregunta: ¿cuál es mi color favorito?', 'Rosado, querid{o}. Pero ganaste igual.', 'Rosado. Y perdiste. Qué decepción.'],
    ['Busco a quien me reemplace. ¿Tienes lo necesario?', 'Tal vez sí lo tienes.', 'Todavía no. Te falta encanto.'],
  ],
  gordie: [
    ['Mis Pokémon de roca son puro estilo.', 'Me quitaste el estilo.', 'Puro estilo, te dije.'],
    ['Mi mamá es líder de gimnasio. Yo, mejor.', 'Mi mamá se va a reír.', 'Mejor que mi mamá. Te lo dije.'],
  ],
  melony: [
    ['Ven, querid{o}. El frío no muerde… mucho.', 'Ay, qué bien lo hiciste.', 'Mordió un poquito, ¿cierto?'],
    ['Tengo muchos hijos. Y todos me temen en una pelea.', 'Ahora mis hijos se van a reír.', 'Como mis hijos, ahora me temes.'],
  ],
  piers: [
    ['Esta pelea será mi nueva canción.', 'Una canción triste… para mí.', 'Canción terminada. Éxito total.'],
    ['Spikemuth no tiene estadio, pero tiene corazón.', 'El corazón no bastó.', 'Corazón de Spikemuth.'],
  ],
  raihan: [
    ['¡Selfie antes de la pelea! Ahora sí, a ganar.', 'Esta foto no la voy a subir.', '¡Selfie de la victoria!'],
    ['Mi meta es ganarle a Leon. Tú eres el calentamiento.', 'Calentamiento fallido.', 'Calentamiento listo.'],
  ],
  leon: [
    ['¡Hagamos de esta pelea un campeonato inolvidable!', '¡Qué combate! Esto merece una foto.', '¡Un campeonato inolvidable! ¡Y sigo invicto!'],
    ['¡Mi Charizard y yo nunca hemos perdido!', '¡Hasta hoy! ¡Qué emoción!', '¡Nunca! ¡Te lo dije!'],
  ],
  katy: [
    ['¡Hola! Te preparé unos dulces. Después de la pelea, eso sí.', '¡Me ganaste! Igual te doy los dulces.', '¡Gané! Los dulces son para mis bichos.'],
    ['Cocino y peleo con el mismo cariño.', 'Se me quemó el horno.', '¡Recién horneada, la victoria!'],
  ],
  brassius: [
    ['¡El arte es explosión! ¡Esta pelea será mi obra!', 'Mi obra quedó inconclusa.', '¡Obra terminada! ¡Explosión de arte!'],
    ['Cada planta es una escultura viva.', 'Me desarmaste la escultura.', 'Escultura perfecta.'],
  ],
  iono: [
    ['¡Hola, hola, electrofans! ¡Hoy transmitimos en vivo tu derrota!', '¡Corten, corten! Bueno… ¡igual fue un éxito de audiencia!', '¡Récord de audiencia! ¡Gracias por participar!'],
    ['¡No olvides suscribirte! ¡Y perder!', '¡Me desuscribo de esta pelea!', '¡Dale like a tu derrota!'],
  ],
  kofu: [
    ['¡Fresco como el pescado del mercado! ¡A pelear!', 'Me dejaste fuera de temporada.', '¡Fresquito, como te dije!'],
    ['¡Vengo del mercado y traigo energía de sobra!', 'Se me echó a perder la mercadería.', '¡Mercadería de primera!'],
  ],
  ryme: [
    ['¡Yo, yo! ¡Mis rimas pegan fuerte!', 'Me quedé sin rima.', '¡Rima perfecta, victoria completa!'],
    ['¡Escucha este verso, que te va a dar miedo!', 'Me quedé sin verso y sin juego.', '¡Verso final, perdiste, es normal!'],
  ],
  tulip: [
    ['La belleza tiene muchas formas. Te mostraré la mía.', 'Qué belleza la tuya.', 'Belleza y fuerza. Te lo dije.'],
    ['Maquillo a los mejores. Hoy maquillo tu derrota.', 'Se me corrió el maquillaje.', 'Maquillaje perfecto.'],
  ],
  grusha: [
    ['Me enfrío antes de pelear. ¿Y tú?', 'Me derretiste un poco.', 'Frío y sin errores.'],
    ['Antes era snowboarder. Ahora peleo en la nieve.', 'Me caí en la pista.', 'Bajada perfecta.'],
  ],
  larry: [
    ['Trabajé todo el día. Peleemos rápido, ¿ya?', 'Bueno, me voy a casa.', 'Rápido, como te pedí. Me voy a casa.'],
    ['Lo normal es lo mejor. Mis Pokémon son normales.', 'Lo normal no bastó.', 'Lo normal ganó.'],
  ],
  rika: [
    ['Uy, ¿te pusiste nervios{o}? Tranqui, peleemos.', 'Me dejaste sin preguntas.', 'Se te notaron los nervios.'],
    ['Hagamos una entrevista. Primera pregunta: ¿quién gana?', 'Respuesta: tú.', 'Respuesta: yo. Siguiente.'],
  ],
  poppy: [
    ['¡Hola! ¡Soy chiquita pero peleo grande!', '¡Bua! ¡Eres muy fuerte!', '¡Chiquita pero ganadora!'],
    ['¡Mi martillo es más grande que yo! ¡Y pega más fuerte!', '¡Se me cayó el martillo!', '¡Martillazo de victoria!'],
  ],
  hassel: [
    ['El arte de pelear con dragones requiere pasión.', 'Qué obra de arte tu pelea.', 'Pasión pura. Te lo dije.'],
    ['Enseño arte en la academia. Hoy enseño a perder.', 'La clase fue para mí.', 'Clase terminada.'],
  ],
  geeta: [
    ['Como presidenta de la liga, voy a medirte con justicia.', 'Has demostrado tu valía. Sigue así.', 'La liga todavía no te aprueba.'],
    ['Evalúo a cada entrenador que pisa esta torre.', 'Nota máxima.', 'Nota insuficiente.'],
  ],
  nemona: [
    ['¡Por fin un rival que vale la pena! ¡Peleemos!', '¡Qué buena pelea! Volvamos a hacerlo pronto.', '¡Gané! ¡Otra, otra, otra!'],
    ['¡Llevo esperando esta pelea desde que entraste!', '¡Valió la pena la espera!', '¡Valió la espera! Para mí, al menos.'],
  ],
  kieran: [
    ['Esta vez no voy a perder. Esta vez soy más fuerte.', '¿Por qué… por qué sigo perdiendo?', 'Te dije que esta vez era más fuerte.'],
    ['Entrené solo, sin descanso. Por esto.', 'No fue suficiente…', 'Por fin. Por fin te gané.'],
  ],
  amarys: [
    ['Volar es libertad. Perder, no tanto.', 'Libre de mi orgullo, ahora.', 'Libertad total.'],
    ['Mis Pokémon de acero vuelan alto.', 'Aterrizaron de golpe.', 'Más alto que nadie.'],
  ],
  lacey: [
    ['¡Las reglas son las reglas! Y la regla dice que gano yo.', '¡Infracción! Mía.', '¡Regla cumplida!'],
    ['¡Hora de una pelea limpia y ordenada!', 'Ordenada, pero perdida.', '¡Ordenada y ganada!'],
  ],
  drayton: [
    ['Uf, ¿ya me toca? Bueno, peleemos.', 'Mejor vuelvo a dormir.', 'Listo. Ahora sí, a dormir.'],
    ['Los dragones son flojos como yo. Hasta que pelean.', 'Hoy fueron flojos de verdad.', 'Te dije: hasta que pelean.'],
  ],
  crispin: [
    ['¡Fuego! ¡Fuego por todas partes!', '¡Me apagaste!', '¡Fuego y más fuego!'],
    ['¡Esta pelea va a estar que arde!', 'Se enfrió todo.', '¡Ardió, te dije!'],
  ],
  marshal: [
    ['Entreno mi cuerpo y mi espíritu. ¡En guardia!', 'Mi espíritu reconoce el tuyo.', 'Cuerpo y espíritu, unidos.'],
    ['El maestro Alder me enseñó a pelear con honor.', 'Honor para el ganador.', 'Honor y victoria.'],
  ],
  grimsley: [
    ['Ganar o perder es cuestión de suerte. Y la mía es buena.', 'La suerte cambió de lado.', 'La suerte nunca me abandona.'],
    ['¿Apostamos? Mi Pokémon contra el tuyo.', 'Perdí la apuesta.', 'Apuesta ganada.'],
  ],
  caitlin: [
    ['Me despertaste. Espero que valga la pena.', 'Valió la pena. Ahora vuelvo a dormir.', 'No valió la pena. Vuelvo a dormir.'],
    ['Una dama siempre pelea con elegancia.', 'Una derrota elegante, al menos.', 'Elegancia y victoria.'],
  ],
  shauntal: [
    ['Escribo novelas sobre las peleas. Esta será un capítulo.', 'Un capítulo trágico.', 'Un capítulo glorioso.'],
    ['Mis fantasmas me inspiran. ¡Y pelean!', 'Me quedé sin inspiración.', '¡Inspiración total!'],
  ],
  // The villains who wait in a hideout: admins, squad bosses and team bosses.
  archer: [
    ['El Team Rocket volverá a su gloria. Empezando por ti.', 'Volveremos. Siempre volvemos.', 'La gloria del Team Rocket empieza hoy.'],
    ['Giovanni volverá. Y yo prepararé su regreso.', 'Giovanni no puede saber de esto.', 'Giovanni estará orgulloso.'],
  ],
  ariana: [
    ['¿Un niño en el escondite del Team Rocket? Qué molestia.', 'Qué humillación.', 'Molestia eliminada.'],
    ['El Team Rocket no perdona a los curiosos.', 'Hoy perdonamos.', 'Te dije que no perdonábamos.'],
  ],
  petrel: [
    ['¿Yo? ¿El jefe? ¡Claro que sí! Bueno, no.', '¡Me descubriste!', '¡Ja! ¡Te engañé!'],
    ['Me disfrazo de cualquiera. Hasta de ganador.', 'El disfraz se cayó.', 'Disfraz de ganador. Me queda bien.'],
  ],
  proton: [
    ['Dicen que soy el más cruel del Team Rocket. Es verdad.', 'Cruel, pero perdedor.', 'Te dije que era cruel.'],
    ['No me importa a quién lastimo.', 'Me lastimaste tú.', 'Ni me importó.'],
  ],
  courtney: [
    ['…Análisis completo. Vas a perder.', '…Error de cálculo.', '…Análisis correcto.'],
    ['…Maxie me lo pidió. Lo haré.', '…Maxie… perdón.', '…Maxie, cumplí.'],
  ],
  tabitha: [
    ['¡Je, je! ¡El Team Magma no se detiene!', '¡No puede ser!', '¡Je, je! ¡Te dije que no nos deteníamos!'],
    ['El jefe Maxie tiene un plan. Y tú no estás en él.', 'El jefe no va a estar contento.', 'El plan sigue en marcha.'],
  ],
  shelly: [
    ['¡Ja! ¡El Team Aqua te va a dar una lección!', 'Me la diste tú.', '¡Lección dada!'],
    ['¿Te gusta el mar? Te vas a hundir en él.', 'Me hundí yo.', '¡Al fondo del mar! Tú, no yo.'],
  ],
  mars: [
    ['¡El Team Galaxia tiene grandes planes! Y tú no estás en ellos.', '¡Qué rabia!', '¡Grandes planes! ¡Te lo dije!'],
    ['Cyrus confía en mí. No lo voy a defraudar.', 'Cyrus… lo siento.', 'Cyrus, misión cumplida.'],
  ],
  jupiter: [
    ['Qué interesante. Un entrenador que no sabe cuándo rendirse.', 'Ok, sabes pelear.', 'Debiste rendirte.'],
    ['El Team Galaxia moldeará un nuevo universo.', 'Este universo te prefiere a ti.', 'Un universo nuevo, sin ti.'],
  ],
  saturn: [
    ['Cumplo órdenes. Y la orden es detenerte.', 'Orden fallida.', 'Orden cumplida.'],
    ['No hay nada personal. Es solo trabajo.', 'Ahora sí es personal.', 'Solo trabajo. Bien hecho.'],
  ],
  zinzolin: [
    ['El hielo del Team Plasma congelará Unova.', 'Me congelé yo.', 'Unova se congelará. Te lo dije.'],
    ['Ghetsis tiene un plan. Yo lo ejecuto.', 'Ghetsis no va a estar contento.', 'Plan ejecutado.'],
  ],
  ghetsis: [
    ['¡Los Pokémon son herramientas! ¡Y tú eres un estorbo!', '¡No… mis planes!', '¡Estorbo eliminado!'],
    ['Yo controlo al Team Plasma. Y controlaré el mundo.', 'Mi control… se escapa.', 'Todo bajo control.'],
  ],
  lysandre: [
    ['El mundo será bello. Aunque tenga que destruirlo.', 'Así que este es el futuro que eliges.', 'El mundo bello que prometí empieza hoy.'],
    ['Las personas como tú no tienen lugar en mi mundo.', 'Parece que sí lo tienes.', 'No tienes lugar. Te lo advertí.'],
  ],
  xerosic: [
    ['¡La ciencia del Team Flare es superior!', 'Mis cálculos fallaron.', '¡Ciencia superior!'],
    ['Interesante espécimen. ¿Te molesta si te estudio?', 'El espécimen era yo.', 'Estudio completo.'],
  ],
  celosia: [
    ['La belleza del Team Flare te deslumbrará.', 'Qué feo perder.', 'Bello, ¿no?'],
    ['Mis Pokémon son tan elegantes como mi traje.', 'Se me arrugó el traje.', 'Elegancia pura.'],
  ],
  aliana: [
    ['El Team Flare no tolera intrusos.', 'Intruso victorioso. Qué molestia.', 'Intruso eliminado.'],
    ['¿Sabes cuánto cuesta este traje? Más que tu vida.', 'Arruinaste el traje.', 'Ni una mancha.'],
  ],
  bryony: [
    ['Analizo cada movimiento. El tuyo es predecible.', 'No tan predecible.', 'Predecible, como dije.'],
    ['El Team Flare necesita datos. Los tuyos servirán.', 'Datos inesperados.', 'Datos recopilados.'],
  ],
  mable: [
    ['El Team Flare tiene estilo. ¿Y tú?', 'Tienes estilo, lo admito.', 'Sin estilo, sin victoria.'],
    ['Investigo la energía de los Pokémon. Hoy, la de los tuyos.', 'Energía inesperada.', 'Energía agotada.'],
  ],
  plumeria: [
    ['Si te metes con mis chiquillos, te metes conmigo.', 'Ok, me rindo. Eres fuerte.', 'Te advertí que no te metieras con ellos.'],
    ['Guzma me hizo hermana mayor del Team Skull. Y cuido a los míos.', 'Hoy no los pude cuidar.', 'Los míos están a salvo.'],
  ],
  guzma: [
    ['¡Guzma es el que destruye todo! ¡Hasta a ti!', '¡Ahhh! ¡Otra vez!', '¡Destrucción total! ¡Como te dije!'],
    ['¡El Team Skull es mi familia! ¡Y nadie toca a mi familia!', '¡Ahhh! ¡No puede ser!', '¡Nadie toca a mi familia!'],
  ],
  faba: [
    ['¡Soy el director de la Fundación Æther! ¡Retírese!', '¡Esto arruina mi carrera!', '¡Mi carrera sigue en alza!'],
    ['¿Sabe con quién está hablando? Con el director.', 'Con el director derrotado, parece.', 'Con el director ganador.'],
  ],
  lusamine: [
    ['Mis criaturas hermosas… nadie me las quitará.', 'No… mi belleza…', 'Nadie me las quitará. Te lo dije.'],
    ['Solo amo lo que es bello. Tú no lo eres.', 'Tu fuerza es bella. Qué rabia.', 'Lo bello gana siempre.'],
  ],
  rose: [
    ['Por el futuro de Galar, no puedo perder.', 'El futuro… es de ustedes, parece.', 'El futuro de Galar está a salvo.'],
    ['Pienso en los próximos mil años. Tú solo piensas en esta pelea.', 'Y gané esta pelea, al menos tú.', 'Mil años de ventaja.'],
  ],
  oleana: [
    ['El presidente Rose cuenta conmigo. No lo defraudaré.', 'Presidente… perdón.', 'Presidente, cumplí.'],
    ['Todo lo hago por el presidente.', 'El presidente no va a estar contento.', 'El presidente estará orgulloso.'],
  ],
  penny: [
    ['Eh… soy la jefa del Team Star. Sorpresa.', 'Ya, ya. Ganaste.', 'Sorpresa doble: gané.'],
    ['Me gustan los Pokémon de tipo Hada. Y ganar.', 'Me gustaba más ganar.', 'Hada y victoria.'],
  ],
  giacomo: [
    ['¡Pon música, que esta pelea se baila!', 'Se acabó la canción.', '¡Beat de victoria!'],
    ['Jefe del escuadrón Siniestro. Y DJ.', 'El DJ se quedó sin música.', '¡El DJ manda!'],
  ],
  mela: [
    ['¡Escuadrón Fuego! ¡A quemar todo!', '¡Me apagaste!', '¡Todo quemado!'],
    ['¿Buscas problemas? Los encontraste.', 'Los problemas me encontraron a mí.', 'Problemas resueltos.'],
  ],
  atticus: [
    ['Escuadrón Veneno. La elegancia de un ninja.', 'Una derrota… poética.', 'Poesía en veneno.'],
    ['Mis versos son veneno puro.', 'Mis versos se secaron.', 'Verso final.'],
  ],
  ortega: [
    ['¡Escuadrón Hada! ¡Y yo soy el jefe!', '¡No es justo!', '¡Te dije que era el jefe!'],
    ['¿Te parezco chico? Pues peleo grande.', 'Bueno, hoy peleé chico.', 'Grande, te dije.'],
  ],
  eri: [
    ['Escuadrón Lucha. Puños listos.', 'Me ganaste a pulso.', 'Puños de victoria.'],
    ['No me rindo. Nunca.', 'Hoy… sí.', 'Nunca, te dije.'],
  ],
  rood: [
    ['El Team Plasma liberará a los Pokémon. Con o sin tu ayuda.', 'Quizás… los tuyos ya son libres.', 'Liberados. Como prometí.'],
    ['Soy uno de los Siete Sabios. Escucha mi sabiduría.', 'La sabiduría estaba en ti.', 'Sabiduría y victoria.'],
  ],
  matt: [
    ['¡Uuuh! ¡El Team Aqua te va a hundir!', '¡Uuuh! ¡Me hundí yo!', '¡Uuuh! ¡Hundido!'],
    ['¡Archie, mira! ¡Le voy a ganar!', '¡Archie, perdón!', '¡Archie, gané!'],
  ],
  archie: [
    ['¡El Team Aqua hará crecer los mares! ¡Fuera de mi camino!', 'Tal vez… los mares ya son lo bastante grandes.', '¡Los mares crecen! ¡Te lo dije!'],
    ['El mar es el origen de todo. Y tu derrota.', 'El mar te eligió a ti.', 'El mar decidió.'],
  ],
  maxie: [
    ['El Team Magma ampliará la tierra para todos. No me detendrás.', 'Tal vez me equivoqué…', 'No me detuviste. Te lo dije.'],
    ['Más tierra, más espacio para los humanos y los Pokémon.', 'Quizás hay espacio suficiente.', 'Espacio para todos. Menos para ti.'],
  ],
  cyrus: [
    ['Las emociones son debilidad. Te lo demostraré.', 'Imposible… ¿emociones?', 'Demostrado. Sin emociones se gana.'],
    ['Crearé un universo perfecto. Sin errores. Sin ti.', 'El error fui yo.', 'Universo perfecto.'],
  ],
};
