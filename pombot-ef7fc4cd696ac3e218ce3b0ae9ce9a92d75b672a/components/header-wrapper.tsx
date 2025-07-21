import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { HeaderClient } from './header-client'

export async function HeaderWrapper() {
  const cookieStore = cookies()
  const session = await auth({ cookieStore })

  return <HeaderClient session={session} />
}
