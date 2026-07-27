"use client";

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lt-backdrop flex flex-col min-h-[calc(100vh-56px)]">
      {children}
    </div>
  );
}
