import type { ImageSourcePropType } from 'react-native'

declare const require: (path: string) => ImageSourcePropType

export const defaultActivityImage = require('../assets/images/categories/default-activity.jpg')

const yogaImages = [
  require('../assets/images/activities/yoga/yoga-1.png'),
  require('../assets/images/activities/yoga/yoga-2.png'),
  require('../assets/images/activities/yoga/yoga-3.png'),
]

const yogaImage =
  yogaImages[Math.floor(Math.random() * yogaImages.length)]
const runningImages = [
  require('../assets/images/activities/running/running-1.png'),
  require('../assets/images/activities/running/running-2.png'),
  require('../assets/images/activities/running/running-3.png'),
]

const runningImage =
  runningImages[Math.floor(Math.random() * runningImages.length)]
const supImages = [
  require('../assets/images/activities/sup/sup-1.png'),
  require('../assets/images/activities/sup/sup-2.png'),
  require('../assets/images/activities/sup/sup-3.png'),
]

const supImage =
  supImages[Math.floor(Math.random() * supImages.length)]
const cafeImages = [
  require('../assets/images/activities/cafe/cafe-1.png'),
  require('../assets/images/activities/cafe/cafe-2.png'),
  require('../assets/images/activities/cafe/cafe-3.png'),
]

const cafeImage =
  cafeImages[Math.floor(Math.random() * cafeImages.length)]
const musicaImages = [
  require('../assets/images/activities/musica/musica-1.png'),
  require('../assets/images/activities/musica/musica-2.png'),
  require('../assets/images/activities/musica/musica-3.png'),
]

const musicaImage =
  musicaImages[Math.floor(Math.random() * musicaImages.length)]
const senderismoImages = [
  require('../assets/images/activities/senderismo/senderismo-1.png'),
  require('../assets/images/activities/senderismo/senderismo-2.png'),
  require('../assets/images/activities/senderismo/senderismo-3.png'),
]

const senderismoImage =
  senderismoImages[Math.floor(Math.random() * senderismoImages.length)]
const equitacionImages = [
  require('../assets/images/activities/equitacion/equitacion-1.png'),
  require('../assets/images/activities/equitacion/equitacion-2.png'),
  require('../assets/images/activities/equitacion/equitacion-3.png'),
]

const equitacionImage =
  equitacionImages[Math.floor(Math.random() * equitacionImages.length)]
const futbolImages = [
  require('../assets/images/activities/futbol/futbol-1.png'),
  require('../assets/images/activities/futbol/futbol-2.png'),
  require('../assets/images/activities/futbol/futbol-3.png'),
]

const futbolImage =
  futbolImages[Math.floor(Math.random() * futbolImages.length)]
const tenisImages = [
  require('../assets/images/activities/tenis/tenis-1.png'),
  require('../assets/images/activities/tenis/tenis-2.png'),
  require('../assets/images/activities/tenis/tenis-3.png'),
]

const tenisImage =
  tenisImages[Math.floor(Math.random() * tenisImages.length)]
const basquetImages = [
  require('../assets/images/activities/basquet/basquet-1.png'),
  require('../assets/images/activities/basquet/basquet-2.png'),
  require('../assets/images/activities/basquet/basquet-3.png'),
]

const basquetImage =
  basquetImages[Math.floor(Math.random() * basquetImages.length)]
const beachvoleyImages = [
  require('../assets/images/activities/beachvoley/beachvoley-1.png'),
  require('../assets/images/activities/beachvoley/beachvoley-2.png'),
  require('../assets/images/activities/beachvoley/beachvoley-3.png'),
]

const beachvoleyImage =
  beachvoleyImages[Math.floor(Math.random() * beachvoleyImages.length)]
const newcomImages = [
  require('../assets/images/activities/newcom/newcom-1.png'),
  require('../assets/images/activities/newcom/newcom-2.png'),
  require('../assets/images/activities/newcom/newcom-3.png'),
]

const newcomImage =
  newcomImages[Math.floor(Math.random() * newcomImages.length)]
const padelImages = [
  require('../assets/images/activities/padel/padel-1.png'),
  require('../assets/images/activities/padel/padel-2.png'),
  require('../assets/images/activities/padel/padel-3.png'),
]

const padelImage =
  padelImages[Math.floor(Math.random() * padelImages.length)]
