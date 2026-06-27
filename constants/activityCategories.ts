export type ActivityCategoryId =
  | 'culture'
  | 'groups'
  | 'hobbies'
  | 'outdoor'
  | 'sports'
  | 'training'
  | 'wellness'

export type ActivityCategory = {
  id: ActivityCategoryId
  label: string
  icon: string
  color: string
  backgroundColor: string
  subcategories: string[]
  legacyLabels?: string[]
}

export const activityCategories: ActivityCategory[] = [
  {
    id: 'outdoor',
    label: 'Aire libre y naturaleza',
    icon: 'AL',
    color: '#0E5A44',
    backgroundColor: '#E9F4D9',
    legacyLabels: ['Al aire libre'],
    subcategories: [
      'Caminatas',
      'Trekking/Senderismo',
      'Running',
      'Ciclismo/MTB',
      'Kayak',
      'Stand Up Paddle',
      'Pesca',
      'Camping',
      'Picnic',
      'Avistaje',
      'Equitación',
    ],
  },
  {
    id: 'sports',
    label: 'Deportes',
    icon: 'DEP',
    color: '#16823A',
    backgroundColor: '#DDF2D8',
    subcategories: [
      'Fútbol',
      'Mundial 2026 / Ver a Argentina',
      'Padel',
      'Tenis',
      'Básquet',
      'Hockey',
      'Vóley',
      'Beach Vóley',
      'Newcom',
      'Natación',
      'Natación aguas abiertas',
      'Snorkeling',
      'Buceo',
      'Kitesurf',
      'Windsurf',
      'Surf',
    ],
  },
  {
    id: 'training',
    label: 'Entrenamiento y movimiento',
    icon: 'ENT',
    color: '#2563EB',
    backgroundColor: '#F0F5FF',
    subcategories: [
      'Gimnasio',
      'Funcional',
      'Crossfit',
      'Calistenia',
      'Pilates',
      'Ciclismo indoor',
    ],
  },
  {
    id: 'wellness',
    label: 'Bienestar',
    icon: 'BI',
    color: '#2F8D5A',
    backgroundColor: '#EAF7E4',
    subcategories: [
      'Yoga',
      'Meditación',
      'Respiración',
      'Mindfulness',
      'Stretching',
      'Tai Chi',
      'Sound Healing',
      'Terapias holísticas',
      'Astrología',
    ],
  },
  {
    id: 'groups',
    label: 'Sociales y comunidad',
    icon: 'SC',
    color: '#2A9B37',
    backgroundColor: '#E2F4DD',
    legacyLabels: ['Grupales'],
    subcategories: [
      'Mateadas',
      'Charlas',
      'After office',
      'Salidas grupales',
      'Voluntariado',
      'Clubes',
      'Networking',
      'Eventos',
    ],
  },
  {
    id: 'culture',
    label: 'Cultura, arte y aprendizaje',
    icon: 'CA',
    color: '#B45309',
    backgroundColor: '#FFF7ED',
    subcategories: [
      'Música',
      'Canto',
      'Cine',
      'Teatro',
      'Tango',
      'Folklore',
      'Salsa',
      'Ritmos',
      'Pintura',
      'Cerámica',
      'Fotografía',
      'Cocina',
      'Idiomas',
      'Lectura',
      'Cursos/talleres/capacitaciones',
    ],
  },
  {
    id: 'hobbies',
    label: 'Juegos y hobbies',
    icon: 'JH',
    color: '#7C3AED',
    backgroundColor: '#F5F3FF',
    subcategories: [
      'Juegos de mesa',
      'Ajedrez',
      'Gaming',
      'Pool',
      'Bowling',
      'Mascotas',
      'Jardinería',
      'Motos',
    ],
  },
]

export function findActivityCategory(input: {
  category?: string
  categoryId?: string
}) {
  const categoryId = input.categoryId?.trim()
  const category = input.category?.trim()

  return activityCategories.find((item) =>
    item.id === categoryId
    || item.label === category
    || item.legacyLabels?.includes(category ?? ''),
  ) ?? null
}
