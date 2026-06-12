import { Platform, type StyleProp, type ViewStyle } from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'

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
  markerCoordinate: MapCoordinate
  onMapPress: (event: MapPressEvent) => void
  onMarkerDragEnd: (coordinate: MapCoordinate) => void
  onRegionChangeComplete: (region: MapRegion) => void
  region: MapRegion
  style: StyleProp<ViewStyle>
}

const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined

export function LocationMapPreview({ coordinate, region, style }: LocationMapPreviewProps) {
  return (
    <MapView
      mapType="standard"
      provider={mapProvider}
      region={region}
      scrollEnabled={false}
      style={style}
      toolbarEnabled={false}
      zoomEnabled={false}
    >
      <Marker coordinate={coordinate} pinColor="#0E5A44" />
    </MapView>
  )
}

export default function LocationPicker({
  markerCoordinate,
  onMapPress,
  onMarkerDragEnd,
  onRegionChangeComplete,
  region,
  style,
}: LocationPickerProps) {
  return (
    <MapView
      loadingEnabled
      mapType="standard"
      moveOnMarkerPress={false}
      onLongPress={onMapPress}
      onPress={onMapPress}
      onRegionChangeComplete={(nextRegion) => onRegionChangeComplete(nextRegion)}
      provider={mapProvider}
      region={region}
      showsCompass
      showsMyLocationButton
      style={style}
      toolbarEnabled={false}
    >
      <Marker
        coordinate={markerCoordinate}
        draggable
        onDragEnd={(event) => onMarkerDragEnd(event.nativeEvent.coordinate)}
        pinColor="#0E5A44"
      />
    </MapView>
  )
}
