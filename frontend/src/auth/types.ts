export type Role = 'RESPONDER' | 'DISPATCHER' | 'PLANNER' | 'ADMIN'

export interface User {
  username: string
  displayName: string
  roles: Role[]
  groups: string[]
}

// Shape returned by POST /api/auth/login and (identity portion) GET /api/auth/me
export interface LoginResponse {
  token: string
  username: string
  displayName: string
  roles: Role[]
  groups: string[]
}
