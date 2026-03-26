import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="glass-static p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Sign Up</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Configure Clerk environment variables to enable sign-up.
        </p>
        <Link href="/dashboard" className="glass-button glass-button-primary inline-block">
          View demo dashboard
        </Link>
      </div>
    </div>
  );
}
