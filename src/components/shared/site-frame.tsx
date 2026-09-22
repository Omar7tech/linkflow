"use client";

import { usePathname } from "next/navigation";

/** Tools that take over the whole window: no site header, no footer, no page scroll. */
const WORKSPACES = ["/tools/website-builder"];

export function SiteFrame({
  children,
  header,
  footer,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  if (WORKSPACES.includes(usePathname())) {
    return <main className="h-dvh min-h-0 overflow-hidden">{children}</main>;
  }
  return (
    <>
      {header}
      <main className="flex flex-1 flex-col">{children}</main>
      {footer}
    </>
  );
}
