import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import { cookies } from 'next/headers'

export default async function SignUpPage() {
  // Check __client_uat cookie first — reliable even when Clerk dev keys
  // cause auth() to fail or return no userId in production environments
  const cookieStore = await cookies()
  const clientUat = cookieStore.get('__client_uat')?.value
  if (clientUat && clientUat !== '0') {
    redirect('/onboarding')
  }

  // Also check via Clerk auth(), but don't let it crash the page
  try {
    const { userId } = await auth()
    if (userId) {
      redirect('/onboarding')
    }
  } catch {
    // auth() can throw with dev keys on production — fall through to render SignUp
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  )
}
