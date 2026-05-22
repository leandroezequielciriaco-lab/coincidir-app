import { Text, View } from 'react-native'

import { logoStyles } from './CoincidirLogo.styles'

export function CoincidirMark({ size = 96, cutoutColor = '#FFFFFF', style }) {
  const ringSize = size
  const strokeWidth = ringSize * 0.24
  const overlap = ringSize * 0.32
  const cutoutWidth = ringSize * 0.34
  const cutoutHeight = strokeWidth * 1.55

  return (
    <View
      accessibilityLabel="Logo de Coincidir"
      accessibilityRole="image"
      style={[
        logoStyles.mark,
        {
          width: ringSize * 2 - overlap,
          height: ringSize,
        },
        style,
      ]}
    >
      <View
        style={[
          logoStyles.ring,
          logoStyles.leftRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: strokeWidth,
          },
        ]}
      />

      <View
        style={[
          logoStyles.ring,
          logoStyles.rightRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: strokeWidth,
            left: ringSize - overlap,
          },
        ]}
      >
        <View
          style={[
            logoStyles.cutout,
            {
              width: cutoutWidth,
              height: cutoutHeight,
              borderRadius: strokeWidth,
              top: (ringSize - cutoutHeight) / 2,
              right: -strokeWidth * 0.14,
              backgroundColor: cutoutColor,
            },
          ]}
        />
      </View>
    </View>
  )
}

export default function CoincidirLogo({
  markSize = 96,
  textSize = 36,
  cutoutColor = '#FFFFFF',
  compact = false,
}) {
  return (
    <View style={logoStyles.logo}>
      <CoincidirMark
        size={markSize}
        cutoutColor={cutoutColor}
        style={{ marginBottom: compact ? 8 : 16 }}
      />
      <Text
        style={[
          logoStyles.brand,
          {
            fontSize: textSize,
            lineHeight: textSize * 1.16,
          },
        ]}
      >
        coincidir
      </Text>
    </View>
  )
}
