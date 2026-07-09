"use client";

import * as React from "react";
import { ImageIcon, PlusIcon, PrinterIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "INR"] as const;

interface Item {
  id: string;
  desc: string;
  qty: number;
  price: number;
}

interface InvoiceState {
  logo: string | null; // data URL
  bizName: string;
  bizDetails: string; // address / email / phone, free-form lines
  clientName: string;
  clientDetails: string;
  number: string;
  date: string;
  due: string;
  currency: (typeof CURRENCIES)[number];
  taxRate: number;
  discount: number; // flat amount
  notes: string;
  items: Item[];
  accent: "emerald" | "slate";
}

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT: InvoiceState = {
  logo: null,
  bizName: "",
  bizDetails: "",
  clientName: "",
  clientDetails: "",
  number: "INV-0001",
  date: today(),
  due: "",
  currency: "USD",
  taxRate: 0,
  discount: 0,
  notes: "",
  items: [{ id: uid(), desc: "", qty: 1, price: 0 }],
  accent: "emerald",
};

const KEY = "invoice-tool-v1";

/** Bump INV-0007 → INV-0008; leaves non-numeric numbers alone. */
function nextNumber(n: string): string {
  const m = /^(.*?)(\d+)$/.exec(n);
  if (!m) return n;
  return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0");
}

