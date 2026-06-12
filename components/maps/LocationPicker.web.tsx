import { Linking, Pressable, StyleSheet, Text, type StyleProp, View, type ViewStyle } from 'react-native'

export type MapCoordinate = {
  latitude: number
  longitude: number
}

export type MapRegion = MapCoordinate & {
  latitudeDelta: number
  longitudeDelta: number
}

type MapPressEvent = {
  nativeEvent: {
    coordinate: MapCoordinate
  }
}

type LocationMapPreviewProps = {
  address?: string
  coordinate: MapCoordinate
  region: MapRegion
  style: StyleProp<ViewStyle>
}

type LocationPickerProps = {
  address?: string
  markerCoordinate: MapCoordinate
  onMapPress: (event: MapPressEvent) => void
  onMarkerDragEnd: (coordinate: MapCoordinate) => void
  onRegionChangeComplete: (region: MapRegion) => void
  region: MapRegion
  style: StyleProp<ViewStyle>
}

function formatCoordinate(coordinate: MapCoordinate) {
  return `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`
}

function openGoogleMaps(coordinate: MapCoordinate) {
  const query = `${coordinate.latitude},${coordinate.longitude}`
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`)
}

export function LocationMapPreview({ address, coordinate, style }: LocationMapPreviewProps) {
  return (
    <View style={[style, styles.fallback]}>
      <Text style={styles.title}>Mapa no disponible en Web por ahora</Text>
      <Text numberOfLines={2} style={styles.copy}>{address || 'Ubicación a definir'}</Text>
      <Text style={styles.coordinates}>{formatCoordinate(coordinate)}</Text>
    </View>
  )
}

export default function LocationPicker({ address, markerCoordinate, style }: LocationPickerProps) {
  return (
    <View style={[style, styles.fallback, styles.pickerFallback]}>
      <Text style={styles.title}>Mapa no disponible en Web por ahora</Text>
      <Text style={styles.copy}>
        Podés continuar con la dirección escrita abajo. Google Maps abre solo como referencia externa y no devuelve la ubicación a COINCIDIR.
      </Text>
      {address ? <Text numberOfLines={2} style={styles.address}>{address}</Text> : null}
      <Text style={styles.coordinates}>{formatCoordinate(markerCoordinate)}</Text>
      <Pressable accessibilityRole="link" onPress={() => openGoogleMaps(markerCoordinate)} style={styles.mapsButton}>
        <Text style={styles.mapsButtonText}>Abrir en Google Maps</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  address: {
    color: '#0E5A44',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
    marginTop: 10,
    textAlign: 'center',
  },
  coordinates: {
    color: '#52615C',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  copy: {
    color: '#34445F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  fallback: {
    alignItems: 'center',
    backgroundColor: '#EEF7EA',
    justifyContent: 'center',
    padding: 16,
  },
  mapsButton: {
    backgroundColor: '#0E5A44',
    borderRadius: 999,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  mapsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },
  pickerFallback: {
    minHeight: 280,
  },
  title: {
    color: '#0E5A44',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'center',
  },
})
