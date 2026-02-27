import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ConditionalNav } from "@/components/ConditionalNav";
import { ConditionalSideNav } from "@/components/ConditionalSideNav";
import { ThemeProvider } from "@/components/theme/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "线轴管家",
  description: "3D 打印耗材位置与生命周期管理",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="spool-theme"
        >
          <div className="hidden md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col">
            <ConditionalSideNav />
          </div>
          <main className="md:pl-56 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
          <div className="md:hidden">
            <ConditionalNav />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
