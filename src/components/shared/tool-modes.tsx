"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolModesSlot } from "./generator-layout";

export interface ToolMode {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** The tool shown in this mode. It renders its own GeneratorLayout. */
  Tool: React.ComponentType;
}

const noSubscribe = () => () => {};

/**
 * Several tools living at one address, switched by a row of tabs under the
 * shared title. Each mode is a complete tool; the tabs are handed down to
 * whichever one is showing, which places them through its GeneratorLayout.
 * `?mode=<id>` in the URL picks the opening mode, so old links to a tool that
 * was folded in here still land on it.
 */
export function ModedTool({ modes, label }: { modes: readonly ToolMode[]; label: string }) {
  const fromUrl = React.useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("mode"),
    () => null
  );
  const [picked, setPicked] = React.useState<string | null>(null);
  const active = modes.find((m) => m.id === (picked ?? fromUrl)) ?? modes[0];

  const tabs = (
    <Tabs value={active.id} onValueChange={setPicked}>
      <TabsList aria-label={label} className="h-auto flex-wrap">
        {modes.map((m) => (
          <TabsTrigger key={m.id} value={m.id}>
            {m.icon && <m.icon className="size-4" aria-hidden />} {m.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <ToolModesSlot value={tabs}>
      <active.Tool />
    </ToolModesSlot>
  );
}
