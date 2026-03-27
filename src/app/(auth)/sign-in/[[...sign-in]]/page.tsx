import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SignIn } from '@clerk/nextjs'
import { cookies } from 'next/headers'

export default async function SignInPage() {
  // Check if already signed in via Clerk
  const { userId } = await auth()
  if (userId) {
    redirect('/dashboard')
  }

  // Also check __client_uat cookie for dev key sessions
  const cookieStore = await cookies()
  const clientUat = cookieStore.get('__client_uat')?.value
  if (clientUat && clientUat !== '0') {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
