import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, clearToken, getToken, setToken } from '../api/client'
import type { LoginResponse, Role, User } from './types'

interface AuthState {
  user: User | null
  token: string | null
  roles: Role[]
  ready: boolean // true once initial token validation has resolved
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  hasRole: (role: Role) => boolean
}

const USER_KEY = 'mpscc.user'

const AuthContext = createContext<AuthState | undefined>(undefined)

function loadStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function storeUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function toUser(r: LoginResponse): User {
  return {
    username: r.username,
    displayName: r.displayName,
    roles: r.roles ?? [],
    groups: r.groups ?? [],
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<User | null>(() => loadStoredUser())
  const [ready, setReady] = useState(false)

  // On load, if a token exists, treat as logged in and validate via /api/auth/me.
  useEffect(() => {
    let cancelled = false
    const existing = getToken()
    if (!existing) {
      setReady(true)
      return
    }
    api<LoginResponse>('/api/auth/me')
      .then((me) => {
        if (cancelled) return
        const u = toUser(me)
        setUser(u)
        storeUser(u)
      })
      .catch(() => {
        // Token invalid/expired — clear session.
        if (cancelled) return
        clearToken()
        localStorage.removeItem(USER_KEY)
        setTokenState(null)
        setUser(null)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(username: string, password: string): Promise<void> {
    const res = await api<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
    })
    setToken(res.token)
    const u = toUser(res)
    storeUser(u)
    setTokenState(res.token)
    setUser(u)
    setReady(true)
  }

  function logout(): void {
    clearToken()
    localStorage.removeItem(USER_KEY)
    setTokenState(null)
    setUser(null)
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      roles: user?.roles ?? [],
      ready,
      login,
      logout,
      hasRole: (role: Role) => (user?.roles ?? []).includes(role),
    }),
    [user, token, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
