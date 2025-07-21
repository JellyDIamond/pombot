import { auth } from '@/auth'
import { LoginButton } from '@/components/login-button'
import { LoginForm } from '@/components/login-form'
import { Separator } from '@/components/ui/separator'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  const cookieStore = cookies()
  const session = await auth({ cookieStore })
  // redirect to home if user is already logged in
  if (session?.user) {
    redirect('/')
  }
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col items-center justify-center py-10">
      <div className="w-full max-w-sm">
        <LoginForm action="sign-up" />
        <Separator className="my-4" />
        <div className="flex justify-center">
          <LoginButton />
        </div>
        <form action="/api/stripe/checkout" method="POST">
  <button
    type="submit"
    className="mt-6 rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
  >
    Subscribe (€1 Test)
  </button>
</form>
      </div>
    </div>
  )
}
