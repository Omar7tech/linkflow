"use client";

import * as React from "react";
import { Controller } from "react-hook-form";
import { DownloadIcon, FileSpreadsheetIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { OutputCard } from "@/components/shared/output-card";
import { PhoneInput } from "@/components/shared/phone-input";
import { PresetsBar } from "@/components/shared/presets-bar";
import { CopyButton } from "@/components/shared/copy-button";
import { TOOL_BY_ID } from "@/constants/tools";
import { useGenerator } from "@/hooks/useGenerator";
import { useHistory } from "@/hooks/useHistory";
import { usePresets } from "@/hooks/usePresets";
import { parseBulkCsv } from "@/lib/csv";
import {
  buildWhatsAppLink,
  buildWhatsAppMessageLink,
  formatWhatsAppGroupInvite,
} from "@/lib/linkBuilders";
import { dataUrlToBlob, qrToPngDataUrl } from "@/lib/qr";
import { isValidPhone } from "@/lib/validators";
import {
  whatsappChatSchema,
  whatsappGroupSchema,
  whatsappMessageSchema,
} from "@/lib/validators";
import { DEFAULT_QR_OPTIONS } from "@/types";
import { WhatsAppButtonGallery } from "./whatsapp-button-gallery";

interface ChatValues {
  phone: string;
  message?: string;
}

export function WhatsAppTool() {
  const history = useHistory("whatsapp");
  const presets = usePresets<Record<string, unknown>>("whatsapp");
  const [tab, setTab] = React.useState("chat");

  const chat = useGenerator<ChatValues>({
    toolId: "whatsapp",
    schema: whatsappChatSchema,
    defaultValues: { phone: "", message: "" },
    build: (v) => buildWhatsAppLink(v.phone, v.message),
    historyLabel: (v) => `Chat with ${v.phone}`,
    history,
  });

  const messageOnly = useGenerator<{ message: string }>({
    toolId: "whatsapp",
    schema: whatsappMessageSchema,
    defaultValues: { message: "" },
    build: (v) => buildWhatsAppMessageLink(v.message),
    historyLabel: (v) => `Message: ${v.message.slice(0, 40)}`,
    history,
  });

  const group = useGenerator<{ invite: string }>({
    toolId: "whatsapp",
    schema: whatsappGroupSchema,
    defaultValues: { invite: "" },
    build: (v) => formatWhatsAppGroupInvite(v.invite),
    historyLabel: () => "Group invite",
    history,
  });

  // --- Bulk mode -----------------------------------------------------------
  const [csv, setCsv] = React.useState("");
  const [zipping, setZipping] = React.useState(false);

  const bulkRows = React.useMemo(() => {
    return parseBulkCsv(csv).map((row) => {
      const valid = isValidPhone(row.phone);
      return {
        ...row,
        valid,
        link: valid ? buildWhatsAppLink(row.phone, row.message) : null,
      };
    });
  }, [csv]);
  const validRows = bulkRows.filter((r) => r.link);

  const downloadZip = async () => {
    if (validRows.length === 0) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const csvLines = ["phone,link"];
      for (const row of validRows) {
        const dataUrl = await qrToPngDataUrl(row.link as string, DEFAULT_QR_OPTIONS);
        zip.file(`qr-${row.phone.replace(/[^\d]/g, "")}.png`, await dataUrlToBlob(dataUrl));
        csvLines.push(`${row.phone},${row.link}`);
      }
      zip.file("links.csv", csvLines.join("\n"));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "whatsapp-links.zip";
      a.click();
      URL.revokeObjectURL(url);
      history.add(`Bulk: ${validRows.length} links`, `${validRows.length} WhatsApp links + QR codes`);
      toast.success(`ZIP with ${validRows.length} QR codes downloaded`);
    } catch {
      toast.error("Couldn't build the ZIP — try fewer rows");
    } finally {
      setZipping(false);
    }
  };

  const activeLink =
    tab === "chat"
      ? chat.output
      : tab === "message"
        ? messageOnly.output
        : tab === "group"
          ? group.output
          : null;

  const outputs: Record<string, React.ReactNode> = {
    chat: (
      <OutputCard
        output={chat.output}
        snippetLabel="Chat on WhatsApp"
        onAction={chat.commit}
        filename="whatsapp-qr"
        emptyHint="Enter a valid phone number and your wa.me link appears instantly."
      />
    ),
    message: (
      <OutputCard
        output={messageOnly.output}
        snippetLabel="Send via WhatsApp"
        onAction={messageOnly.commit}
        filename="whatsapp-message-qr"
        emptyHint="Type a message — the recipient picks who to send it to."
      />
    ),
    group: (
      <OutputCard
        output={group.output}
        snippetLabel="Join our WhatsApp group"
        onAction={group.commit}
        filename="whatsapp-group-qr"
        emptyHint="Paste a group invite link or code to get a clean, shareable link."
      />
    ),
    bulk: (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk results</CardTitle>
          <CardDescription>
            {bulkRows.length === 0
              ? "Paste one number per line to see results."
              : `${validRows.length} of ${bulkRows.length} rows are valid.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bulkRows.length > 0 && (
            <ul className="max-h-72 space-y-1.5 overflow-auto">
              {bulkRows.map((row, i) => (
                <li
                  key={`${row.raw}-${i}`}
                  className="border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${row.valid ? "bg-green-500" : "bg-destructive"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {row.link ?? `${row.phone} — invalid number`}
                  </span>
                  {row.link && (
                    <CopyButton text={row.link} label="" variant="ghost" size="icon-xs" aria-label={`Copy link for ${row.phone}`} />
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={validRows.length === 0 || zipping} onClick={downloadZip}>
              {zipping ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
              ZIP of QR codes
            </Button>
            <CopyButton
              text={validRows.map((r) => r.link).join("\n")}
              label="Copy all links"
              variant="outline"
              disabled={validRows.length === 0}
              successMessage={`${validRows.length} links copied`}
            />
          </div>
        </CardContent>
      </Card>
    ),
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.whatsapp}
      output={outputs[tab]}
      footer={
        <>
          <WhatsAppButtonGallery link={activeLink} />
          <HistoryPanel history={history} />
        </>
      }
    >
      <Card>
        <CardContent className="pt-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="chat" className="flex-1">Chat link</TabsTrigger>
              <TabsTrigger value="message" className="flex-1">Message only</TabsTrigger>
              <TabsTrigger value="group" className="flex-1">Group</TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1">
                <FileSpreadsheetIcon className="size-3.5" /> Bulk
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="space-y-5 pt-4">
              <Field
                label="Phone number"
                htmlFor="wa-phone"
                error={chat.form.formState.errors.phone?.message}
                hint="Pick the country, then type the national number."
              >
                <Controller
                  control={chat.form.control}
                  name="phone"
                  render={({ field, fieldState }) => (
                    <PhoneInput
                      id="wa-phone"
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
                htmlFor="wa-message"
                optional
                error={chat.form.formState.errors.message?.message}
                hint={`${chat.values.message?.length ?? 0} / 4096 characters`}
              >
                <Textarea
                  id="wa-message"
                  rows={4}
                  placeholder="Hi! I'm interested in your services…"
                  {...chat.form.register("message")}
                />
              </Field>
              <PresetsBar
                presets={presets.presets}
                onSave={presets.save}
                onDelete={presets.remove}
                getValues={() => ({ ...chat.form.getValues() })}
                onApply={(values) => {
                  chat.form.reset(values as unknown as ChatValues);
                  setTab("chat");
                }}
              />
            </TabsContent>

            <TabsContent value="message" className="space-y-5 pt-4">
              <Field
                label="Message"
                htmlFor="wa-msg-only"
                error={messageOnly.form.formState.errors.message?.message}
                hint="Recipients choose a contact after tapping the link — great for 'share this' campaigns."
              >
                <Textarea
                  id="wa-msg-only"
                  rows={5}
                  placeholder="Check out this amazing offer: https://example.com"
                  {...messageOnly.form.register("message")}
                />
              </Field>
            </TabsContent>

            <TabsContent value="group" className="space-y-5 pt-4">
              <Field
                label="Invite link or code"
                htmlFor="wa-group"
                error={group.form.formState.errors.invite?.message}
                hint="Find it in WhatsApp under Group info → Invite via link."
              >
                <Textarea
                  id="wa-group"
                  rows={2}
                  placeholder="https://chat.whatsapp.com/AbCdEfGh1234567890"
                  {...group.form.register("invite")}
                />
              </Field>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-5 pt-4">
              <Field
                label="CSV input"
                htmlFor="wa-bulk"
                hint='One row per link: "+9613123456, Optional message". Message column may be quoted.'
              >
                <Textarea
                  id="wa-bulk"
                  rows={8}
                  className="font-mono text-xs"
                  placeholder={"+96171123456, Hi from LinkFlow!\n+14155550123\n+447911123456, \"Hello, world\""}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                />
              </Field>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
