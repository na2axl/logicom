export enum Role {
  Dispatcher = 'DISPATCHER',
  LogisticsManager = 'LOGISTICS_MANAGER',
}

export interface User {
  id: string;
  role: Role;
}

export const USERS: readonly User[] = [
  { id: 'diane', role: Role.Dispatcher },
  { id: 'eric', role: Role.LogisticsManager },
];

export function findUser(id: string | undefined): User | undefined {
  return USERS.find((user) => user.id === id);
}
