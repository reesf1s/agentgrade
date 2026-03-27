import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth/get-user";

export default async function SignUpPage() {
  const userId = await getUserId();

  if (userId) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp fallbackRedirectUrl="/onboarding" />
    </div>
  );
}
