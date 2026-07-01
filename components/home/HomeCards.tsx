import { useEffect, useState } from 'react'
import { Image as ExpoImage } from 'expo-image'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { MapPin, Share2, UsersRound } from 'lucide-react-native'

import { PressScale } from './PressScale'
import { GroupAvatar } from '../groups/GroupAvatar'
import type { ActivityCardItem, PrivateCardItem, SuggestionCardItem } from './types'
import { getGroupTheme } from '../../constants/groupTheme'
import { defaultActivityImage, getCategoryImage } from '../../utils/categoryImages'

type ActivityCardProps = {
  item: ActivityCardItem
  onCtaPress?: () => void
  onPress?: () => void
  onSharePress?: () => void
}

type PrivateCardProps = {
  item: PrivateCardItem
  onPress?: () => void
}

type SuggestionCardProps = {
  item: SuggestionCardItem
  onPress?: () => void
}

export function ActivityCard({ item, onCtaPress, onPress, onSharePress }: ActivityCardProps) {
  const fallbackImage = getCategoryImage({ category: item.category }, defaultActivityImage)
  const [imageSource, setImageSource] = useState(item.image || defaultActivityImage)
  const [hasImageError, setHasImageError] = useState(false)
  const isCtaDisabled = Boolean(item.isCancelled || item.isOrganizer)
  const isGroupActivity = Boolean(item.groupId || item.groupName)
  const groupColors = getGroupTheme(item.groupColor)
  const isWeb = Platform.OS === 'web'

  useEffect(() => {
    setImageSource(item.image || defaultActivityImage)
    setHasImageError(false)
  }, [item.image])

  return (
    <View style={[styles.activityCard, isGroupActivity && { borderColor: groupColors.borderColor }]}>
      <View style={styles.activityImageWrap}>
        <ExpoImage contentFit="cover" source={fallbackImage} style={styles.activityImage} />
        {!hasImageError ? (
          <ExpoImage
            contentFit="cover"
            onError={() => {
              if (__DEV__) console.log('[CARD IMAGE ERROR]', { title: item.title, category: item.category })
              setHasImageError(true)
              setImageSource(fallbackImage)
            }}
            source={imageSource || fallbackImage}
            style={[styles.activityImage, StyleSheet.absoluteFillObject]}
          />
        ) : null}
        <View style={styles.imageOverlay} />
        {isWeb ? (
          <View
            accessibilityLabel={`Ver detalle de ${item.title}`}
            accessibilityRole="button"
            onResponderRelease={onPress}
            onStartShouldSetResponder={() => true}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <Pressable
            accessibilityLabel={`Ver detalle de ${item.title}`}
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.pressed]}
          />
        )}
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{item.dateBadge}</Text>
        </View>
        {item.visualState ? (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: item.visualState.backgroundColor,
                borderColor: item.visualState.borderColor,
              },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: item.visualState.color }]}>{item.visualState.label}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.activityBody}>
        <View style={styles.activityTopLine}>
          <View style={styles.categoryPill}>
            <item.Icon color="#17803C" size={16} strokeWidth={2.3} />
            <Text numberOfLines={1} style={styles.categoryPillText}>{item.iconLabel}</Text>
          </View>
        <Pressable
          accessibilityLabel={`Compartir ${item.title}`}
          accessibilityRole="button"
          onPress={(event) => {
            if (Platform.OS !== 'web') event.stopPropagation()
            onSharePress?.()
          }}
          style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
        >
            <Share2 color="#006A32" size={15} strokeWidth={2.5} />
            <Text style={styles.shareButtonText}>Compartir</Text>
          </Pressable>
        </View>
        {isWeb ? (
          <View
            accessibilityLabel={`Ver detalle de ${item.title}`}
            accessibilityRole="button"
            onResponderRelease={onPress}
            onStartShouldSetResponder={() => true}
            style={styles.activityContentPressArea}
          >
            <ActivityCardContent groupColors={groupColors} item={item} />
          </View>
        ) : (
          <Pressable
            accessibilityLabel={`Ver detalle de ${item.title}`}
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [styles.activityContentPressArea, pressed && styles.pressed]}
          >
            <ActivityCardContent groupColors={groupColors} item={item} />
          </Pressable>
        )}
        <Pressable
          accessibilityLabel={item.cta}
          accessibilityRole="button"
          disabled={isCtaDisabled}
          onPress={(event) => {
            if (Platform.OS !== 'web') event.stopPropagation()
            onCtaPress?.()
          }}
          style={({ pressed }) => [
            styles.activityFooter,
            item.action === 'interest' && styles.activityFooterInterest,
            item.isCancelled && styles.activityFooterDisabled,
            item.isOrganizer && styles.activityFooterOwn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[
            styles.greenCtaText,
            item.action === 'interest' && styles.greenCtaTextInterest,
            item.isCancelled && styles.greenCtaTextDisabled,
            item.isOrganizer && styles.greenCtaTextOwn,
          ]}>{item.cta}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ActivityCardContent({ groupColors, item }: { groupColors: ReturnType<typeof getGroupTheme>; item: ActivityCardItem }) {
  const subtitle = item.subtitle?.trim() || item.customName?.trim() || ''

  return (
    <>
      <View style={styles.activityTitleBlock}>
        <Text numberOfLines={2} style={styles.activityTitle}>{item.title}</Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.activityCardSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {item.groupName ? (
        <View style={styles.groupIndicator}>
          <GroupAvatar groupName={item.groupName} imageUrl={item.groupImageUrl} size={18} />
          <Text numberOfLines={1} style={[styles.groupIndicatorText, { color: groupColors.chipTextColor }]}>{item.groupName}</Text>
        </View>
      ) : null}
      <View style={styles.activityMetaRow}>
        <MapPin color="#17803C" size={17} strokeWidth={2.2} />
        <Text numberOfLines={1} style={styles.activityMeta}>{item.location}</Text>
      </View>
      <View style={styles.peopleInline}>
        <UsersRound color="#07392D" size={15} strokeWidth={2.4} />
        <Text style={styles.peopleText}>{item.people}</Text>
      </View>
    </>
  )
}

export function PrivateCard({ item, onPress }: PrivateCardProps) {
  const fallbackImage = getCategoryImage({ title: item.title }, defaultActivityImage)
  const [imageSource, setImageSource] = useState(item.image || defaultActivityImage)
  const [hasImageError, setHasImageError] = useState(false)

  useEffect(() => {
    setImageSource(item.image || defaultActivityImage)
    setHasImageError(false)
  }, [item.image])

  return (
    <PressScale
      accessibilityLabel={item.cta}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.privateCard}
      pressedStyle={styles.pressed}
    >
      <View style={styles.privateImageWrap}>
        <ExpoImage contentFit="cover" source={fallbackImage} style={styles.privateImage} />
        {!hasImageError ? (
          <ExpoImage
            contentFit="cover"
            onError={() => {
              if (__DEV__) console.log('[CARD IMAGE ERROR]', { title: item.title })
              setHasImageError(true)
              setImageSource(fallbackImage)
            }}
            source={imageSource || fallbackImage}
            style={[styles.privateImage, StyleSheet.absoluteFillObject]}
          />
        ) : null}
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
    width: 136,
  },
  activityContentPressArea: {
    flexShrink: 1,
    zIndex: 1,
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
  statusBadge: {
    backgroundColor: '#FFF2CC',
    borderColor: '#F5C84B',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 10,
    left: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
  },
  statusBadgeText: {
    color: '#7A4A00',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  activityBody: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  activityTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  categoryPill: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderRadius: 999,
    flexDirection: 'row',
    flex: 1,
    gap: 7,
    minHeight: 28,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  categoryPillText: {
    color: '#17803C',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    minWidth: 0,
  },
  peopleInline: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F7FAF5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    marginTop: 9,
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
    lineHeight: 22,
  },
  activityTitleBlock: {
    flexDirection: 'column',
    marginBottom: 7,
    minWidth: 0,
  },
  activityCustomName: {
    color: '#40534D',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
    marginBottom: 5,
    marginTop: -2,
  },
  activityCardSubtitle: {
    color: '#40534D',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 2,
  },
  activityMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  activityMeta: {
    color: '#40534D',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  groupIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 1,
    marginTop: 0,
    maxWidth: '100%',
  },
  groupIndicatorText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 12,
  },
  activityFooter: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EAF7EC',
    borderColor: '#006A32',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 6,
    position: 'relative',
    zIndex: 10,
  },
  activityFooterInterest: {
    backgroundColor: '#F4EEF9',
    borderColor: '#4B348A',
  },
  activityFooterDisabled: {
    backgroundColor: '#ECEBE7',
    borderColor: '#D8D6D1',
  },
  activityFooterOwn: {
    backgroundColor: '#F4EEF9',
    borderColor: '#E6DDF7',
    borderWidth: 1,
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE8E1',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 10,
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
    position: 'relative',
    zIndex: 10,
  },
  shareButtonText: {
    color: '#006A32',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  greenCtaText: {
    color: '#006A32',
    fontSize: 14,
    fontWeight: '900',
  },
  greenCtaTextInterest: {
    color: '#4B348A',
  },
  greenCtaTextDisabled: {
    color: '#7A817D',
  },
  greenCtaTextOwn: {
    color: '#4B348A',
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
