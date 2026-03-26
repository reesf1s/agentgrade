import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

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

// Only use ClerkProvider with production keys
const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const isProductionClerk = clerkPublishableKey.startsWith("pk_live_");

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const inner = (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('agentgrade-theme');
                if (t === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );

  if (isProductionClerk) {
    const { ClerkProvider } = await import("@clerk/nextjs");
    return <ClerkProvider>{inner}</ClerkProvider>;
  }

  return inner;
}
