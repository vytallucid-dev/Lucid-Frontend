import type { ReactNode } from "react";

export default function DataLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-col min-h-[calc(100vh-56px)]">{children}</div>;
}
