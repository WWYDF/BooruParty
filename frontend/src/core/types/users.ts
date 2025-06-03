// Contains sensitive information, be careful!
export type UserSelf = {
  id: string,
  email: string,
  username: string,
  avatar?: string,
  description?: string,
  lastLogin: Date,
  createdAt: Date,
  preferences: {
    layout: 'GRID' | 'COLLAGE',
    theme: 'DARK' | 'LIGHT',
    postsPerPage: number
  },
  role: {
    id: number,
    name: string,
    permissions: {
      id: number,
      name: string
    }[]
  }
}

export type UserPublic = {
  id: string,
  username: string,
  avatar?: string,
  description?: string,
  lastLogin: Date,
  createdAt: Date,
  role: {
    id: number,
    name: string,
    permissions: {
      id: number,
      name: string
    }[]
  }
}