import { Image, Platform, StyleSheet, Text, View } from 'react-native'
import { UsersRound } from 'lucide-react-native'

import { PressScale } from './PressScale'
import type { ActivityCardItem, PrivateCardItem, SuggestionCardItem } from './types'

type ActivityCardProps = {
  item: ActivityCardItem
  onPress?: () => void
}

type PrivateCardProps = {
  item: PrivateCardItem
  onPress?: () => void
}

type SuggestionCardProps = {
  item: SuggestionCardItem
  onPress?: () => void
}

export function ActivityCard({ item, onPress }: ActivityCardProps) {
  return (
    <PressScale
      accessibilityLabel={item.cta}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.activityCard}
      pressedStyle={styles.pressed}
    >
      <View style={styles.activityImageWrap}>
        <Image source={item.image} style={styles.activityImage} />
        <View style={styles.topBadges}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{item.dateBadge}</Text>
          </View>
          <View style={styles.peopleBadge}>
            <UsersRound color="#07392D" size={14} strokeWidth={3} />
            <Text style={styles.peopleText}>{item.people}</Text>
          </View>
        </View>
      </View>
      <View style={styles.activityIcon}>
        <item.Icon color="#17803C" size={30} strokeWidth={2.2} />
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.cardCategory}>{item.iconLabel}</Text>
        <Text numberOfLines={2} style={styles.activityTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.activityMeta}>
          {item.dateTime}
        </Text>
        <View style={styles.greenCta}>
          <Text style={styles.greenCtaText}>{item.cta}</Text>
        </View>
      </View>
    </PressScale>
  )
}

export function PrivateCard({ item, onPress }: PrivateCardProps) {
  return (
    <PressScale
      accessibilityLabel={item.cta}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.privateCard}
      pressedStyle={styles.pressed}
    >
      <View style={styles.privateImageWrap}>
        <Image source={item.image} style={styles.privateImage} />
        <View style={styles.capacityBadge}>
          <Text style={styles.capacityText}>{item.capacity}</Text>
        </View>
      </View>
      <View style={styles.privateIcon}>
        <item.Icon color="#4B348A" size={25} strokeWidth={2.2} />
      </View>
      <View style={styles.privateBody}>
        <Text numberOfLines={1} style={styles.privateTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.privateMeta}>
          {item.dateTime}
        </Text>
        <Text numberOfLines={1} style={styles.privateMeta}>
          {item.place}
        </Text>
        <View style={styles.violetCta}>
          <Text style={styles.violetCtaText}>{item.cta}</Text>
        </View>
      </View>
    </PressScale>
  )
}

export function SuggestionCard({ item, onPress }: SuggestionCardProps) {
  const isViolet = item.tone === 'violet'
  const color = isViolet ? '#4B348A' : '#006A32'
  const iconBg = isViolet ? '#F2ECFA' : '#EFF6E9'
  const ctaBg = isViolet ? '#F4EEF9' : '#EFF6E9'

  return (
    <PressScale
      accessibilityLabel={item.cta}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.suggestionCard}
      pressedStyle={styles.pressed}
    >
      <View style={styles.suggestionCapacity}>
        <Text style={styles.capacityText}>{item.capacity}</Text>
      </View>
      <View style={[styles.suggestionIcon, { backgroundColor: iconBg }]}>
        <item.Icon color={color} size={36} strokeWidth={2.2} />
      </View>
      <Text numberOfLines={2} style={styles.suggestionTitle}>
        {item.title}
      </Text>
      <Text numberOfLines={1} style={styles.suggestionLocation}>
        {item.location}
      </Text>
      <Text numberOfLines={1} style={styles.suggestionSchedule}>
        {item.schedule}
      </Text>
      <View style={[styles.suggestionCta, { backgroundColor: ctaBg }]}>
        <Text style={[styles.suggestionCtaText, { color }]}>{item.cta}</Text>
      </View>
    </PressScale>
  )
}

const cardShadow = Platform.select({
  web: {
    boxShadow: '0 18px 34px rgba(7, 57, 45, 0.10)',
  },
  default: {
    elevation: 3,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
})

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 13,
    borderWidth: 1,
    marginRight: 16,
    overflow: 'hidden',
    width: 248,
    ...cardShadow,
  },
  activityImageWrap: {
    height: 160,
    position: 'relative',
  },
  activityImage: {
    height: '100%',
    width: '100%',
  },
  topBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 11,
    position: 'absolute',
    right: 11,
    top: 11,
  },
  dateBadge: {
    backgroundColor: '#F7FAF5',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  dateText: {
    color: '#006A32',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  peopleBadge: {
    alignItems: 'center',
    backgroundColor: '#F7FAF5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  peopleText: {
    color: '#07392D',
    fontSize: 13,
    fontWeight: '900',
  },
  activityIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F7EB',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 3,
    height: 60,
    justifyContent: 'center',
    left: 22,
    position: 'absolute',
    top: 128,
    width: 60,
  },
  activityBody: {
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  cardCategory: {
    alignSelf: 'flex-end',
    color: '#17803C',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 16,
  },
  activityTitle: {
    color: '#063C31',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
    marginBottom: 11,
  },
  activityMeta: {
    color: '#193F37',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
    marginBottom: 16,
  },
  greenCta: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
    width: 154,
  },
  greenCtaText: {
    color: '#00552E',
    fontSize: 14,
    fontWeight: '900',
  },
  privateCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E2ED',
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 16,
    overflow: 'hidden',
    width: 178,
    ...cardShadow,
  },
  privateImageWrap: {
    height: 118,
    position: 'relative',
  },
  privateImage: {
    height: '100%',
    width: '100%',
  },
  capacityBadge: {
    backgroundColor: '#F7FAF5',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  capacityText: {
    color: '#07392D',
    fontSize: 13,
    fontWeight: '900',
  },
  privateIcon: {
    alignItems: 'center',
    backgroundColor: '#F4EEF9',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 3,
    height: 47,
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    top: 92,
    width: 47,
  },
  privateBody: {
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 22,
  },
  privateTitle: {
    color: '#063C31',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
  },
  privateMeta: {
    color: '#193F37',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 19,
  },
  violetCta: {
    alignItems: 'center',
    backgroundColor: '#F5EFF8',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    marginTop: 14,
  },
  violetCtaText: {
    color: '#39206C',
    fontSize: 13,
    fontWeight: '900',
  },
  suggestionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E6E0',
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 13,
    minHeight: 208,
    paddingBottom: 13,
    paddingHorizontal: 12,
    paddingTop: 18,
    position: 'relative',
    width: 188,
    ...cardShadow,
  },
  suggestionCapacity: {
    backgroundColor: '#F2F7EF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    right: 11,
    top: 10,
  },
  suggestionIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    height: 78,
    justifyContent: 'center',
    marginBottom: 11,
    width: 78,
  },
  suggestionTitle: {
    color: '#063C31',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  suggestionLocation: {
    color: '#193F37',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    marginTop: 7,
  },
  suggestionSchedule: {
    color: '#193F37',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
    marginTop: 8,
  },
  suggestionCta: {
    alignItems: 'center',
    borderRadius: 999,
    height: 35,
    justifyContent: 'center',
    marginTop: 15,
  },
  suggestionCtaText: {
    fontSize: 13,
    fontWeight: '900',
  },
})
