import { useEffect, useState } from 'react'
import { Image, Platform, StyleSheet, View } from 'react-native'
import { UsersRound } from 'lucide-react-native'

type GroupAvatarProps = {
  groupName?: string
  imageUrl?: string | null
  size?: number
}

export function GroupAvatar({ groupName, imageUrl, size = 56 }: GroupAvatarProps) {
  const cleanImageUrl = typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : ''
  const [hasImageError, setHasImageError] = useState(false)
  const shouldShowImage = Boolean(cleanImageUrl) && !hasImageError
  const borderWidth = size < 24 ? 1 : 2
  const iconSize = Math.max(12, Math.round(size * 0.46))

  useEffect(() => {
    setHasImageError(false)
  }, [cleanImageUrl])

  return (
    <View
      accessibilityLabel={groupName ? `Foto del grupo ${groupName}` : 'Foto del grupo'}
      style={[
        styles.avatar,
        {
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <View style={[styles.avatarInner, { borderRadius: size / 2, borderWidth }]}>
        {shouldShowImage ? (
          <Image
            onError={() => setHasImageError(true)}
            resizeMode="cover"
            source={{ uri: cleanImageUrl }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: size / 2 }]}
          />
        ) : (
          <UsersRound color="#006A32" size={iconSize} strokeWidth={2.25} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#F0F5E9',
    shadowColor: '#07392D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
  avatarInner: {
    alignItems: 'center',
    backgroundColor: '#F0F5E9',
    borderColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
})
