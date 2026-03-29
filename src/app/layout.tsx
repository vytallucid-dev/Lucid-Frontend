import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LUCID — Trading OS",
  description: "Personal Trading Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex">
        <Sidebar />
        <div className="flex-1 ml-[220px] flex flex-col min-h-screen">
          <TopBar />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
