const appJson = require('./app.json')

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
const expoConfig = appJson.expo

const plugins = [
  ...(expoConfig.plugins || []),
  ...(googleMapsApiKey
    ? [
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: googleMapsApiKey,
        },
      ],
    ]
    : []),
]

module.exports = {
  ...expoConfig,
  android: {
    ...(expoConfig.android || {}),
    ...(googleMapsApiKey
      ? {
        config: {
          ...(expoConfig.android?.config || {}),
          googleMaps: {
            ...(expoConfig.android?.config?.googleMaps || {}),
            apiKey: googleMapsApiKey,
          },
        },
      }
      : {}),
  },
  plugins,
}
