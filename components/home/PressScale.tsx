import { PropsWithChildren, useRef } from 'react'
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native'

type PressScaleProps = PropsWithChildren<
  PressableProps & {
    containerStyle?: StyleProp<ViewStyle>
    style?: StyleProp<ViewStyle>
    pressedStyle?: StyleProp<ViewStyle>
    scaleTo?: number
  }
>

export function PressScale({
  children,
  containerStyle,
  onPressIn,
  onPressOut,
  style,
  pressedStyle,
  scaleTo = 0.97,
  ...props
}: PressScaleProps) {
  const scale = useRef(new Animated.Value(1)).current

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      friction: 7,
      tension: 180,
      useNativeDriver: true,
    }).start()
  }

  const handlePressIn = (event: GestureResponderEvent) => {
    animateTo(scaleTo)
    onPressIn?.(event)
  }

  const handlePressOut = (event: GestureResponderEvent) => {
    animateTo(1)
    onPressOut?.(event)
  }

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [style, pressed && pressedStyle]}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}
