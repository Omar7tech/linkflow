"use client";

import { usePathname } from "next/navigation";

export function SiteFrame({ children, header, footer }: { children: React.ReactNode; header: React.ReactNode; footer: React.ReactNode }) {
  const workspace = usePathname() === "/tools/prompt-workbench";
  if (workspace) return <main className="h-dvh min-h-0 overflow-hidden">{children}</main>;
  return <>{header}<main className="flex flex-1 flex-col">{children}</main>{footer}</>;
}