const pescaImages = [
  require('../assets/images/activities/pesca/pesca-1.png'),
  require('../assets/images/activities/pesca/pesca-2.png'),
  require('../assets/images/activities/pesca/pesca-3.png'),
]

const pescaImage =
  pescaImages[Math.floor(Math.random() * pescaImages.length)]
const cocinaImages = [
  require('../assets/images/activities/cocina/cocina-1.png'),
  require('../assets/images/activities/cocina/cocina-2.png'),
  require('../assets/images/activities/cocina/cocina-3.png'),
]

const cocinaImage =
  cocinaImages[Math.floor(Math.random() * cocinaImages.length)]
const juegosdemesaImages = [
  require('../assets/images/activities/juegosdemesa/juegosdemesa-1.png'),
  require('../assets/images/activities/juegosdemesa/juegosdemesa-2.png'),
  require('../assets/images/activities/juegosdemesa/juegosdemesa-3.png'),
]

const juegosdemesaImage =
  juegosdemesaImages[Math.floor(Math.random() * juegosdemesaImages.length)]
const idiomasImages = [
  require('../assets/images/activities/idiomas/idiomas-1.png'),
  require('../assets/images/activities/idiomas/idiomas-2.png'),
  require('../assets/images/activities/idiomas/idiomas-3.png'),
]

const idiomasImage =
  idiomasImages[Math.floor(Math.random() * idiomasImages.length)]
const meditacionImages = [
  require('../assets/images/activities/meditacion/meditacion-1.png'),
  require('../assets/images/activities/meditacion/meditacion-2.png'),
  require('../assets/images/activities/meditacion/meditacion-3.png'),
]

const meditacionImage =
  meditacionImages[Math.floor(Math.random() * meditacionImages.length)]
const kayakImages = [
  require('../assets/images/activities/kayak/kayak-1.png'),
  require('../assets/images/activities/kayak/kayak-2.png'),
  require('../assets/images/activities/kayak/kayak-3.png'),
]

const kayakImage =
  kayakImages[Math.floor(Math.random() * kayakImages.length)]
const natacionImages = [
  require('../assets/images/activities/natacion/natacion-1.png'),
  require('../assets/images/activities/natacion/natacion-2.png'),
  require('../assets/images/activities/natacion/natacion-3.png'),
]

const natacionImage =
  natacionImages[Math.floor(Math.random() * natacionImages.length)]
const natacionAguasAbiertasImages = [
  require('../assets/images/activities/natacionaguasabiertas/natacionaguasabiertas-1.png'),
  require('../assets/images/activities/natacionaguasabiertas/natacionaguasabiertas-2.png'),
  require('../assets/images/activities/natacionaguasabiertas/natacionaguasabiertas-3.png'),
]

const natacionAguasAbiertasImage =
  natacionAguasAbiertasImages[Math.floor(Math.random() * natacionAguasAbiertasImages.length)]
const surfImages = [
  require('../assets/images/activities/surf/surf-1.png'),
  require('../assets/images/activities/surf/surf-2.png'),
  require('../assets/images/activities/surf/surf-3.png'),
]

const surfImage =
  surfImages[Math.floor(Math.random() * surfImages.length)]
const pilatesImages = [
  require('../assets/images/activities/pilates/pilates-1.png'),
  require('../assets/images/activities/pilates/pilates-2.png'),
  require('../assets/images/activities/pilates/pilates-3.png'),
]

const pilatesImage =
  pilatesImages[Math.floor(Math.random() * pilatesImages.length)]
const pinturaImages = [
  require('../assets/images/activities/pintura/pintura-1.png'),
  require('../assets/images/activities/pintura/pintura-2.png'),
  require('../assets/images/activities/pintura/pintura-3.png'),
]

const pinturaImage =
  pinturaImages[Math.floor(Math.random() * pinturaImages.length)]
const ceramicaImages = [
  require('../assets/images/activities/ceramica/ceramica-1.png'),
  require('../assets/images/activities/ceramica/ceramica-2.png'),
  require('../assets/images/activities/ceramica/ceramica-3.png'),
]

const ceramicaImage =
  ceramicaImages[Math.floor(Math.random() * ceramicaImages.length)]
const fotografiaImages = [
  require('../assets/images/activities/fotografia/fotografia-1.png'),
  require('../assets/images/activities/fotografia/fotografia-2.png'),
  require('../assets/images/activities/fotografia/fotografia-3.png'),
]

