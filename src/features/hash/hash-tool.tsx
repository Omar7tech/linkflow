"use client";

import * as React from "react";
import { CheckCircle2Icon, FileIcon, ShieldCheckIcon, XCircleIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/copy-button";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  ALGORITHMS,
  HMAC_ALGORITHMS,
  hashBytes,
  hmacBytes,
  toBase64,
  toHex,
  type HashAlgorithm,
} from "@/lib/hash";
import { cn } from "@/lib/utils";

type InputMode = "text" | "file";
type OutputFormat = "hex" | "base64";

type Results = Partial<Record<HashAlgorithm, Uint8Array>>;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function HashTool() {
  const [mode, setMode] = React.useState<InputMode>("text");
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [hmac, setHmac] = React.useState(false);
  const [hmacKey, setHmacKey] = React.useState("");
  const [format, setFormat] = React.useState<OutputFormat>("hex");
  const [uppercase, setUppercase] = React.useState(false);
  const [expected, setExpected] = React.useState("");
  const [results, setResults] = React.useState<Results>({});
  const [computing, setComputing] = React.useState(false);

  const data = React.useMemo(() => {
    if (mode === "file") return file?.bytes ?? null;
    return text.length > 0 ? new TextEncoder().encode(text) : null;
  }, [mode, text, file]);

  // Web Crypto rejects zero-length HMAC keys — wait until one is typed.
  const hmacReady = !hmac || hmacKey.length > 0;

  React.useEffect(() => {
    if (!data || !hmacReady) return;
    let cancelled = false;
    const algos = hmac ? HMAC_ALGORITHMS : ALGORITHMS;
    queueMicrotask(() => {
      if (cancelled) return;
      setComputing(true);
      Promise.all(
        algos.map(
          async (algo) =>
            [algo, hmac ? await hmacBytes(algo, hmacKey, data) : await hashBytes(algo, data)] as const
        )
      )
        .then((entries) => {
          if (cancelled) return;
          setResults(Object.fromEntries(entries));
        })
        .finally(() => {
          if (!cancelled) setComputing(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [data, hmac, hmacKey, hmacReady]);

  // Stale digests are hidden as soon as the input empties — no clearing effect needed.
  const shownResults = React.useMemo<Results>(
    () => (data && hmacReady ? results : {}),
    [data, hmacReady, results]
  );

  const render = React.useCallback(
    (bytes: Uint8Array) => {
      if (format === "base64") return toBase64(bytes);
      const hex = toHex(bytes);
      return uppercase ? hex.toUpperCase() : hex;
    },
    [format, uppercase]
  );

  // Match the expected checksum against every computed digest in both formats.
  const matchedAlgo = React.useMemo(() => {
    const needle = expected.trim();
    if (!needle) return null;
    for (const [algo, bytes] of Object.entries(shownResults) as [HashAlgorithm, Uint8Array][]) {
      if (toHex(bytes) === needle.toLowerCase() || toBase64(bytes) === needle) return algo;
    }
    return "none" as const;
  }, [expected, shownResults]);

  const visibleAlgos = hmac ? HMAC_ALGORITHMS : ALGORITHMS;
  const hasResults = Object.keys(shownResults).length > 0;
  const copyAll = visibleAlgos
    .filter((a) => shownResults[a])
    .map((a) => `${a}: ${render(shownResults[a]!)}`)
    .join("\n");

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.hash}
      output={
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="text-base">Digests</CardTitle>
            <CardDescription>
              {hasResults
                ? hmac
                  ? "HMAC signatures with your key."
                  : "Every algorithm, computed live."
                : !hmacReady
                  ? "Enter a secret key to compute HMAC signatures."
                  : "Type some text or pick a file to hash."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={format} onValueChange={(v) => setFormat(v as OutputFormat)}>
                <SelectTrigger className="h-8 w-28" aria-label="Output format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hex">Hex</SelectItem>
                  <SelectItem value="base64">Base64</SelectItem>
                </SelectContent>
              </Select>
              {format === "hex" && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={uppercase} onCheckedChange={setUppercase} aria-label="Uppercase hex" />
                  Uppercase
                </label>
              )}
            </div>

            <div className="space-y-3">
              {visibleAlgos.map((algo) => {
                const bytes = shownResults[algo];
                return (
                  <div key={algo} className="bg-muted/50 border-border rounded-lg border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className={cn("text-xs font-medium", matchedAlgo === algo && "text-emerald-600 dark:text-emerald-400")}>
                        {hmac ? `HMAC-${algo}` : algo}
                        {matchedAlgo === algo && " — checksum matches"}
                      </span>
                      <CopyButton text={bytes ? render(bytes) : ""} disabled={!bytes} label="" variant="ghost" size="sm" />
                    </div>
                    <code className="block min-h-4 font-mono text-xs break-all">
                      {bytes ? render(bytes) : computing ? "…" : "—"}
                    </code>
                  </div>
                );
              })}
            </div>

            <CopyButton text={copyAll} disabled={!hasResults} label="Copy all" variant="outline" />

            <Separator />
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Hashing happens entirely in your browser — text, files and keys never leave the page.
              MD5, SHA-1 and CRC32 are fine as checksums but broken for security; prefer SHA-256+.
            </p>
          </CardContent>
        </Card>
      }
    >
      <Card>
        <CardContent className="space-y-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as InputMode)}>
            <TabsList className="w-full">
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="file">File</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "text" ? (
            <Field label="Input text" htmlFor="hash-text" hint="Hashed as UTF-8, exactly as typed — whitespace counts.">
              <Textarea
                id="hash-text"
                rows={6}
                placeholder="Paste or type anything…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="hash-file">File</Label>
              <Input
                id="hash-file"
                type="file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setFile({ name: f.name, size: f.size, bytes: new Uint8Array(await f.arrayBuffer()) });
                }}
              />
              {file && (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <FileIcon className="size-3.5" aria-hidden />
                  {file.name} · {formatFileSize(file.size)}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                Read locally, never uploaded. Large files may take a moment.
              </p>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium">HMAC mode</span>
                <span className="text-muted-foreground block text-xs">
                  Sign the input with a secret key (SHA family only).
                </span>
              </span>
              <Switch checked={hmac} onCheckedChange={setHmac} aria-label="HMAC mode" />
            </label>
            {hmac && (
              <Field label="Secret key" htmlFor="hash-key">
                <Input
                  id="hash-key"
                  placeholder="your-secret-key"
                  value={hmacKey}
                  onChange={(e) => setHmacKey(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            )}
          </div>

          <Separator />

          <Field
            label="Verify a checksum"
            htmlFor="hash-expected"
            optional
            hint="Paste an expected hash — it's compared against every digest above."
          >
            <Input
              id="hash-expected"
              placeholder="e.g. 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              autoComplete="off"
              className="font-mono text-xs"
            />
          </Field>
          {matchedAlgo && hasResults && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm",
                matchedAlgo === "none"
                  ? "text-destructive"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
              role="status"
            >
              {matchedAlgo === "none" ? (
                <>
                  <XCircleIcon className="size-4" aria-hidden /> No digest matches — the data differs
                  or the checksum uses another algorithm.
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="size-4" aria-hidden /> Matches {hmac ? `HMAC-${matchedAlgo}` : matchedAlgo} — the data is intact.
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
