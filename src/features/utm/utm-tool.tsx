"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { OutputCard } from "@/components/shared/output-card";
import { PresetsBar } from "@/components/shared/presets-bar";
import { TOOL_BY_ID } from "@/constants/tools";
import { useGenerator } from "@/hooks/useGenerator";
import { usePresets } from "@/hooks/usePresets";
import { buildUtmUrl } from "@/lib/linkBuilders";
import { utmSchema } from "@/lib/validators";

interface UtmValues {
  url: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

const CHANNEL_PRESETS: { label: string; source: string; medium: string }[] = [
  { label: "Google Ads", source: "google", medium: "cpc" },
  { label: "Facebook", source: "facebook", medium: "paid_social" },
  { label: "Instagram", source: "instagram", medium: "social" },
  { label: "Newsletter", source: "newsletter", medium: "email" },
  { label: "LinkedIn", source: "linkedin", medium: "social" },
  { label: "QR poster", source: "poster", medium: "qr" },
];

export function UtmTool() {
  const { form, output, commit, history } = useGenerator<UtmValues>({
    toolId: "utm",
    schema: utmSchema,
    defaultValues: { url: "", source: "", medium: "", campaign: "", term: "", content: "" },
    build: buildUtmUrl,
    historyLabel: (v) => `${v.campaign} (${v.source}/${v.medium})`,
  });
  const presets = usePresets<Record<string, unknown>>("utm");
  const errors = form.formState.errors;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.utm}
      output={
        <OutputCard
          output={output}
          snippetLabel="Visit campaign"
          onAction={commit}
          filename="campaign-qr"
          emptyHint="Fill the URL plus source, medium and campaign to build a tracked link."
        />
      }
      footer={<HistoryPanel history={history} />}
    >
      <Card>
        <CardContent className="space-y-5">
          <Field
            label="Destination URL"
            htmlFor="utm-url"
            error={errors.url?.message}
            hint="Existing query parameters are preserved."
          >
            <Input
              id="utm-url"
              type="url"
              inputMode="url"
              placeholder="example.com/spring-sale"
              aria-invalid={!!errors.url}
              {...form.register("url")}
            />
          </Field>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Channel presets</span>
            <div className="flex flex-wrap gap-1.5">
              {CHANNEL_PRESETS.map((preset) => (
                <Badge
                  key={preset.label}
                  asChild
                  variant="outline"
                  className="cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue("source", preset.source, { shouldValidate: true });
                      form.setValue("medium", preset.medium, { shouldValidate: true });
                    }}
                  >
                    {preset.label}
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Source" htmlFor="utm-source" error={errors.source?.message} hint="utm_source — where traffic comes from.">
              <Input id="utm-source" placeholder="google" aria-invalid={!!errors.source} {...form.register("source")} />
            </Field>
            <Field label="Medium" htmlFor="utm-medium" error={errors.medium?.message} hint="utm_medium — the marketing channel.">
              <Input id="utm-medium" placeholder="cpc" aria-invalid={!!errors.medium} {...form.register("medium")} />
            </Field>
          </div>
          <Field label="Campaign" htmlFor="utm-campaign" error={errors.campaign?.message} hint="utm_campaign — the promotion or initiative name.">
            <Input id="utm-campaign" placeholder="spring_sale_2026" aria-invalid={!!errors.campaign} {...form.register("campaign")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Term" htmlFor="utm-term" optional hint="utm_term — paid keyword.">
              <Input id="utm-term" placeholder="qr+code+generator" {...form.register("term")} />
            </Field>
            <Field label="Content" htmlFor="utm-content" optional hint="utm_content — differentiates ad variants.">
              <Input id="utm-content" placeholder="hero_banner" {...form.register("content")} />
            </Field>
          </div>

          <PresetsBar
            presets={presets.presets}
            onSave={presets.save}
            onDelete={presets.remove}
            getValues={() => ({ ...form.getValues() })}
            onApply={(values) => form.reset(values as unknown as UtmValues)}
          />
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
