import { createContext, useContext } from 'react'

export const AuthContext = createContext({
  checked: false,
  user: null,
})

export function useGlobalAuth() {
  return useContext(AuthContext)
}
