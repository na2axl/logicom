export type Role = 'DISPATCHER' | 'LOGISTICS_MANAGER'

export interface UserResource {
  id: string
  role: Role
}
