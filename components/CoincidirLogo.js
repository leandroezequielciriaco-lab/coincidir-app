import { Image, View } from 'react-native'

import { logoStyles } from './CoincidirLogo.styles'

export const COINCIDIR_LOGO_SOURCE = require('../assets/images/coincidir-logo-official.png')

export function CoincidirMark({ size = 96, style }) {
  const imageSize = Math.round(size * 1.42)

  return (
    <View
      accessibilityLabel="Logo de Coincidir"
      accessibilityRole="image"
      style={[
        logoStyles.logoFrame,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
        },
        style,
      ]}
    >
      <Image
        resizeMode="contain"
        source={COINCIDIR_LOGO_SOURCE}
        style={[
          logoStyles.officialLogo,
          {
            width: imageSize,
            height: imageSize,
          },
        ]}
      />
    </View>
  )
}

export default function CoincidirLogo({
  markSize = 96,
  textSize = 36,
  cutoutColor = '#FFFFFF',
  compact = false,
}) {
  void cutoutColor

  const logoSize = Math.round(markSize * (compact ? 1.12 : 1.16))

  return (
    <View style={[logoStyles.logo, compact && logoStyles.compactLogo]}>
      <CoincidirMark size={logoSize} />
    </View>
  )
}
