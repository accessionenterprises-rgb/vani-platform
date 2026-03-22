import { createContext, useContext, useState } from 'react'
import { adminApi } from '../api/client'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vani_admin_token'))
  const [adminUser, setAdminUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vani_admin_user') || 'null') } catch { return null }
  })

  async function login(email, password) {
    const data = await adminApi.login(email, password)
    localStorage.setItem('vani_admin_token', data.token)
    const user = { name: data.name, role: data.role }
    localStorage.setItem('vani_admin_user', JSON.stringify(user))
    setToken(data.token)
    setAdminUser(user)
  }

  function logout() {
    localStorage.removeItem('vani_admin_token')
    localStorage.removeItem('vani_admin_user')
    setToken(null)
    setAdminUser(null)
  }

  return (
    <AdminAuthContext.Provider value={{ token, adminUser, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export const useAdminAuth = () => useContext(AdminAuthContext)
