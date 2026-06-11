export const LEGAL_TERMS_VERSION = '2026-06'
export const LEGAL_PRIVACY_VERSION = '2026-06'

export function getLegalAcceptanceFields(timestamp: unknown) {
  return {
    acceptedTerms: true,
    acceptedTermsAt: timestamp,
    termsVersion: LEGAL_TERMS_VERSION,
    acceptedPrivacy: true,
    acceptedPrivacyAt: timestamp,
    privacyVersion: LEGAL_PRIVACY_VERSION,
  }
}

export function hasAcceptedCurrentLegal(profile: Record<string, unknown> | null | undefined) {
  return Boolean(
    profile?.acceptedTerms === true &&
    profile?.acceptedPrivacy === true &&
    profile?.termsVersion === LEGAL_TERMS_VERSION &&
    profile?.privacyVersion === LEGAL_PRIVACY_VERSION,
  )
}

export const legalTermsTitle = 'Términos y Condiciones de Uso'
export const legalPrivacyTitle = 'Política de Privacidad'
export const legalLastUpdated = 'Última actualización: Junio 2026'

export const legalTermsSections = [
  {
    title: '',
    body: [
      'Bienvenido/a a COINCIDIR.',
      'Al utilizar esta aplicación, aceptás los siguientes Términos y Condiciones. Si no estás de acuerdo con alguno de ellos, te recomendamos no utilizar la app.',
    ],
  },
  {
    title: '1. Objeto de la aplicación',
    body: [
      'COINCIDIR es una plataforma digital destinada a facilitar la conexión entre personas para participar en actividades deportivas, recreativas, sociales, culturales y de bienestar.',
      'La app funciona únicamente como intermediaria tecnológica entre usuarios.',
      'COINCIDIR no organiza directamente las actividades publicadas, salvo que se indique expresamente.',
    ],
  },
  {
    title: '2. Edad mínima',
    body: [
      'La aplicación está destinada exclusivamente a personas mayores de 18 años.',
      'Los menores de edad únicamente podrán participar en actividades bajo supervisión y responsabilidad exclusiva de un adulto responsable.',
    ],
  },
  {
    title: '3. Registro y uso',
    body: [
      'Para utilizar ciertas funciones, el usuario deberá registrarse proporcionando información veraz y actualizada.',
      'El usuario es responsable de:',
      '• Mantener la confidencialidad de su cuenta.',
      '• Toda actividad realizada desde su perfil.',
      '• El contenido que publique dentro de la plataforma.',
      'COINCIDIR podrá suspender o eliminar cuentas que incumplan estos términos o generen situaciones de riesgo para otros usuarios o para la comunidad.',
    ],
  },
  {
    title: '4. Conducta de los usuarios',
    body: [
      'Los usuarios se comprometen a utilizar la app de manera respetuosa, legal y segura.',
      'No está permitido:',
      '• Publicar contenido ofensivo, discriminatorio o ilegal.',
      '• Suplantar identidad.',
      '• Organizar actividades peligrosas o fraudulentas.',
      '• Acosar, amenazar o perjudicar a otros usuarios.',
      '• Compartir información falsa o engañosa.',
      'COINCIDIR podrá suspender, limitar o eliminar cuentas sin previo aviso cuando considere que existe conducta inapropiada, riesgosa o contraria al espíritu de la comunidad.',
    ],
  },
  {
    title: '5. Identidad y encuentros entre usuarios',
    body: [
      'COINCIDIR no verifica antecedentes personales, penales, médicos, profesionales ni legales de los usuarios.',
      'La plataforma no garantiza la autenticidad de la identidad declarada por los usuarios ni la veracidad de la información compartida en perfiles o publicaciones.',
      'COINCIDIR no supervisa encuentros presenciales ni las interacciones entre usuarios.',
      'Cada persona es responsable de evaluar con quién interactúa, participa o coordina actividades.',
      'Se recomienda realizar encuentros en lugares públicos y adoptar medidas razonables de seguridad personal.',
    ],
  },
  {
    title: '6. Actividades deportivas y físicas',
    body: [
      'Las actividades deportivas, recreativas y físicas pueden implicar riesgos físicos, lesiones, accidentes o daños personales.',
      'Cada usuario declara participar bajo su exclusiva responsabilidad, comprendiendo los riesgos asociados y asumiendo que posee condiciones físicas y de salud adecuadas para hacerlo.',
      'COINCIDIR no brinda:',
      '• Supervisión profesional.',
      '• Servicios médicos.',
      '• Seguros.',
      '• Cobertura ante accidentes.',
      '• Garantías de seguridad sobre las actividades organizadas por terceros.',
    ],
  },
  {
    title: '7. Organizadores y actividades publicadas',
    body: [
      'Los usuarios que organicen actividades son exclusivamente responsables de:',
      '• La organización y ejecución de la actividad.',
      '• Cumplir las leyes y normas aplicables.',
      '• Contar, en caso de corresponder, con habilitaciones, seguros, permisos o autorizaciones necesarias.',
      'COINCIDIR no actúa como agencia, empresa organizadora, prestadora deportiva ni representante de los organizadores.',
    ],
  },
  {
    title: '8. Pagos y actividades aranceladas',
    body: [
      'Algunas actividades podrán incluir pagos, aportes, contribuciones o reservas coordinadas entre usuarios.',
      'Toda transacción económica realizada entre usuarios es responsabilidad exclusiva de las partes involucradas.',
      'COINCIDIR no garantiza:',
      '• La correcta prestación de actividades organizadas por terceros.',
      '• Reembolsos.',
      '• Calidad del evento o actividad.',
      '• Cumplimiento de horarios o condiciones pactadas entre usuarios.',
    ],
  },
  {
    title: '9. Deslinde de responsabilidad',
    body: [
      'COINCIDIR es únicamente una herramienta digital de conexión entre personas.',
      'La aplicación, sus desarrolladores, propietarios, administradores y colaboradores no serán responsables por:',
      '• Accidentes.',
      '• Lesiones físicas.',
      '• Robos.',
      '• Pérdidas económicas.',
      '• Daños materiales.',
      '• Conflictos entre usuarios.',
      '• Conductas indebidas.',
      '• Fraudes.',
      '• Hechos ocurridos antes, durante o después de actividades coordinadas mediante la app.',
      'Cada usuario utiliza la plataforma y participa en actividades bajo su propia responsabilidad y riesgo.',
    ],
  },
  {
    title: '10. Contenido publicado',
    body: [
      'El usuario conserva la propiedad del contenido que publique, pero otorga a COINCIDIR una licencia no exclusiva para mostrarlo dentro de la plataforma con fines operativos y promocionales relacionados con la app.',
      'COINCIDIR podrá eliminar contenido que considere inapropiado o contrario a estos términos.',
    ],
  },
  {
    title: '11. Funcionamiento de la plataforma',
    body: [
      'COINCIDIR realizará esfuerzos razonables para mantener el correcto funcionamiento de la aplicación.',
      'Sin embargo, no garantiza:',
      '• Disponibilidad permanente.',
      '• Funcionamiento ininterrumpido.',
      '• Ausencia de errores técnicos.',
      '• Compatibilidad con todos los dispositivos.',
      '• Disponibilidad continua de chats, publicaciones o contenidos.',
      'La plataforma podrá modificarse, actualizarse o suspenderse temporalmente sin previo aviso.',
    ],
  },
  {
    title: '12. Privacidad y datos',
    body: [
      'La información personal será utilizada únicamente para el funcionamiento de la plataforma y mejora del servicio.',
      'COINCIDIR podrá almacenar datos vinculados al perfil, intereses, actividades, ubicación aproximada, imágenes y uso general de la app con fines operativos y de experiencia de usuario.',
      'COINCIDIR procurará proteger los datos mediante medidas razonables de seguridad, aunque no puede garantizar seguridad absoluta en internet.',
    ],
  },
  {
    title: '13. Aceptación de los términos',
    body: [
      'Al registrarse y utilizar la aplicación, el usuario declara haber leído, comprendido y aceptado estos Términos y Condiciones.',
      'La aceptación podrá realizarse mediante checkbox, botón de aceptación o cualquier mecanismo digital implementado dentro de la plataforma.',
    ],
  },
  {
    title: '14. Modificaciones',
    body: [
      'COINCIDIR podrá modificar estos Términos y Condiciones en cualquier momento.',
      'Las modificaciones entrarán en vigencia desde su publicación en la app.',
      'El uso continuado de la plataforma implica aceptación de dichas modificaciones.',
    ],
  },
  {
    title: '15. Limitación de responsabilidad',
    body: [
      'En ningún caso COINCIDIR, sus desarrolladores, propietarios o colaboradores serán responsables por daños indirectos, incidentales, especiales o consecuentes derivados del uso o imposibilidad de uso de la aplicación.',
      'El usuario utiliza la plataforma bajo su propio riesgo.',
    ],
  },
  {
    title: '16. Legislación aplicable',
    body: [
      'Estos términos se regirán por las leyes de la República Argentina.',
      'Ante cualquier conflicto, las partes se someterán a los tribunales ordinarios competentes de la Provincia de Buenos Aires, salvo disposición legal en contrario.',
    ],
  },
  {
    title: '17. Contacto',
    body: [
      'Para consultas relacionadas con estos términos, podés comunicarte a través de los canales oficiales de COINCIDIR.',
    ],
  },
]

