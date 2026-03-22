import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('vani_token')
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('vani_token')
          localStorage.removeItem('vani_tenant')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    const data = await api.login(email, password)
    localStorage.setItem('vani_token', data.access_token)
    localStorage.setItem('vani_tenant', data.tenant_id)
    const me = await api.me()
    setUser(me)
    return me
  }

  async function register(name, email, password) {
    const data = await api.signup(email, password, name)
    localStorage.setItem('vani_token', data.access_token)
    localStorage.setItem('vani_tenant', data.tenant_id)
    const me = await api.me()
    setUser(me)
    return me
  }

  function logout() {
    localStorage.removeItem('vani_token')
    localStorage.removeItem('vani_tenant')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