const fotografiaImage =
  fotografiaImages[Math.floor(Math.random() * fotografiaImages.length)]
const tangoImages = [
  require('../assets/images/activities/tango/tango-1.png'),
  require('../assets/images/activities/tango/tango-2.png'),
  require('../assets/images/activities/tango/tango-3.png'),
]

const tangoImage =
  tangoImages[Math.floor(Math.random() * tangoImages.length)]
const folkloreImages = [
  require('../assets/images/activities/folklore/folklore-1.png'),
  require('../assets/images/activities/folklore/folklore-2.png'),
  require('../assets/images/activities/folklore/folklore-3.png'),
]

const folkloreImage =
  folkloreImages[Math.floor(Math.random() * folkloreImages.length)]
const motosImages = [
  require('../assets/images/activities/motos/motos-1.png'),
  require('../assets/images/activities/motos/motos-2.png'),
  require('../assets/images/activities/motos/motos-3.png'),
]

const motosImage =
  motosImages[Math.floor(Math.random() * motosImages.length)]
const teatroImages = [
  require('../assets/images/activities/teatro/teatro-1.png'),
  require('../assets/images/activities/teatro/teatro-2.png'),
  require('../assets/images/activities/teatro/teatro-3.png'),
]

const teatroImage =
  teatroImages[Math.floor(Math.random() * teatroImages.length)]
const astrologiaImages = [
  require('../assets/images/activities/astrologia/astrologia-1.png'),
  require('../assets/images/activities/astrologia/astrologia-2.png'),
  require('../assets/images/activities/astrologia/astrologia-3.png'),
]

const astrologiaImage =
  astrologiaImages[Math.floor(Math.random() * astrologiaImages.length)]
const eventosImages = [
  require('../assets/images/activities/eventos/eventos-1.png'),
  require('../assets/images/activities/eventos/eventos-2.png'),
  require('../assets/images/activities/eventos/eventos-3.png'),
]

const eventosImage =
  eventosImages[Math.floor(Math.random() * eventosImages.length)]
const gamingImage = require('../assets/images/categories/placeholder-gaming.jpg')
const mateadaImages = [
  require('../assets/images/activities/mateada/mateada-1.png'),
  require('../assets/images/activities/mateada/mateada-2.png'),
  require('../assets/images/activities/mateada/mateada-3.png'),
]

const mateadaImage =
  mateadaImages[Math.floor(Math.random() * mateadaImages.length)]
const ciclismoImages = [
  require('../assets/images/activities/ciclismo/ciclismo-1.png'),
  require('../assets/images/activities/ciclismo/ciclismo-2.png'),
  require('../assets/images/activities/ciclismo/ciclismo-3.png'),
]

const ciclismoImage =
  ciclismoImages[Math.floor(Math.random() * ciclismoImages.length)]
const ciclismoIndoorImages = [
  require('../assets/images/activities/ciclismoindoor/ciclismoindoor-1.png'),
  require('../assets/images/activities/ciclismoindoor/ciclismoindoor-2.png'),
  require('../assets/images/activities/ciclismoindoor/ciclismoindoor-3.png'),
]

const ciclismoIndoorImage =
  ciclismoIndoorImages[Math.floor(Math.random() * ciclismoIndoorImages.length)]
const entrenamientoImages = [
  require('../assets/images/activities/entrenamiento/entrenamiento-1.png'),
  require('../assets/images/activities/entrenamiento/entrenamiento-2.png'),
  require('../assets/images/activities/entrenamiento/entrenamiento-3.png'),
]

const entrenamientoImage =
  entrenamientoImages[Math.floor(Math.random() * entrenamientoImages.length)]
const cantoImages = [
  require('../assets/images/activities/canto/canto-1.png'),
  require('../assets/images/activities/canto/canto-2.png'),
  require('../assets/images/activities/canto/canto-3.png'),
]

const cantoImage =
  cantoImages[Math.floor(Math.random() * cantoImages.length)]
const salsaImages = [
  require('../assets/images/activities/salsa/salsa-1.png'),
  require('../assets/images/activities/salsa/salsa-2.png'),
  require('../assets/images/activities/salsa/salsa-3.png'),
]

const salsaImage =
  salsaImages[Math.floor(Math.random() * salsaImages.length)]
const ritmosImages = [
  require('../assets/images/activities/ritmos/ritmos-1.png'),
  require('../assets/images/activities/ritmos/ritmos-2.png'),
  require('../assets/images/activities/ritmos/ritmos-3.png'),
]

