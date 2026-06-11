"use client";

import { Controller } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { OutputCard } from "@/components/shared/output-card";
import { PhoneInput } from "@/components/shared/phone-input";
import { TOOL_BY_ID } from "@/constants/tools";
import { useGenerator } from "@/hooks/useGenerator";
import { buildTelLink } from "@/lib/linkBuilders";
import { telSchema } from "@/lib/validators";

export function TelTool() {
  const { form, output, commit, history } = useGenerator<{ phone: string }>({
    toolId: "tel",
    schema: telSchema,
    defaultValues: { phone: "" },
    build: (v) => buildTelLink(v.phone),
    historyLabel: (v) => `Call ${v.phone}`,
  });

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.tel}
      output={
        <OutputCard
          output={output}
          snippetLabel="Call us"
          onAction={commit}
          filename="call-qr"
          emptyHint="Enter a valid phone number to get a tap-to-call link."
        />
      }
      footer={<HistoryPanel history={history} />}
    >
      <Card>
        <CardContent className="space-y-5">
          <Field
            label="Phone number"
            htmlFor="tel-phone"
            error={form.formState.errors.phone?.message}
            hint="Validated live against international numbering plans."
          >
            <Controller
              control={form.control}
              name="phone"
              render={({ field, fieldState }) => (
                <PhoneInput
                  id="tel-phone"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
              )}
            />
          </Field>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
