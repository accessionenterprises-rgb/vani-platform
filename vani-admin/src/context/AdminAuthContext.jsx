import { createContext, useContext, useState } from 'react'
import { adminApi } from '../api/client'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vani_admin_token'))

  async function login(secret) {
    const data = await adminApi.login(secret)
    localStorage.setItem('vani_admin_token', data.token)
    setToken(data.token)
  }

  function logout() {
    localStorage.removeItem('vani_admin_token')
    setToken(null)
  }

  return (
    <AdminAuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export const useAdminAuth = () => useContext(AdminAuthContext)
