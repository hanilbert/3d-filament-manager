import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ConditionalNav } from "@/components/ConditionalNav";
import { ConditionalSideNav } from "@/components/ConditionalSideNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spool Tracker",
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
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        {/* 桌面端侧边栏 */}
        <div className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0">
          <ConditionalSideNav />
        </div>
        {/* 主内容区 */}
        <main className="md:pl-56 pb-16 md:pb-0">{children}</main>
        {/* 移动端底部导航 */}
        <div className="md:hidden">
          <ConditionalNav />
        </div>
      </body>
    </html>
  );
}
