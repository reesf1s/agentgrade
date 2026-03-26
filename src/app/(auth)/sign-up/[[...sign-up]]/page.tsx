import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0A0A0F]">
      <SignUp />
    </div>
  );
}
