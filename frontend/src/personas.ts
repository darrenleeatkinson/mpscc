import type { Role } from './auth/types'

export interface Persona {
  key: string
  path: string
  icon: string
  title: string
  subtitle: string
  description: string
  /** Role that grants access to this persona (ADMIN always allowed). */
  requiredRole: Role
  phase: string
}

export const PERSONAS: Persona[] = [
  {
    key: 'responder',
    path: '/responder',
    icon: '📞',
    title: 'First Responder',
    subtitle: '999 Intake',
    description:
      'Answer intake calls, run a live assessment, and create incidents with a suggested priority.',
    requiredRole: 'RESPONDER',
    phase: 'Phase 1',
  },
  {
    key: 'dispatch',
    path: '/dispatch',
    icon: '🚔',
    title: 'Dispatcher',
    subtitle: 'Map-centric console',
    description:
      'Work the incident queue, take the next job, and assign the nearest trained resource on a live map.',
    requiredRole: 'DISPATCHER',
    phase: 'Phase 2',
  },
  {
    key: 'planner',
    path: '/planner',
    icon: '🗓️',
    title: 'Resource & Shift Planner',
    subtitle: 'Rosters & coverage',
    description:
      'Generate rosters, balance stations, and monitor demand-vs-staffed coverage and fleet utilisation.',
    requiredRole: 'PLANNER',
    phase: 'Phase 3',
  },
]

export function canAccess(persona: Persona, roles: Role[]): boolean {
  return roles.includes('ADMIN') || roles.includes(persona.requiredRole)
}
