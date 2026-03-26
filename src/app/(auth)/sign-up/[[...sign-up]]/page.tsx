import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="glass-static p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Sign Up</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Authentication requires Clerk production keys. You can explore the full demo below.
        </p>
        <Link href="/dashboard" className="glass-button glass-button-primary inline-block !py-2.5 !px-6">
          View demo dashboard
        </Link>
      </div>
    </div>
  );
}
