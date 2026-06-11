"use client";

import { ExternalLinkIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/copy-button";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useGenerator } from "@/hooks/useGenerator";
import { useMounted } from "@/hooks/useMounted";
import { SHARE_PLATFORMS } from "@/lib/linkBuilders";
import { shareSchema } from "@/lib/validators";

interface ShareValues {
  url: string;
  text?: string;
}

export function ShareTool() {
  const { form, values, output, commit, history } = useGenerator<ShareValues>({
    toolId: "share",
    schema: shareSchema,
    // The "output" here is the canonical URL being shared.
    build: (v) => v.url,
    defaultValues: { url: "", text: "" },
    historyLabel: (v) => `Share ${v.url}`,
  });

  const text = values.text ?? "";
  const mounted = useMounted();
  const canNativeShare = mounted && typeof navigator.share === "function";

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.share}
      output={
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="text-base">Share links</CardTitle>
            <CardDescription>
              {output
                ? "One link per network — copy them into buttons, emails or posts."
                : "Enter a URL to generate share links for every network."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canNativeShare && (
              <Button
                type="button"
                className="w-full"
                disabled={!output}
                onClick={async () => {
                  if (!output) return;
                  try {
                    await navigator.share({ url: output, text: text || undefined });
                    commit();
                  } catch {
                    // Dismissed.
                  }
                }}
              >
                <Share2Icon /> Share via device
              </Button>
            )}
            <ul className="space-y-2">
              {SHARE_PLATFORMS.map((platform) => {
                const link = output ? platform.buildUrl(output, text) : null;
                return (
                  <li
                    key={platform.id}
                    className="border-border bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    <span className="flex-1 text-sm font-medium">{platform.name}</span>
                    <CopyButton
                      text={link ?? ""}
                      label=""
                      variant="ghost"
                      size="icon-sm"
                      disabled={!link}
                      onCopied={commit}
                      successMessage={`${platform.name} link copied`}
                      aria-label={`Copy ${platform.name} share link`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={!link}
                      aria-label={`Open ${platform.name} share dialog`}
                      onClick={() => {
                        if (!link) return;
                        window.open(link, "_blank", "noopener,noreferrer");
                        commit();
                      }}
                    >
                      <ExternalLinkIcon />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      }
      footer={<HistoryPanel history={history} />}
    >
      <Card>
        <CardContent className="space-y-5">
          <Field
            label="URL to share"
            htmlFor="share-url"
            error={form.formState.errors.url?.message}
            hint="Bare domains work too — we'll add https:// for you."
          >
            <Input
              id="share-url"
              type="url"
              inputMode="url"
              placeholder="example.com/blog/launch"
              aria-invalid={!!form.formState.errors.url}
              {...form.register("url")}
            />
          </Field>
          <Field
            label="Message"
            htmlFor="share-text"
            optional
            error={form.formState.errors.text?.message}
            hint="Added as the post text where the network supports it."
          >
            <Textarea
              id="share-text"
              rows={3}
              placeholder="We just launched! Take a look:"
              {...form.register("text")}
            />
          </Field>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
