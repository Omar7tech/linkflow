"use client";

import { Controller } from "react-hook-form";
import { BuildingIcon, DownloadIcon, GlobeIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { OutputCard } from "@/components/shared/output-card";
import { PhoneInput } from "@/components/shared/phone-input";
import { TOOL_BY_ID } from "@/constants/tools";
import { useGenerator } from "@/hooks/useGenerator";
import { buildVCard, type VCardFields } from "@/lib/linkBuilders";
import { downloadText } from "@/lib/qr";
import { vcardSchema } from "@/lib/validators";

export function VCardTool() {
  const { form, values, output, commit, history } = useGenerator<VCardFields>({
    toolId: "vcard",
    schema: vcardSchema,
    defaultValues: {
      firstName: "",
      lastName: "",
      organization: "",
      jobTitle: "",
      phoneMobile: "",
      phoneWork: "",
      email: "",
      website: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      note: "",
    },
    build: buildVCard,
    historyLabel: (v) => `vCard: ${[v.firstName, v.lastName].filter(Boolean).join(" ")}`,
  });
  const errors = form.formState.errors;

  const fullName = [values.firstName, values.lastName].filter(Boolean).join(" ");
  const filename = `${(fullName || "contact").replace(/\s+/g, "-").toLowerCase()}.vcf`;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.vcard}
      output={
        <div className="space-y-4">
          {/* Live business-card preview */}
          <div
            aria-label="Business card preview"
            className="border-border from-muted/60 to-muted/20 rounded-xl border bg-gradient-to-br p-5 shadow-sm"
          >
            <p className="text-lg font-semibold">{fullName || "Your Name"}</p>
            <p className="text-muted-foreground text-sm">
              {[values.jobTitle, values.organization].filter(Boolean).join(" · ") ||
                "Job title · Company"}
            </p>
            <Separator className="my-3" />
            <ul className="text-muted-foreground space-y-1.5 text-xs">
              {values.phoneMobile && (
                <li className="flex items-center gap-2">
                  <PhoneIcon className="size-3" /> {values.phoneMobile}
                </li>
              )}
              {values.email && (
                <li className="flex items-center gap-2">
                  <MailIcon className="size-3" /> {values.email}
                </li>
              )}
              {values.website && (
                <li className="flex items-center gap-2">
                  <GlobeIcon className="size-3" /> {values.website}
                </li>
              )}
              {values.organization && (
                <li className="flex items-center gap-2">
                  <BuildingIcon className="size-3" /> {values.organization}
                </li>
              )}
              {(values.city || values.country) && (
                <li className="flex items-center gap-2">
                  <MapPinIcon className="size-3" />
                  {[values.city, values.country].filter(Boolean).join(", ")}
                </li>
              )}
              {!values.phoneMobile && !values.email && !values.website && (
                <li>Contact details appear here as you type.</li>
              )}
            </ul>
          </div>

          <OutputCard
            output={output}
            snippetLabel={fullName || "Contact"}
            onAction={commit}
            filename="vcard-qr"
            openable={false}
            showSnippets={false}
            emptyHint="Add at least a first name to build your vCard."
          >
            <Button
              type="button"
              disabled={!output}
              onClick={() => {
                if (!output) return;
                downloadText(output, filename, "text/vcard");
                commit();
              }}
            >
              <DownloadIcon /> Download {filename}
            </Button>
          </OutputCard>
        </div>
      }
      footer={<HistoryPanel history={history} />}
    >
      <Card>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" htmlFor="vc-first" error={errors.firstName?.message}>
              <Input id="vc-first" placeholder="Maya" autoComplete="given-name" aria-invalid={!!errors.firstName} {...form.register("firstName")} />
            </Field>
            <Field label="Last name" htmlFor="vc-last" optional>
              <Input id="vc-last" placeholder="Haddad" autoComplete="family-name" {...form.register("lastName")} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company" htmlFor="vc-org" optional>
              <Input id="vc-org" placeholder="Acme Inc." autoComplete="organization" {...form.register("organization")} />
            </Field>
            <Field label="Job title" htmlFor="vc-title" optional>
              <Input id="vc-title" placeholder="Product Designer" autoComplete="organization-title" {...form.register("jobTitle")} />
            </Field>
          </div>

          <Separator />

          <Field label="Mobile phone" htmlFor="vc-mobile" optional error={errors.phoneMobile?.message}>
            <Controller
              control={form.control}
              name="phoneMobile"
              render={({ field, fieldState }) => (
                <PhoneInput
                  id="vc-mobile"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
          <Field label="Work phone" htmlFor="vc-work" optional error={errors.phoneWork?.message}>
            <Controller
              control={form.control}
              name="phoneWork"
              render={({ field, fieldState }) => (
                <PhoneInput
                  id="vc-work"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" htmlFor="vc-email" optional error={errors.email?.message}>
              <Input id="vc-email" type="email" placeholder="maya@acme.com" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
            </Field>
            <Field label="Website" htmlFor="vc-site" optional>
              <Input id="vc-site" placeholder="https://acme.com" autoComplete="url" {...form.register("website")} />
            </Field>
          </div>

          <Separator />

          <Field label="Street" htmlFor="vc-street" optional>
            <Input id="vc-street" placeholder="42 Hamra Street" autoComplete="street-address" {...form.register("street")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="City" htmlFor="vc-city" optional>
              <Input id="vc-city" placeholder="Beirut" {...form.register("city")} />
            </Field>
            <Field label="State" htmlFor="vc-state" optional>
              <Input id="vc-state" placeholder="—" {...form.register("state")} />
            </Field>
            <Field label="ZIP" htmlFor="vc-zip" optional>
              <Input id="vc-zip" placeholder="1103" autoComplete="postal-code" {...form.register("zip")} />
            </Field>
          </div>
          <Field label="Country" htmlFor="vc-country" optional>
            <Input id="vc-country" placeholder="Lebanon" autoComplete="country-name" {...form.register("country")} />
          </Field>
          <Field label="Note" htmlFor="vc-note" optional error={errors.note?.message}>
            <Textarea id="vc-note" rows={2} placeholder="Met at Web Summit 2026" {...form.register("note")} />
          </Field>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
