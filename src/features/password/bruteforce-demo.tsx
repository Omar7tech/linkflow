"use client";

import * as React from "react";
import { ShieldAlertIcon, TerminalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Sample {
  password: string;
  reason: string;
  /** Honest real-world verdict, shown after the demo cracks it. */
  verdict: string;
}

const SAMPLES: Sample[] = [
  { password: "123456", reason: "Top of every breach list", verdict: "guessed instantly" },
  { password: "password", reason: "A dictionary word", verdict: "guessed instantly" },
  { password: "qwerty123", reason: "A keyboard pattern", verdict: "cracked in milliseconds" },
  { password: "Summer2024", reason: "Word + year", verdict: "cracked in seconds" },
];

const SCRAMBLE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
const TICK_MS = 45;
const TICKS_PER_CHAR = 7;

export function BruteForceDemo() {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<Sample>(SAMPLES[1]);
  const [display, setDisplay] = React.useState("");
  const [guesses, setGuesses] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Clean up the timer if the component unmounts mid-animation.
  React.useEffect(() => stop, [stop]);

  const crack = React.useCallback(
    (sample: Sample) => {
      stop();
      setActive(sample);
      setDone(false);
      setRunning(true);
      setGuesses(0);
      setDisplay("");

      const target = sample.password;
      let tick = 0;
      let locked = 0;
      let total = 0;

      intervalRef.current = setInterval(() => {
        tick += 1;
        // Each "tick" stands in for a burst of an attacker's guesses.
        total += 900 + Math.floor(Math.random() * 2600);
        setGuesses(total);

        if (tick % TICKS_PER_CHAR === 0 && locked < target.length) locked += 1;

        const fixed = target.slice(0, locked);
        const scrambled = Array.from(
          { length: target.length - locked },
          () => SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
        ).join("");
        setDisplay(fixed + scrambled);

        if (locked >= target.length) {
          stop();
          setDisplay(target);
          setRunning(false);
          setDone(true);
        }
      }, TICK_MS);
    },
    [stop]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          stop();
          setRunning(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ShieldAlertIcon /> What is brute force?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TerminalIcon className="size-4" /> How weak passwords get cracked
          </DialogTitle>
          <DialogDescription>
            A <strong>brute-force attack</strong> tries password after password — billions per
            second on a single modern GPU — until one matches. Short or common passwords have so few
            possibilities that they fall almost instantly. Watch a sped-up demo:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <span className="text-xs font-medium">Pick a weak password to attack</span>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLES.map((sample) => (
              <Badge
                key={sample.password}
                asChild
                variant={active.password === sample.password ? "default" : "outline"}
                className="cursor-pointer"
              >
                <button type="button" onClick={() => crack(sample)}>
                  {sample.password}
                </button>
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">{active.reason}.</p>
        </div>

        {/* Terminal */}
        <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 font-mono text-xs text-zinc-100">
          <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
            <span className="size-2.5 rounded-full bg-red-500" />
            <span className="size-2.5 rounded-full bg-yellow-500" />
            <span className="size-2.5 rounded-full bg-green-500" />
            <span className="ml-2 text-[10px] text-zinc-400">brute-force — simulation</span>
          </div>
          <div className="space-y-1 p-3 leading-relaxed">
            <div className="text-zinc-400">
              <span className="text-green-400">$</span> crack --target {"•".repeat(active.password.length)}
            </div>
            {display || running || done ? (
              <>
                <div>
                  <span className="text-zinc-500">trying:</span>{" "}
                  <span className={cn(done ? "text-green-400" : "text-amber-300")}>
                    {display || "…"}
                  </span>
                  {running && <span className="ml-0.5 animate-pulse">▋</span>}
                </div>
                <div className="text-zinc-500">
                  guesses: <span className="text-zinc-300">{guesses.toLocaleString()}</span>
                </div>
                {done && (
                  <div className="pt-1 text-green-400">
                    [+] MATCH FOUND — “{active.password}” {active.verdict}
                  </div>
                )}
              </>
            ) : (
              <div className="text-zinc-500">› ready — pick a password above to begin</div>
            )}
          </div>
        </div>

        <div className="bg-muted/50 border-border space-y-2 rounded-lg border p-3 text-xs">
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">The animation is illustrative</span> —
            real cracking doesn&apos;t reveal characters one by one. And these examples are even
            weaker than they look: every one is in public leak lists, so an attacker finds them by
            lookup before brute force even starts.
          </p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">Why length wins:</span> each extra random
            character multiplies the possibilities. A 16-character random password would take a
            GPU farm longer than the age of the universe — that&apos;s the gap this generator builds
            for you.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
