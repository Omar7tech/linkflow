"use client";

import * as React from "react";
import { DicesIcon, ListIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  assessStrength,
  generatePassphrase,
  generatePin,
  generateRandom,
  passphraseEntropy,
  pinEntropy,
  randomEntropy,
  type PassphraseOptions,
  type PasswordMode,
  type RandomOptions,
} from "@/lib/password";
import { cn } from "@/lib/utils";
import { BruteForceDemo } from "./bruteforce-demo";

const LENGTH_PRESETS = [12, 16, 24, 32];

const SEPARATORS = [
  { value: "-", label: "Hyphen (-)" },
  { value: ".", label: "Period (.)" },
  { value: "_", label: "Underscore (_)" },
  { value: " ", label: "Space" },
];

const SCORE_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-emerald-500",
];

export function PasswordTool() {
  const [mode, setMode] = React.useState<PasswordMode>("random");
  const [randomOpts, setRandomOpts] = React.useState<RandomOptions>({
    length: 16,
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: false,
    requireEachSet: true,
  });
  const [phraseOpts, setPhraseOpts] = React.useState<PassphraseOptions>({
    words: 5,
    separator: "-",
    capitalize: true,
    includeNumber: false,
  });
  const [pinLength, setPinLength] = React.useState(6);
  const [password, setPassword] = React.useState("");
  const [batch, setBatch] = React.useState<string[]>([]);

  const generate = React.useCallback(() => {
    if (mode === "random") return generateRandom(randomOpts);
    if (mode === "passphrase") return generatePassphrase(phraseOpts);
    return generatePin(pinLength);
  }, [mode, randomOpts, phraseOpts, pinLength]);

  // Deferred a microtask so randomness only runs client-side, after hydration,
  // without a synchronous setState inside the effect body.
  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPassword(generate());
      setBatch([]);
    });
    return () => {
      cancelled = true;
    };
  }, [generate]);

  const bits =
    mode === "random"
      ? randomEntropy(randomOpts)
      : mode === "passphrase"
        ? passphraseEntropy(phraseOpts)
        : pinEntropy(pinLength);
  const strength = assessStrength(bits);

  const setRandom = <K extends keyof RandomOptions>(key: K, value: RandomOptions[K]) =>
    setRandomOpts((prev) => ({ ...prev, [key]: value }));
  const setPhrase = <K extends keyof PassphraseOptions>(key: K, value: PassphraseOptions[K]) =>
    setPhraseOpts((prev) => ({ ...prev, [key]: value }));

  const tool = TOOL_BY_ID.password;

  return (
    <GeneratorLayout
      tool={tool}
      output={
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="text-base">Your password</CardTitle>
            <CardDescription>
              {password ? "Ready — copy it straight into your vault." : "Enable at least one character set."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 border-border min-h-16 rounded-lg border p-3">
              {password ? (
                <ColoredPassword value={password} />
              ) : (
                <span className="text-muted-foreground text-xs">Waiting for options…</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyButton text={password} disabled={!password} />
              <Button
                type="button"
                variant="outline"
                disabled={!password}
                onClick={() => setPassword(generate())}
              >
                <DicesIcon /> Regenerate
              </Button>
            </div>

            {password && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{strength.label}</span>
                    <span className="text-muted-foreground text-xs">~{strength.bits} bits of entropy</span>
                  </div>
                  <div className="flex gap-1" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength.score} aria-label={`Password strength: ${strength.label}`}>
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          i <= strength.score - 1 ? SCORE_COLORS[strength.score] : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Cracking this offline at 10 billion guesses/sec would take{" "}
                    <span className="text-foreground font-medium">{strength.crackTime}</span>.
                  </p>
                  <div className="pt-1">
                    <BruteForceDemo />
                  </div>
                </div>
              </>
            )}

            <Separator />
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Generated with a cryptographically secure random source. Passwords are never stored
              or logged — there is deliberately no history for this tool.
            </p>
          </CardContent>
        </Card>
      }
      footer={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How strong is strong enough?</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground grid gap-4 text-sm sm:grid-cols-3">
            <p>
              <span className="text-foreground font-medium">60+ bits</span> resists offline attacks
              against leaked password databases — a 12-character random mix or a 5-word passphrase
              gets you there.
            </p>
            <p>
              <span className="text-foreground font-medium">Passphrases</span> are easier to type
              and remember at the same strength. Use them for master passwords you type daily;
              use random strings for accounts a password manager fills in.
            </p>
            <p>
              <span className="text-foreground font-medium">Uniqueness beats complexity.</span> A
              reused strong password falls with the weakest site that holds it — generate a fresh
              one per account.
            </p>
          </CardContent>
        </Card>
      }
    >
      <Card>
        <CardContent className="space-y-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as PasswordMode)}>
            <TabsList className="w-full">
              <TabsTrigger value="random">Random</TabsTrigger>
              <TabsTrigger value="passphrase">Passphrase</TabsTrigger>
              <TabsTrigger value="pin">PIN</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "random" && (
            <div className="space-y-5">
              <SliderField
                label="Length"
                value={randomOpts.length}
                min={8}
                max={64}
                onChange={(v) => setRandom("length", v)}
              />
              <div className="flex flex-wrap gap-1.5">
                {LENGTH_PRESETS.map((len) => (
                  <Badge key={len} asChild variant={randomOpts.length === len ? "default" : "outline"} className="cursor-pointer">
                    <button type="button" onClick={() => setRandom("length", len)}>
                      {len} chars
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SwitchRow label="Uppercase" sample="A–Z" checked={randomOpts.upper} onChange={(v) => setRandom("upper", v)} />
                <SwitchRow label="Lowercase" sample="a–z" checked={randomOpts.lower} onChange={(v) => setRandom("lower", v)} />
                <SwitchRow label="Digits" sample="0–9" checked={randomOpts.digits} onChange={(v) => setRandom("digits", v)} />
                <SwitchRow label="Symbols" sample="!@#$%…" checked={randomOpts.symbols} onChange={(v) => setRandom("symbols", v)} />
              </div>

              <Separator />

              <SwitchRow
                label="Exclude look-alikes"
                sample="drops 0 O o 1 l I |"
                checked={randomOpts.excludeAmbiguous}
                onChange={(v) => setRandom("excludeAmbiguous", v)}
              />
              <SwitchRow
                label="Require every set"
                sample="at least one of each enabled type"
                checked={randomOpts.requireEachSet}
                onChange={(v) => setRandom("requireEachSet", v)}
              />
            </div>
          )}

          {mode === "passphrase" && (
            <div className="space-y-5">
              <SliderField
                label="Words"
                value={phraseOpts.words}
                min={3}
                max={8}
                onChange={(v) => setPhrase("words", v)}
              />
              <div className="space-y-1.5">
                <Label htmlFor="pw-separator">Separator</Label>
                <Select value={phraseOpts.separator} onValueChange={(v) => setPhrase("separator", v)}>
                  <SelectTrigger id="pw-separator" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEPARATORS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SwitchRow
                label="Capitalize words"
                sample="Maple-Crystal-Otter"
                checked={phraseOpts.capitalize}
                onChange={(v) => setPhrase("capitalize", v)}
              />
              <SwitchRow
                label="Add a number"
                sample="appends two digits to one word"
                checked={phraseOpts.includeNumber}
                onChange={(v) => setPhrase("includeNumber", v)}
              />
            </div>
          )}

          {mode === "pin" && (
            <SliderField label="Digits" value={pinLength} min={4} max={12} onChange={setPinLength} />
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Need a batch?</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setBatch(Array.from({ length: 8 }, generate))}>
                <ListIcon /> Generate 8
              </Button>
            </div>
            {batch.length > 0 && (
              <ul className="divide-border border-border divide-y rounded-lg border">
                {batch.map((pw, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                    <code className="min-w-0 flex-1 truncate font-mono text-xs">{pw}</code>
                    <CopyButton text={pw} label="" variant="ghost" size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}

/** Digits and symbols tinted so the structure is scannable at a glance. */
function ColoredPassword({ value }: { value: string }) {
  return (
    <code className="block font-mono text-sm break-all">
      {value.split("").map((char, i) => (
        <span
          key={i}
          className={cn(
            /\d/.test(char) && "text-sky-600 dark:text-sky-400",
            /[^a-zA-Z0-9]/.test(char) && "text-rose-600 dark:text-rose-400"
          )}
        >
          {char}
        </span>
      ))}
    </code>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
    </div>
  );
}

function SwitchRow({
  label,
  sample,
  checked,
  onChange,
}: {
  label: string;
  sample: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="border-border hover:bg-muted/40 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block truncate font-mono text-xs">{sample}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}
