"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buildSite } from "@/lib/site-builder-render";
import type { Site } from "@/lib/site-builder";

export type Device = "desktop" | "tablet" | "phone";

export const DEVICE_WIDTH: Record<Device, number> = { desktop: 0, tablet: 834, phone: 390 };

interface CanvasProps {
  site: Site;
  selected: string;
  device: Device;
  /** Click-to-type directly on the page. */
  inline: boolean;
  onSelect: (id: string, field: string) => void;
  onInlineEdit: (id: string, path: string, value: string) => void;
  onShortcut: (key: string, shift: boolean) => void;
  scrollTo: { id: string; at: number } | null;
}

interface CanvasMessage {
  source?: string;
  type?: string;
  id?: string;
  field?: string;
  path?: string;
  value?: string | number;
  key?: string;
  shift?: boolean;
}

/**
 * The page under construction, rendered in a sandboxed iframe so its CSS can
 * never leak into the builder (and the builder's can never flatter it).
 *
 * Two things keep it feeling live rather than reloaded: edits that start inside
 * the frame do not trigger a rebuild (the caret would jump), and every rebuild
 * carries the last scroll position back in.
 */
export function Canvas({ site, selected, device, inline, onSelect, onInlineEdit, onShortcut, scrollTo }: CanvasProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const scroll = useRef(0);
  const fromFrame = useRef(false);
  const [doc, setDoc] = useState("");
  const [scale, setScale] = useState(1);

  // Messages from the page: selection, inline edits, scroll position, shortcuts.
  useEffect(() => {
    const handle = (event: MessageEvent<CanvasMessage>) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "sb-canvas") return;
      if (data.type === "scroll" && typeof data.value === "number") scroll.current = data.value;
      if (data.type === "select" && data.id) onSelect(data.id, typeof data.field === "string" ? data.field : "");
      if (data.type === "edit" && data.id && data.path) {
        fromFrame.current = true;
        onInlineEdit(data.id, data.path, String(data.value ?? ""));
      }
      if (data.type === "key" && data.key) onShortcut(data.key, !!data.shift);
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [onSelect, onInlineEdit, onShortcut]);

  // Rebuild — skipped for edits that came from inside the frame.
  useEffect(() => {
    if (fromFrame.current) {
      fromFrame.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setDoc(buildSite(site, { editing: true, selected, scroll: scroll.current }).html);
    }, 140);
    return () => clearTimeout(timer);
    // `selected` is pushed over postMessage instead, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, inline]);

  // Selection highlight without a reload.
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "select", id: selected }, "*");
  }, [selected, doc]);

  useEffect(() => {
    if (!scrollTo) return;
    frame.current?.contentWindow?.postMessage({ type: "scrollTo", id: scrollTo.id }, "*");
  }, [scrollTo]);

  // Scale the phone/tablet frame down when the column is narrower than the device.
  const measure = useCallback(() => {
    const width = DEVICE_WIDTH[device];
    if (!width || !shell.current) {
      setScale(1);
      return;
    }
    const available = shell.current.clientWidth - 32;
    setScale(Math.min(1, available / width));
  }, [device]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (shell.current) observer.observe(shell.current);
    return () => observer.disconnect();
  }, [measure]);

  const width = DEVICE_WIDTH[device];

  return (
    <div ref={shell} className="bg-muted/40 relative flex min-h-0 flex-1 justify-center overflow-auto p-0 sm:p-4">
      <div
        className={cn(
          "bg-background relative w-full origin-top overflow-hidden transition-[width] duration-300",
          width ? "border-border/80 rounded-2xl border shadow-2xl shadow-black/10" : "rounded-none sm:rounded-xl sm:border",
        )}
        style={width ? { width, minWidth: width, transform: `scale(${scale})`, height: `calc((100% - 2rem) / ${scale})` } : undefined}
      >
        <iframe
          ref={frame}
          title="Your website preview"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-popups allow-forms"
          srcDoc={doc}
        />
        {!doc && (
          <div className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">Building your page…</div>
        )}
      </div>
    </div>
  );
}
