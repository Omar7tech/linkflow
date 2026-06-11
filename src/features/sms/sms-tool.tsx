"use client";

import { Controller } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { OutputCard } from "@/components/shared/output-card";
import { PhoneInput } from "@/components/shared/phone-input";
import { TOOL_BY_ID } from "@/constants/tools";
import { useGenerator } from "@/hooks/useGenerator";
import { buildSmsLink } from "@/lib/linkBuilders";
import { smsSchema } from "@/lib/validators";

interface SmsValues {
  phone: string;
  body?: string;
}

const SEGMENT_LENGTH = 160;

export function SmsTool() {
  const { form, values, output, commit, history } = useGenerator<SmsValues>({
    toolId: "sms",
    schema: smsSchema,
    defaultValues: { phone: "", body: "" },
    build: (v) => buildSmsLink(v.phone, v.body),
    historyLabel: (v) => `SMS to ${v.phone}`,
  });

  const bodyLength = values.body?.length ?? 0;
  const segments = Math.max(1, Math.ceil(bodyLength / SEGMENT_LENGTH));

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.sms}
      output={
        <OutputCard
          output={output}
          snippetLabel="Text us"
          onAction={commit}
          filename="sms-qr"
          emptyHint="Enter a valid phone number and your sms: link appears instantly."
        />
      }
      footer={<HistoryPanel history={history} />}
    >
      <Card>
        <CardContent className="space-y-5">
          <Field
            label="Phone number"
            htmlFor="sms-phone"
            error={form.formState.errors.phone?.message}
            hint="The number that will receive the text."
          >
            <Controller
              control={form.control}
              name="phone"
              render={({ field, fieldState }) => (
                <PhoneInput
                  id="sms-phone"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
          <Field
            label="Prefilled message"
            htmlFor="sms-body"
            optional
            error={form.formState.errors.body?.message}
            hint={
              bodyLength > 0
                ? `${bodyLength} characters · ${segments} SMS segment${segments > 1 ? "s" : ""}`
                : "Keep it under 160 characters to fit one SMS segment."
            }
          >
            <Textarea
              id="sms-body"
              rows={4}
              placeholder="Hi! I'd like to book an appointment."
              {...form.register("body")}
            />
          </Field>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
