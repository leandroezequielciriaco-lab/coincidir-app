import type { ImageSourcePropType } from 'react-native'

declare const require: (path: string) => ImageSourcePropType

export const defaultActivityImage = require('../assets/images/categories/default-activity.jpg')

const yogaImage = require('../assets/images/categories/placeholder-yoga.jpg')
const runningImage = require('../assets/images/categories/placeholder-running.jpg')
const supImage = require('../assets/images/categories/placeholder-sup.jpg')
const cafeImage = require('../assets/images/categories/placeholder-cafe.jpg')
const musicaImage = require('../assets/images/categories/placeholder-musica.jpg')
const senderismoImage = require('../assets/images/categories/placeholder-senderismo.jpg')
const gamingImage = require('../assets/images/categories/placeholder-gaming.jpg')
const mateadaImage = require('../assets/images/categories/placeholder-mateada.jpg')
const ciclismoImage = require('../assets/images/categories/placeholder-ciclismo.jpg')
const entrenamientoImage = require('../assets/images/categories/placeholder-entrenamiento.jpg')
const grupalImage = require('../assets/images/categories/placeholder-grupal.jpg')
const privadoImage = require('../assets/images/categories/placeholder-privado.jpg')

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
  'Espacios privados': privadoImage,
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
  { image: yogaImage, terms: ['yoga', 'supyoga', 'meditacion', 'mindfulness', 'respiracion', 'relax', 'stretching', 'tai chi', 'sound healing', 'bienestar', 'wellness'] },
  { image: runningImage, terms: ['running', 'correr', 'runner'] },
  { image: supImage, terms: ['sup', 'stand up paddle', 'kayak', 'paddleboard', 'natacion'] },
  { image: cafeImage, terms: ['cafe', 'cafeteria', 'cocina'] },
  { image: musicaImage, terms: ['musica', 'sala de ensayo', 'sound', 'concierto'] },
  { image: senderismoImage, terms: ['senderismo', 'sendero', 'caminata', 'caminatas', 'trekking', 'camping', 'outdoor', 'aire libre', 'paseos', 'picnic', 'montana', 'escalada outdoor'] },
  { image: gamingImage, terms: ['gaming', 'juegos', 'juegos de mesa', 'pool', 'bowling'] },
  { image: mateadaImage, terms: ['mate', 'mateada', 'mateadas', 'charlas', 'after office', 'salidas grupales', 'sociales'] },
  { image: ciclismoImage, terms: ['ciclismo', 'bicicleta', 'bici', 'bike', 'mountain bike'] },
  { image: entrenamientoImage, terms: ['entrenamiento', 'funcional', 'crossfit', 'calistenia', 'gimnasio', 'deportes', 'sports', 'futbol', 'padel', 'paddle', 'tenis', 'basquet', 'hockey', 'voley'] },
  { image: grupalImage, terms: ['grupo', 'grupos', 'grupal', 'grupales', 'clubes', 'networking', 'voluntariado', 'idiomas', 'intercambio cultural'] },
  { image: privadoImage, terms: ['private', 'privado', 'privados', 'espacios privados', 'canchas privadas', 'coworking', 'workshops', 'arte', 'escalada indoor'] },
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
