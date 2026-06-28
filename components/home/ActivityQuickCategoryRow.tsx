import { Bike, Coffee, Footprints, HeartPulse, PersonStanding, Sprout } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import {
  activityQuickCategories,
  type ActivityQuickCategoryId,
} from '../../utils/activityDiscovery'
import { PressScale } from './PressScale'

type ActivityQuickCategoryRowProps = {
  activeId: ActivityQuickCategoryId
  onChange: (id: ActivityQuickCategoryId) => void
}

const iconsByCategory: Record<ActivityQuickCategoryId, LucideIcon> = {
  all: Sprout,
  bike: Bike,
  run: PersonStanding,
  share: Coffee,
  walk: Footprints,
  wellness: HeartPulse,
}

export function ActivityQuickCategoryRow({ activeId, onChange }: ActivityQuickCategoryRowProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {activityQuickCategories.map((item) => {
        const Icon = iconsByCategory[item.id]
        const active = activeId === item.id

        return (
          <PressScale
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={item.id}
            onPress={() => onChange(item.id)}
            scaleTo={0.96}
            style={styles.item}
          >
            <View style={[styles.iconCircle, active && styles.iconCircleActive]}>
              <Icon color={active ? '#FFFFFF' : '#17803C'} size={23} strokeWidth={2.35} />
            </View>
            <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </PressScale>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingRight: 8,
    paddingVertical: 4,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#EAF6E8',
    borderColor: '#D4EBD0',
    borderRadius: 999,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  iconCircleActive: {
    backgroundColor: '#17803C',
    borderColor: '#17803C',
  },
  item: {
    alignItems: 'center',
    minWidth: 62,
  },
  label: {
    color: '#3D514A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
    marginTop: 7,
  },
  labelActive: {
    color: '#006A32',
  },
})
