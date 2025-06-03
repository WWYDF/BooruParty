import { UserPublic } from "./users"

export type Role = {
  id: number,
  name: string,
  users: UserPublic[],
  permissions: {
    id: number,
    name: string,
  }[]
}

export type Permission = {
  id: number,
  name: string,
  roles: Role[]
}