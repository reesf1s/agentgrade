"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In demo mode, go straight to onboarding
    router.push("/onboarding");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-lg bg-[var(--text-primary)] flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-[var(--background)]" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              AgentGrade
            </span>
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Create your account</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Start your free quality audit</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-static p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="glass-input w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
              Work email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="glass-input w-full px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
              className="glass-input w-full px-4 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="glass-button glass-button-primary w-full !py-2.5 text-sm"
          >
            Get started free
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-muted)] mt-6">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-[var(--text-primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
