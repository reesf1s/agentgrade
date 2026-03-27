import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth/get-user";

export default async function SignInPage() {
  const userId = await getUserId();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
