"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/useCopy";

interface CopyButtonProps extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  text: string;
  label?: string;
  successMessage?: string;
  onCopied?: () => void;
}

export function CopyButton({
  text,
  label = "Copy",
  successMessage,
  onCopied,
  ...props
}: CopyButtonProps) {
  const { copied, copy } = useCopy();

  return (
    <Button
      type="button"
      onClick={async () => {
        if (await copy(text, successMessage)) onCopied?.();
      }}
      {...props}
    >
      {copied ? <CheckIcon className="text-green-500" /> : <CopyIcon />}
      {label && <span>{copied ? "Copied" : label}</span>}
    </Button>
  );
}
