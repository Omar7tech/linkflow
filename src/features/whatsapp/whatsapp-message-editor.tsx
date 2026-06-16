"use client";

import * as React from "react";
import {
  BoldIcon,
  CheckCheckIcon,
  CodeIcon,
  ItalicIcon,
  StrikethroughIcon,
  UserRoundIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/useMounted";
import { whatsappToHtml } from "@/lib/whatsapp-format";

const TEXTAREA_CLASS =
  "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

interface MessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  rows?: number;
  placeholder?: string;
  /** Name shown in the preview's chat header. */
  contactName?: string;
}

const TOOLS = [
  { icon: BoldIcon, open: "*", label: "Bold" },
  { icon: ItalicIcon, open: "_", label: "Italic" },
  { icon: StrikethroughIcon, open: "~", label: "Strikethrough" },
  { icon: CodeIcon, open: "```", label: "Monospace" },
] as const;

export function MessageEditor({
  value,
  onChange,
  onBlur,
  id,
  rows = 4,
  placeholder,
  contactName,
}: MessageEditorProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  /** Wrap the current selection (or caret) in a WhatsApp formatting marker. */
  const wrap = (marker: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const inner = value.slice(start, end);
    const next = value.slice(0, start) + marker + inner + marker + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + marker.length;
      el.setSelectionRange(caret, caret + inner.length);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => (
          <Button
            key={t.label}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => wrap(t.open)}
            title={`${t.label} — wraps selection in ${t.open}`}
            aria-label={t.label}
          >
            <t.icon />
          </Button>
        ))}
        <span className="text-muted-foreground ml-auto text-[11px]">
          WhatsApp formatting + new lines
        </span>
      </div>

      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={TEXTAREA_CLASS}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />

      <WhatsAppChatPreview text={value} contactName={contactName} />
    </div>
  );
}

function WhatsAppChatPreview({ text, contactName }: { text: string; contactName?: string }) {
  const mounted = useMounted();
  const time = React.useMemo(
    () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    []
  );
  const html = React.useMemo(() => whatsappToHtml(text), [text]);

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      {/* Chat header */}
      <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2 text-white dark:bg-[#202c33]">
        <span className="flex size-7 items-center justify-center rounded-full bg-white/25">
          <UserRoundIcon className="size-4" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-medium">{contactName?.trim() || "WhatsApp"}</div>
          <div className="text-[10px] text-white/70">online</div>
        </div>
      </div>

      {/* Chat body */}
      <div className="flex min-h-[120px] flex-col justify-end gap-1 bg-[#efeae2] p-3 dark:bg-[#0b141a]">
        <div className="flex justify-end">
          <div className="relative max-w-[85%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-2.5 py-1.5 text-sm text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
            {text.trim() ? (
              <span
                className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <span className="text-[#667781] italic dark:text-[#8696a0]">
                Your message preview…
              </span>
            )}
            <span className="float-right mt-1 ml-2 flex items-center gap-0.5 text-[10px] text-[#667781] dark:text-[#8696a0]">
              {mounted ? time : ""}
              <CheckCheckIcon className="size-3.5 text-[#53bdeb]" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
