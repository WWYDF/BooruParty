import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getServerSession } from 'next-auth'

export function auth() {
  return getServerSession(authOptions)
}