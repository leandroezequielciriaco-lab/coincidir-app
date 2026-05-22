import { Tabs } from 'expo-router'
import {
  Compass,
  Home,
  MessageCircle,
  Plus,
  UserRound,
} from 'lucide-react-native'
import { Platform, View } from 'react-native'

const tabBarStyle = {
  backgroundColor: '#FFFFFF',
  borderTopColor: '#EFE9DF',
  borderTopWidth: 1,
  borderTopLeftRadius: 26,
  borderTopRightRadius: 26,
  height: Platform.OS === 'ios' ? 88 : 76,
  paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  paddingTop: 9,
  position: 'absolute' as const,
  shadowColor: '#07392D',
  shadowOffset: { width: 0, height: -8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 12,
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#155C47',
        tabBarInactiveTintColor: '#98A19C',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0,
        },
        tabBarStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="explorar"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, size }) => (
            <Compass color={color} size={size} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="crear"
        options={{
          title: 'Crear',
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: '#16823A',
                borderColor: '#FFFFFF',
                borderRadius: 999,
                borderWidth: 4,
                height: 60,
                justifyContent: 'center',
                marginTop: -26,
                width: 60,
                shadowColor: '#16823A',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: focused ? 0.26 : 0.18,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Plus color="#FFFFFF" size={25} strokeWidth={3} />
            </View>
          ),
          tabBarLabelStyle: {
            color: '#155C47',
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 0,
          },
          tabBarStyle: {
            display: 'none',
          },
        }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <UserRound color={color} size={size} strokeWidth={2.5} />
          ),
        }}
      />
    </Tabs>
  )
}
