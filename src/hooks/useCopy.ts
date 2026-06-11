"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export function useCopy(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string, successMessage = "Copied to clipboard") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(successMessage);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), resetAfterMs);
        return true;
      } catch {
        toast.error("Couldn't access the clipboard");
        return false;
      }
    },
    [resetAfterMs]
  );

  return { copied, copy };
}
