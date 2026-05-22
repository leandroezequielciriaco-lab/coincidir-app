import { useEffect, useRef } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { styles } from './InterestsScreen.styles'

export default function ActivityCard({
  accent = 'green',
  activity,
  onPress,
  selected,
}) {
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.03 : 1,
      friction: 7,
      tension: 130,
      useNativeDriver: true,
    }).start()
  }, [scale, selected])

  const isPurple = accent === 'purple'
  const cardStyle = isPurple ? styles.purpleActivityCard : styles.greenActivityCard
  const selectedCardStyle = isPurple
    ? styles.purpleActivityCardSelected
    : styles.greenActivityCardSelected
  const iconCircleStyle = isPurple ? styles.purpleIconCircle : styles.greenIconCircle
  const iconColor = isPurple ? '#543D78' : '#116C24'
  const badgeStyle = isPurple ? styles.purpleBadge : styles.greenBadge

  return (
    <Animated.View style={[styles.cardAnimation, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.activityCard,
          cardStyle,
          selected && selectedCardStyle,
          pressed && styles.activityCardPressed,
        ]}
      >
        <View style={[styles.cardBadge, badgeStyle, selected && styles.selectedBadge]}>
          <MaterialCommunityIcons
            color="#FFFFFF"
            name={selected ? 'check' : 'plus'}
            size={18}
          />
        </View>

        <View style={[styles.activityIconCircle, iconCircleStyle]}>
          <MaterialCommunityIcons
            color={iconColor}
            name={activity.icon}
            size={48}
          />
        </View>

        <Text style={[styles.activityLabel, accent === 'purple' && styles.purpleLabel]}>
          {activity.label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}
