import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { CalendarDays, MapPin, UserRound, UsersRound } from 'lucide-react-native'

import { PressScale } from './PressScale'
import type { ActivityCardItem, PrivateCardItem, SuggestionCardItem } from './types'

type ActivityCardProps = {
  item: ActivityCardItem
  onCtaPress?: () => void
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

export function ActivityCard({ item, onCtaPress, onPress }: ActivityCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Ver detalle de ${item.title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}
    >
      <View style={styles.activityImageWrap}>
        <Image source={item.image} style={styles.activityImage} />
        <View style={styles.imageOverlay} />
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{item.dateBadge}</Text>
        </View>
      </View>
      <View style={styles.activityBody}>
        <View style={styles.activityTopLine}>
          <View style={styles.categoryPill}>
            <item.Icon color="#17803C" size={16} strokeWidth={2.3} />
            <Text numberOfLines={1} style={styles.categoryPillText}>{item.iconLabel}</Text>
          </View>
          <View style={styles.peopleInline}>
            <UsersRound color="#07392D" size={15} strokeWidth={2.4} />
            <Text style={styles.peopleText}>{item.people}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.activityTitle}>{item.title}</Text>
        <View style={styles.activityMetaRow}>
          <CalendarDays color="#17803C" size={17} strokeWidth={2.2} />
          <Text numberOfLines={1} style={styles.activityMeta}>{item.dateTime}</Text>
        </View>
        <View style={styles.activityMetaRow}>
          <MapPin color="#17803C" size={17} strokeWidth={2.2} />
          <Text numberOfLines={1} style={styles.activityMeta}>{item.location}</Text>
        </View>
        <View style={styles.activityMetaRow}>
          <UserRound color="#17803C" size={17} strokeWidth={2.2} />
          <Text numberOfLines={1} style={styles.activityMeta}>{item.organizer}</Text>
        </View>
        <Pressable
          accessibilityLabel={item.cta}
          accessibilityRole="button"
          onPress={onCtaPress}
          style={({ pressed }) => [styles.activityFooter, pressed && styles.pressed]}
        >
          <Text style={styles.greenCtaText}>{item.cta}</Text>
        </Pressable>
      </View>
    </Pressable>
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
        <View style={styles.imageOverlay} />
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
    boxShadow: '0 14px 28px rgba(7, 57, 45, 0.09)',
  },
  default: {
    elevation: 2,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
})

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },
  activityCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E1',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    height: 190,
    marginBottom: 14,
    overflow: 'hidden',
    width: '100%',
    ...cardShadow,
  },
  activityImageWrap: {
    backgroundColor: '#EFF6E9',
    height: '100%',
    position: 'relative',
    flexBasis: 136,
    flexShrink: 0,
    width: 136,
  },
  activityImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 29, 25, 0.08)',
  },
  dateBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    left: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
    top: 12,
  },
  dateBadgeText: {
    color: '#006A32',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  activityBody: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  activityTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryPill: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    maxWidth: '70%',
    minHeight: 28,
    paddingHorizontal: 10,
  },
  categoryPillText: {
    color: '#17803C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  peopleInline: {
    alignItems: 'center',
    backgroundColor: '#F7FAF5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 10,
  },
  peopleText: {
    color: '#07392D',
    fontSize: 12,
    fontWeight: '900',
  },
  activityTitle: {
    color: '#063C31',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 21,
    marginBottom: 5,
  },
  activityMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },
  activityMeta: {
    color: '#40534D',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  activityFooter: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    minHeight: 34,
    justifyContent: 'center',
    marginTop: 9,
  },
  greenCtaText: {
    color: '#00552E',
    fontSize: 14,
    fontWeight: '900',
  },
  privateCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E2ED',
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 16,
    overflow: 'hidden',
    width: 178,
    ...cardShadow,
  },
  privateImageWrap: {
    height: 112,
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
    borderRadius: 18,
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
