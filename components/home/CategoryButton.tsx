import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { PressScale } from './PressScale'

type CategoryButtonProps = {
  label: string
  active: boolean
  tone?: 'green' | 'violet'
  Icon: LucideIcon
  onPress: () => void
}

export function CategoryButton({
  label,
  active,
  tone = 'green',
  Icon,
  onPress,
}: CategoryButtonProps) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current
  const isViolet = tone === 'violet'
  const color = isViolet ? '#4B348A' : '#147638'
  const idleBg = isViolet ? '#F3EDFA' : '#F0F5E9'

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 8,
      tension: 120,
      useNativeDriver: false,
    }).start()
  }, [active, progress])

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  })

  return (
    <PressScale onPress={onPress} scaleTo={0.95} style={styles.pressable}>
      <View style={styles.wrap}>
        <Animated.View
          style={[
            styles.iconCircle,
            {
              backgroundColor: idleBg,
              borderColor: active ? '#A5D28E' : 'transparent',
              transform: [{ scale }],
            },
          ]}
        >
          <Icon color={color} size={32} strokeWidth={2.15} />
        </Animated.View>
        <Text numberOfLines={2} style={[styles.label, { color: isViolet ? '#31205F' : '#004A2C' }]}>
          {label}
        </Text>
        <View style={[styles.activeBar, active && styles.activeBarVisible]} />
      </View>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  pressable: {
    width: 92,
  },
  wrap: {
    alignItems: 'center',
    minHeight: 116,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: 12,
    minHeight: 36,
    textAlign: 'center',
  },
  activeBar: {
    backgroundColor: 'transparent',
    borderRadius: 999,
    height: 5,
    marginTop: 3,
    width: 38,
  },
  activeBarVisible: {
    backgroundColor: '#13813D',
  },
})