const ritmosImage =
  ritmosImages[Math.floor(Math.random() * ritmosImages.length)]
const lecturaImages = [
  require('../assets/images/activities/lectura/lectura-1.png'),
  require('../assets/images/activities/lectura/lectura-2.png'),
  require('../assets/images/activities/lectura/lectura-3.png'),
]

const lecturaImage =
  lecturaImages[Math.floor(Math.random() * lecturaImages.length)]
const cursosTalleresCapacitacionesImages = [
  require('../assets/images/activities/cursostallerescapacitaciones/cursostallerescapacitaciones-1.png'),
  require('../assets/images/activities/cursostallerescapacitaciones/cursostallerescapacitaciones-2.png'),
  require('../assets/images/activities/cursostallerescapacitaciones/cursostallerescapacitaciones-3.png'),
]

const cursosTalleresCapacitacionesImage =
  cursosTalleresCapacitacionesImages[Math.floor(Math.random() * cursosTalleresCapacitacionesImages.length)]
const ajedrezImages = [
  require('../assets/images/activities/ajedrez/ajedrez-1.png'),
  require('../assets/images/activities/ajedrez/ajedrez-2.png'),
  require('../assets/images/activities/ajedrez/ajedrez-3.png'),
]

const ajedrezImage =
  ajedrezImages[Math.floor(Math.random() * ajedrezImages.length)]
const mascotasImages = [
  require('../assets/images/activities/mascotas/mascotas-1.png'),
  require('../assets/images/activities/mascotas/mascotas-2.png'),
  require('../assets/images/activities/mascotas/mascotas-3.png'),
]

const mascotasImage =
  mascotasImages[Math.floor(Math.random() * mascotasImages.length)]
const jardineriaImages = [
  require('../assets/images/activities/jardineria/jardineria-1.png'),
  require('../assets/images/activities/jardineria/jardineria-2.png'),
  require('../assets/images/activities/jardineria/jardineria-3.png'),
]

const jardineriaImage =
  jardineriaImages[Math.floor(Math.random() * jardineriaImages.length)]
const grupalImage = require('../assets/images/categories/placeholder-grupal.jpg')

