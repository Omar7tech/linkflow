import { Loader2Icon } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading page">
      <Loader2Icon className="text-muted-foreground size-6 animate-spin" aria-hidden />
    </div>
  );
}
