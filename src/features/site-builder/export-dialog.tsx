"use client";

import { useMemo } from "react";
import { DownloadIcon, ExternalLinkIcon, FileCodeIcon, FolderArchiveIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildFiles, buildSite } from "@/lib/site-builder-render";
import { slugify, type Site } from "@/lib/site-builder";
import { buildZip } from "@/lib/zip";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site;
}

const kb = (text: string) => `${Math.max(1, Math.round(new Blob([text]).size / 1024))} KB`;

function save(content: string | Blob, name: string, type = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ExportDialog({ open, onOpenChange, site }: ExportDialogProps) {
  const built = useMemo(() => (open ? buildSite(site) : null), [open, site]);
  const files = useMemo(() => (open ? buildFiles(site) : []), [open, site]);
  const base = slugify(site.name) || "website";

  if (!built) return null;

  const openInTab = () => {
    const url = URL.createObjectURL(new Blob([built.html], { type: "text/html" }));
    const tab = window.open(url, "_blank", "noopener");
    if (!tab) toast.error("Your browser blocked the new tab.");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const downloadZip = () => {
    const encoder = new TextEncoder();
    save(buildZip(files.map((file) => ({ name: file.name, data: encoder.encode(file.content) }))), `${base}.zip`);
    toast.success("Folder downloaded. Drag it onto Netlify Drop to go live.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Your website is ready</DialogTitle>
          <DialogDescription>
            Plain HTML and CSS. No build step, no framework, no account. It runs on any host, including free ones.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="download">
          <TabsList className="w-full">
            <TabsTrigger value="download" className="flex-1">Download</TabsTrigger>
            <TabsTrigger value="code" className="flex-1">Copy the code</TabsTrigger>
            <TabsTrigger value="publish" className="flex-1">Put it online</TabsTrigger>
          </TabsList>

          <TabsContent value="download" className="space-y-3 pt-4">
            <button
              onClick={() => {
                save(built.html, `${base}.html`, "text/html;charset=utf-8");
                toast.success("Downloaded. That one file is the whole website.");
              }}
              className="border-border hover:border-primary/60 hover:bg-muted/40 flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors"
            >
              <FileCodeIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">One file: {base}.html</span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-5">
                  Everything inside a single page: styles, pictures and all. Easiest to email, upload or open from a USB stick. {kb(built.html)}.
                </span>
              </span>
              <DownloadIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            </button>

            <button
              onClick={downloadZip}
              className="border-border hover:border-primary/60 hover:bg-muted/40 flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors"
            >
              <FolderArchiveIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">A folder: {base}.zip</span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-5">
                  {files.map((file) => file.name).join(", ")}. The tidy version a developer would expect, with instructions included.
                </span>
              </span>
              <DownloadIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            </button>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={openInTab}>
                <ExternalLinkIcon />
                Open the finished page
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  save(JSON.stringify([site], null, 2), `${base}-project.json`, "application/json");
                  toast.success("Project file saved. Import it to carry on elsewhere.");
                }}
              >
                <DownloadIcon />
                Save the editable project
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="code" className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              <CopyButton text={built.html} label="Copy the whole page" successMessage="HTML copied" size="sm" />
              <CopyButton text={built.css} label="Copy the stylesheet" successMessage="CSS copied" variant="outline" size="sm" />
            </div>
            <pre className="bg-muted/50 max-h-72 overflow-auto rounded-xl p-4 text-[11px] leading-5">
              <code>{built.html.slice(0, 4000)}{built.html.length > 4000 ? "\n\n… copy the full file with the button above" : ""}</code>
            </pre>
            <p className="text-muted-foreground text-xs leading-5">
              The stylesheet starts with a <code>:root</code> block. Every colour, size and spacing value on the page comes from there, so
              one edit changes the whole design.
            </p>
          </TabsContent>

          <TabsContent value="publish" className="space-y-3 pt-4">
            <Step n={1} title="Netlify Drop, about ten seconds">
              Download the folder above, open <ExternalLink href="https://app.netlify.com/drop">app.netlify.com/drop</ExternalLink> and drag it
              onto the page. You get a live address immediately, free, no account needed to start.
            </Step>
            <Step n={2} title="Cloudflare Pages">
              <ExternalLink href="https://pages.cloudflare.com">pages.cloudflare.com</ExternalLink> → Create → Upload assets → drag the same folder.
            </Step>
            <Step n={3} title="GitHub Pages">
              Upload the files to a repository, then Settings → Pages → Deploy from branch → <code>main / root</code>.
            </Step>
            <Step n={4} title="Hosting you already pay for">
              Upload the files into the public folder, usually called <code>public_html</code> or <code>www</code>, using FTP or your host&apos;s
              file manager. <code>index.html</code> must sit at the top of it.
            </Step>
            <p className="text-muted-foreground text-xs leading-5">
              Your own domain: buy it anywhere, then point it at whichever host you picked. All four let you do this from their dashboard.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="bg-primary/10 text-primary grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">{n}</span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-5">{children}</p>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  );
}
