import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { SidebarProvider } from "@/components/SidebarContext";
import { MainContent } from "@/components/MainContent";

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
        <SidebarProvider>
          <Sidebar />
          <MainContent>
            <TopBar />
            <main className="flex-1">{children}</main>
          </MainContent>
        </SidebarProvider>
      </body>
    </html>
  );
}
