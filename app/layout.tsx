import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/brand/SiteFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ),
  applicationName: "RealScouting Academy",
  title: {
    default: "RealScouting Academy",
    template: "%s · RealScouting Academy",
  },
  description:
    "C'est mental, et ça fait travailler les muscles des yeux. Séances visuelles pour footballeurs — RealScouting Academy.",
  icons: {
    icon: [{ url: "/logo-rs.png", type: "image/png" }],
    shortcut: "/logo-rs.png",
    apple: "/logo-rs.png",
  },
  openGraph: {
    title: "RealScouting Academy",
    description:
      "C'est mental, et ça fait travailler les muscles des yeux. Séances visuelles pour footballeurs — RealScouting Academy.",
    siteName: "RealScouting Academy",
    type: "website",
    images: [{ url: "/logo-rs.png" }],
  },
  twitter: {
    card: "summary",
    title: "RealScouting Academy",
    description:
      "C'est mental, et ça fait travailler les muscles des yeux. Séances visuelles pour footballeurs — RealScouting Academy.",
    images: ["/logo-rs.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