export const categoryImages: Record<string, ImageSourcePropType> = {
  Yoga: yogaImage,
  Running: runningImage,
  SUP: supImage,
  Cafe: cafeImage,
  Musica: musicaImage,
  Senderismo: senderismoImage,
  Gaming: gamingImage,
  Mateada: mateadaImage,
  Ciclismo: ciclismoImage,
  Entrenamiento: entrenamientoImage,
  Grupales: grupalImage,
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function normalize(value: unknown) {
  return readString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getRemoteImage(data: Record<string, unknown>) {
  const candidates = [
    data.imageUrl,
    data.photoUrl,
    data.photoURL,
    data.coverImage,
    data.coverUrl,
    data.coverURL,
    data.image,
    data.imageUri,
    data.imageURL,
    data.thumbnailUrl,
  ]

  const uri = candidates.map(readString).find((value) => /^https?:\/\//i.test(value) || /^file:\/\//i.test(value))
  return uri ? { uri } : null
}

const imageRules: { image: ImageSourcePropType; terms: string[] }[] = [
  { image: equitacionImage, terms: ['equitacion', 'cabalgata', 'caballo'] },
  { image: beachvoleyImage, terms: ['beach voley', 'beach volley', 'beachvoley', 'voley playa'] },
  { image: newcomImage, terms: ['newcom'] },
  { image: natacionAguasAbiertasImage, terms: ['natacion aguas abiertas', 'aguas abiertas'] },
  { image: surfImage, terms: ['surf'] },
  { image: ciclismoIndoorImage, terms: ['ciclismo indoor', 'spinning'] },
  { image: eventosImage, terms: ['eventos', 'evento'] },
  { image: cantoImage, terms: ['canto', 'cantar', 'coral', 'coro'] },
  { image: salsaImage, terms: ['salsa'] },
  { image: ritmosImage, terms: ['ritmos', 'baile', 'danza'] },
  { image: lecturaImage, terms: ['lectura', 'leer', 'libros', 'club de lectura'] },
  { image: cursosTalleresCapacitacionesImage, terms: ['cursos/talleres/capacitaciones', 'cursos', 'talleres', 'capacitaciones', 'capacitacion', 'curso', 'taller'] },
  { image: ajedrezImage, terms: ['ajedrez'] },
  { image: mascotasImage, terms: ['mascotas', 'mascota', 'perros', 'gatos'] },
  { image: jardineriaImage, terms: ['jardineria', 'jardin', 'plantas', 'huerta'] },
  { image: futbolImage, terms: ['futbol', 'futbol 5', 'fulbito'] },
  { image: tenisImage, terms: ['tenis'] },
  { image: basquetImage, terms: ['basquet', 'basket', 'basketball'] },
  { image: padelImage, terms: ['padel', 'paddle'] },
  { image: pescaImage, terms: ['pesca', 'pescar'] },
  { image: cocinaImage, terms: ['cocina', 'cocinar', 'gastronomia', 'cocina/venue'] },
  { image: juegosdemesaImage, terms: ['juegos de mesa', 'juego de mesa', 'board games'] },
  { image: idiomasImage, terms: ['idiomas', 'idioma', 'intercambio cultural', 'intercambio de idiomas'] },
  { image: meditacionImage, terms: ['meditacion', 'mindfulness', 'respiracion'] },
  { image: kayakImage, terms: ['kayak'] },
  { image: natacionImage, terms: ['natacion', 'nadar', 'pileta'] },
  { image: pilatesImage, terms: ['pilates'] },
  { image: pinturaImage, terms: ['pintura', 'pintar'] },
  { image: ceramicaImage, terms: ['ceramica', 'alfareria'] },
  { image: fotografiaImage, terms: ['fotografia', 'foto', 'fotos'] },
  { image: tangoImage, terms: ['tango'] },
  { image: folkloreImage, terms: ['folklore', 'folklore argentino'] },
  { image: motosImage, terms: ['motos', 'moto', 'motociclismo'] },
  { image: teatroImage, terms: ['teatro', 'actuacion'] },
  { image: astrologiaImage, terms: ['astrologia', 'carta natal', 'zodiaco'] },
  { image: ciclismoImage, terms: ['ciclismo/mtb', 'ciclismo', 'bicicleta', 'bici', 'bike', 'mountain bike', 'mtb'] },
  { image: yogaImage, terms: ['yoga', 'supyoga', 'meditacion', 'mindfulness', 'respiracion', 'relax', 'stretching', 'tai chi', 'sound healing', 'bienestar', 'wellness'] },
  { image: runningImage, terms: ['running', 'correr', 'runner'] },
  { image: supImage, terms: ['sup', 'stand up paddle', 'kayak', 'paddleboard', 'natacion'] },
  { image: cafeImage, terms: ['cafe', 'cafeteria', 'cocina'] },
  { image: musicaImage, terms: ['musica', 'sala de ensayo', 'sound', 'concierto'] },
  { image: senderismoImage, terms: ['senderismo', 'trekking/senderismo', 'sendero', 'caminata', 'caminatas', 'trekking', 'camping', 'paseos', 'picnic', 'montana', 'escalada outdoor'] },
  { image: gamingImage, terms: ['gaming', 'juegos', 'juegos de mesa', 'pool', 'bowling'] },
  { image: mateadaImage, terms: ['mate', 'mateada', 'mateadas', 'charlas', 'after office', 'salidas grupales', 'sociales', 'sociales y comunidad'] },
  { image: entrenamientoImage, terms: ['entrenamiento', 'entrenamiento y movimiento', 'funcional', 'crossfit', 'calistenia', 'gimnasio', 'gimnasio/estudio', 'deportes', 'sports', 'futbol', 'padel', 'paddle', 'tenis', 'basquet', 'hockey', 'voley'] },
  { image: grupalImage, terms: ['grupo', 'grupos', 'grupal', 'grupales', 'clubes', 'networking', 'voluntariado', 'idiomas', 'intercambio cultural'] },
]

export function getCategoryImage(data: Record<string, unknown> = {}, fallback = defaultActivityImage) {
  const remoteImage = getRemoteImage(data)
  if (remoteImage) return remoteImage

  const searchable = normalize([
    data.subcategory,
    data.category,
    data.categoryId,
    data.type,
    data.name,
    data.title,
  ].filter(Boolean).join(' '))

  const match = imageRules.find((rule) => rule.terms.some((term) => searchable.includes(term)))
  return match?.image ?? fallback
}
