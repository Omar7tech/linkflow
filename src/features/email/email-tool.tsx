"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { OutputCard } from "@/components/shared/output-card";
import { TOOL_BY_ID } from "@/constants/tools";
import { useGenerator } from "@/hooks/useGenerator";
import { buildMailtoLink } from "@/lib/linkBuilders";
import { mailtoSchema } from "@/lib/validators";

interface MailtoValues {
  to: string;
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
}

export function EmailTool() {
  const { form, output, commit, history } = useGenerator<MailtoValues>({
    toolId: "email",
    schema: mailtoSchema,
    defaultValues: { to: "", subject: "", body: "", cc: "", bcc: "" },
    build: buildMailtoLink,
    historyLabel: (v) => `Email to ${v.to}`,
  });
  const errors = form.formState.errors;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.email}
      output={
        <OutputCard
          output={output}
          snippetLabel="Email us"
          onAction={commit}
          filename="email-qr"
          emptyHint="Add a recipient and the mailto: link builds itself."
        />
      }
      footer={<HistoryPanel history={history} />}
    >
      <Card>
        <CardContent className="space-y-5">
          <Field
            label="To"
            htmlFor="mail-to"
            error={errors.to?.message}
            hint="Separate multiple recipients with commas."
          >
            <Input
              id="mail-to"
              type="email"
              placeholder="hello@example.com"
              autoComplete="email"
              aria-invalid={!!errors.to}
              {...form.register("to")}
            />
          </Field>
          <Field label="Subject" htmlFor="mail-subject" optional error={errors.subject?.message}>
            <Input
              id="mail-subject"
              placeholder="Question about your product"
              {...form.register("subject")}
            />
          </Field>
          <Field label="Body" htmlFor="mail-body" optional error={errors.body?.message}>
            <Textarea
              id="mail-body"
              rows={5}
              placeholder={"Hi,\n\nI'd love to learn more about…"}
              {...form.register("body")}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="CC" htmlFor="mail-cc" optional error={errors.cc?.message}>
              <Input id="mail-cc" placeholder="cc@example.com" aria-invalid={!!errors.cc} {...form.register("cc")} />
            </Field>
            <Field label="BCC" htmlFor="mail-bcc" optional error={errors.bcc?.message}>
              <Input id="mail-bcc" placeholder="bcc@example.com" aria-invalid={!!errors.bcc} {...form.register("bcc")} />
            </Field>
          </div>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
