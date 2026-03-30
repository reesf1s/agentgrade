import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

function cleanClerkPath(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AgentGrade — Know if your AI agents are actually good",
  description:
    "AI agent quality management platform. Automatically evaluate every conversation across accuracy, hallucination, resolution, tone, and sentiment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const signInUrl = cleanClerkPath(
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    "/sign-in",
  );
  const signUpUrl = cleanClerkPath(
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    "/sign-up",
  );

  return (
    <ClerkProvider signInUrl={signInUrl} signUpUrl={signUpUrl}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
              try {
                var t = localStorage.getItem('agentgrade-theme');
                var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var next = t || (systemDark ? 'dark' : 'light');
                document.documentElement.classList.toggle('dark', next === 'dark');
                document.documentElement.dataset.theme = next;
                document.documentElement.style.colorScheme = next;
              } catch(e) {}
            `,
            }}
          />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ToastProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