export function InvoiceTool() {
  const [inv, setInv] = React.useState<InvoiceState>(DEFAULT);
  const set = <K extends keyof InvoiceState>(k: K, v: InvoiceState[K]) =>
    setInv((p) => ({ ...p, [k]: v }));

  // Restore in an effect so server and first client render match.
  /* eslint-disable react-hooks/set-state-in-effect */
  const restored = React.useRef(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<InvoiceState>;
        setInv({
          ...DEFAULT,
          ...s,
          currency: CURRENCIES.includes(s.currency as "USD") ? (s.currency as "USD") : "USD",
          items:
            Array.isArray(s.items) && s.items.length
              ? s.items.map((i) => ({
                  id: typeof i?.id === "string" ? i.id : uid(),
                  desc: typeof i?.desc === "string" ? i.desc : "",
                  qty: typeof i?.qty === "number" && i.qty >= 0 ? i.qty : 1,
                  price: typeof i?.price === "number" && i.price >= 0 ? i.price : 0,
                }))
              : DEFAULT.items,
        });
      }
    } catch {
      // Corrupt draft — start fresh.
    }
    restored.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(inv));
      } catch {
        // Storage full (likely a huge logo) — persistence is best-effort.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [inv]);

  const money = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, { style: "currency", currency: inv.currency }).format,
    [inv.currency]
  );
  const subtotal = inv.items.reduce((s, i) => s + i.qty * i.price, 0);
  const discount = Math.min(inv.discount, subtotal);
  const tax = (subtotal - discount) * (inv.taxRate / 100);
  const total = subtotal - discount + tax;

  const updateItem = (id: string, patch: Partial<Item>) =>
    set(
      "items",
      inv.items.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );

  const loadLogo = (file: File) => {
    if (file.size > 400_000) {
      toast.error("Keep the logo under 400 KB — it's stored in your browser.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logo", reader.result as string);
    reader.readAsDataURL(file);
  };

  const newInvoice = () => {
    setInv((p) => ({
      ...p,
      number: nextNumber(p.number),
      date: today(),
      due: "",
      discount: 0,
      notes: p.notes,
      clientName: "",
      clientDetails: "",
      items: [{ id: uid(), desc: "", qty: 1, price: 0 }],
    }));
    toast.success("New invoice started — number bumped, your business details kept.");
  };

  const accent = inv.accent === "emerald" ? "#059669" : "#334155";

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.invoice}
      wideOutput
      output={
        <Card>
          <CardContent className="space-y-3">
            {/* Print CSS — only the sheet is visible when printing. */}
            <style>{`@media print {
              body * { visibility: hidden !important; }
              #invoice-sheet, #invoice-sheet * { visibility: visible !important; }
              #invoice-sheet { position: absolute !important; left: 0; top: 0; width: 100% !important; max-width: none !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; }
              @page { margin: 14mm; }
            }`}</style>
            <div
              id="invoice-sheet"
              className="mx-auto w-full max-w-[720px] rounded-xl border bg-white p-8 text-neutral-900 shadow-sm sm:p-10"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-3">
                  {inv.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={inv.logo} alt="" className="max-h-14 w-auto object-contain" />
                  )}
                  <div>
                    <p className="text-base font-semibold">{inv.bizName || "Your business"}</p>
                    <p className="text-xs whitespace-pre-line text-neutral-500">
                      {inv.bizDetails}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight" style={{ color: accent }}>
                    INVOICE
                  </p>
                  <p className="mt-1 font-mono text-sm">{inv.number}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    Issued {inv.date || "—"}
                    {inv.due && (
                      <>
                        <br />
                        Due {inv.due}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
                  Billed to
                </p>
                <p className="mt-1 text-sm font-semibold">{inv.clientName || "Client name"}</p>
                <p className="text-xs whitespace-pre-line text-neutral-500">
                  {inv.clientDetails}
                </p>
              </div>

              <table className="mt-8 w-full text-sm">
                <thead>
                  <tr
                    className="text-[11px] tracking-wide uppercase"
                    style={{ color: accent }}
                  >
                    <th className="border-b pb-2 text-left font-medium">Description</th>
                    <th className="border-b pb-2 text-right font-medium">Qty</th>
                    <th className="border-b pb-2 text-right font-medium">Price</th>
                    <th className="border-b pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((i) => (
                    <tr key={i.id} className="border-b border-neutral-100">
                      <td className="py-2.5 pr-2">{i.desc || "—"}</td>
                      <td className="py-2.5 text-right tabular-nums">{i.qty}</td>
                      <td className="py-2.5 text-right tabular-nums">{money(i.price)}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        {money(i.qty * i.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 ml-auto w-56 space-y-1.5 text-sm">
                <div className="flex justify-between text-neutral-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{money(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-neutral-500">
                    <span>Discount</span>
                    <span className="tabular-nums">−{money(discount)}</span>
                  </div>
                )}
                {inv.taxRate > 0 && (
                  <div className="flex justify-between text-neutral-500">
                    <span>Tax ({inv.taxRate}%)</span>
                    <span className="tabular-nums">{money(tax)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between border-t pt-2 text-base font-semibold"
                  style={{ color: accent }}
                >
                  <span>Total</span>
                  <span className="tabular-nums">{money(total)}</span>
                </div>
              </div>

              {inv.notes && (
                <div className="mt-8 border-t pt-4">
                  <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
                    Notes
                  </p>
                  <p className="mt-1 text-xs whitespace-pre-line text-neutral-600">{inv.notes}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted-foreground flex-1 text-xs">
                Everything is saved in your browser as you type
              </p>
              <Button variant="outline" size="sm" onClick={newInvoice}>
                <RotateCcwIcon /> New invoice
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <PrinterIcon /> Print / PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Your business
            </Label>
            <div className="flex items-center gap-3">
              <label className="border-border hover:bg-muted/50 relative flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed">
                {inv.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inv.logo} alt="Logo" className="size-full object-contain" />
                ) : (
                  <ImageIcon className="text-muted-foreground size-5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Upload logo"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadLogo(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  placeholder="Business name"
                  value={inv.bizName}
                  onChange={(e) => set("bizName", e.target.value)}
                />
                {inv.logo && (
                  <Button variant="ghost" size="sm" onClick={() => set("logo", null)}>
                    <XIcon /> Remove logo
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              placeholder={"Address\nemail@business.com\n+1 555 000 000"}
              rows={3}
              value={inv.bizDetails}
              onChange={(e) => set("bizDetails", e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Bill to
            </Label>
            <Input
              placeholder="Client name"
              value={inv.clientName}
              onChange={(e) => set("clientName", e.target.value)}
            />
            <Textarea
              placeholder={"Client address\nclient@email.com"}
              rows={3}
              value={inv.clientDetails}
              onChange={(e) => set("clientDetails", e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Invoice details
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-no">Number</Label>
                <Input
                  id="inv-no"
                  value={inv.number}
                  onChange={(e) => set("number", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Tabs
                  value={inv.currency}
                  onValueChange={(v) => set("currency", v as "USD")}
                >
                  <TabsList className="grid w-full grid-cols-4">
                    {CURRENCIES.slice(0, 4).map((c) => (
                      <TabsTrigger key={c} value={c}>
                        {c}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsList className="mt-1 grid w-full grid-cols-4">
                    {CURRENCIES.slice(4).map((c) => (
                      <TabsTrigger key={c} value={c}>
                        {c}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-date">Issued</Label>
                <Input
                  id="inv-date"
                  type="date"
                  value={inv.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-due">Due</Label>
                <Input
                  id="inv-due"
                  type="date"
                  value={inv.due}
                  onChange={(e) => set("due", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-tax">Tax %</Label>
                <Input
                  id="inv-tax"
                  type="number"
                  min={0}
                  max={100}
                  value={inv.taxRate}
                  onChange={(e) => set("taxRate", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-disc">Discount</Label>
                <Input
                  id="inv-disc"
                  type="number"
                  min={0}
                  value={inv.discount}
                  onChange={(e) => set("discount", Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Accent</Label>
              <Tabs value={inv.accent} onValueChange={(v) => set("accent", v as "emerald")}>
                <TabsList>
                  <TabsTrigger value="emerald">Emerald</TabsTrigger>
                  <TabsTrigger value="slate">Slate</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Line items
            </Label>
            {inv.items.map((i) => (
              <div key={i.id} className="flex items-start gap-2">
                <Input
                  placeholder="Description"
                  className="flex-1"
                  value={i.desc}
                  onChange={(e) => updateItem(i.id, { desc: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  aria-label="Quantity"
                  className={cn("w-16 text-right")}
                  value={i.qty}
                  onChange={(e) => updateItem(i.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label="Unit price"
                  className="w-24 text-right"
                  value={i.price}
                  onChange={(e) =>
                    updateItem(i.id, { price: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove item"
                  disabled={inv.items.length === 1}
                  onClick={() => set("items", inv.items.filter((x) => x.id !== i.id))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => set("items", [...inv.items, { id: uid(), desc: "", qty: 1, price: 0 }])}
            >
              <PlusIcon /> Add item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Notes</Label>
            <Textarea
              placeholder="Payment terms, bank details, a thank-you…"
              rows={3}
              value={inv.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
