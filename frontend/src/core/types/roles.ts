export type Role = {
  id: number,
  name: string,
  permissions: {
    id: number,
    name: string,
  }[]
}