export const legalPrivacySections = [
  {
    title: '',
    body: [
      'Esta Política de Privacidad describe cómo COINCIDIR recopila, utiliza y protege la información de los usuarios.',
      'Al utilizar la aplicación, aceptás esta Política de Privacidad.',
    ],
  },
  {
    title: '1. Información que recopilamos',
    body: [
      'COINCIDIR puede recopilar:',
      '• Nombre y datos de perfil.',
      '• Correo electrónico.',
      '• Imagen de perfil y fotografías cargadas.',
      '• Intereses y actividades seleccionadas.',
      '• Información vinculada a actividades publicadas o participaciones.',
      '• Mensajes e interacciones dentro de la plataforma.',
      '• Ubicación aproximada o datos necesarios para mostrar actividades cercanas.',
      '• Información técnica del dispositivo y uso general de la app.',
    ],
  },
  {
    title: '2. Uso de la información',
    body: [
      'La información recopilada se utiliza para:',
      '• Permitir el funcionamiento de la plataforma.',
      '• Mostrar actividades y perfiles relacionados.',
      '• Mejorar la experiencia de usuario.',
      '• Facilitar interacciones entre usuarios.',
      '• Mantener la seguridad y moderación básica de la comunidad.',
      '• Detectar usos indebidos o actividades sospechosas.',
      'COINCIDIR no vende información personal de los usuarios a terceros.',
    ],
  },
  {
    title: '3. Compartición de información',
    body: [
      'Parte de la información del perfil podrá ser visible para otros usuarios dentro de la app según las funciones utilizadas.',
      'COINCIDIR podrá compartir información únicamente:',
      '• Cuando exista obligación legal.',
      '• Para proteger derechos, seguridad o funcionamiento de la plataforma.',
      '• En casos necesarios para servicios técnicos vinculados al funcionamiento de la app.',
    ],
  },
  {
    title: '4. Seguridad',
    body: [
      'COINCIDIR adopta medidas razonables para proteger la información almacenada.',
      'Sin embargo, ningún sistema es completamente seguro y no puede garantizarse protección absoluta frente a accesos no autorizados, fallas técnicas o ataques informáticos.',
    ],
  },
  {
    title: '5. Conservación y eliminación de datos',
    body: [
      'Los usuarios podrán solicitar la eliminación de su cuenta y datos asociados mediante los canales oficiales de contacto de la plataforma.',
      'COINCIDIR podrá conservar determinada información cuando exista obligación legal, motivos de seguridad o prevención de fraude.',
    ],
  },
  {
    title: '6. Menores de edad',
    body: [
      'La aplicación está destinada a personas mayores de 18 años.',
      'COINCIDIR no recopila intencionalmente información de menores sin supervisión de un adulto responsable.',
    ],
  },
  {
    title: '7. Cambios en esta política',
    body: [
      'COINCIDIR podrá modificar esta Política de Privacidad en cualquier momento.',
      'Las modificaciones entrarán en vigencia desde su publicación dentro de la app.',
    ],
  },
  {
    title: '8. Contacto',
    body: [
      'Para consultas relacionadas con privacidad o protección de datos, podés comunicarte a través de los canales oficiales de COINCIDIR.',
    ],
  },
]
