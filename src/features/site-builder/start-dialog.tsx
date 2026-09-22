"use client";

import { useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Site } from "@/lib/site-builder";
import {
  EMPTY_STARTER, RECIPES, VIBES, blankSite, buildStarter, recipeById, type StarterInput,
} from "@/lib/site-builder-templates";

interface StartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (site: Site) => void;
  /** The first visit has nothing to go back to. */
  dismissible?: boolean;
}

/**
 * Three questions, one finished website. The point is that nobody starts from
 * an empty page: by the time this closes there is real copy on screen to react
 * to, which is a far easier job than writing from nothing.
 */
export function StartDialog({ open, onOpenChange, onCreate, dismissible = true }: StartDialogProps) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<StarterInput>(EMPTY_STARTER);
  const recipe = recipeById(input.recipe);

  const set = (patch: Partial<StarterInput>) => setInput((current) => ({ ...current, ...patch }));

  const finish = () => {
    onCreate(buildStarter({ ...input, brand: input.brand || recipe.brand }));
    onOpenChange(false);
    setStep(0);
    setInput(EMPTY_STARTER);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (dismissible || !next ? onOpenChange(next) : null)}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-3xl" showCloseButton={dismissible}>
        <DialogHeader className="border-border/70 border-b px-6 py-5">
          <DialogTitle className="font-heading text-xl">
            {step === 0 ? "What are you making?" : step === 1 ? "Tell me about it" : "Pick a look"}
          </DialogTitle>
          <DialogDescription>
            {step === 0
              ? "Pick the closest match. Every section, headline and price is yours to change afterwards."
              : step === 1
                ? "Four short answers. Leave anything blank and it becomes an example you can fill in later."
                : "Only the colours, type and spacing change here. Your words stay exactly as they are."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          {step === 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {RECIPES.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    set({ recipe: entry.id, vibe: entry.vibe, brand: entry.brand });
                    setStep(1);
                  }}
                  className={cn(
                    "group rounded-xl border p-3.5 text-left transition-colors",
                    input.recipe === entry.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/25 hover:bg-muted/40",
                  )}
                >
                  <span className="text-xl" aria-hidden>{entry.emoji}</span>
                  <span className="mt-1.5 block text-sm font-semibold">{entry.name}</span>
                  <span className="text-muted-foreground mt-1 block text-xs leading-5">{entry.blurb}</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="sb-start-name" label="Business or your name" hint="Appears in the menu, the footer and the browser tab.">
                <Input id="sb-start-name" autoFocus value={input.name} placeholder="Casa Verde" onChange={(event) => set({ name: event.target.value })} />
              </Field>
              <Field id="sb-start-city" label="Town or city" hint="Used in the headline and for local search.">
                <Input id="sb-start-city" value={input.city} placeholder="Porto" onChange={(event) => set({ city: event.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field id="sb-start-tagline" label="Your promise in one line" hint="What you do and for whom. Leave blank for a suggestion.">
                  <Input id="sb-start-tagline" value={input.tagline} placeholder="Cooked fresh, eaten slowly" onChange={(event) => set({ tagline: event.target.value })} />
                </Field>
              </div>
              <Field id="sb-start-email" label="Email" hint="Where the contact form sends messages.">
                <Input id="sb-start-email" value={input.email} placeholder="hello@casaverde.pt" onChange={(event) => set({ email: event.target.value })} />
              </Field>
              <Field id="sb-start-phone" label="Phone" hint="Optional. Shown in the footer and contact section.">
                <Input id="sb-start-phone" value={input.phone} placeholder="+351 912 345 678" onChange={(event) => set({ phone: event.target.value })} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-3">
                {VIBES.map((vibe) => (
                  <button
                    key={vibe.id}
                    onClick={() => set({ vibe: vibe.id })}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      input.vibe === vibe.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/25",
                    )}
                  >
                    <span className="block text-sm font-semibold">{vibe.name}</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs leading-5">{vibe.note}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="sb-start-brand" className="text-xs">Main colour</Label>
                <input
                  id="sb-start-brand"
                  type="color"
                  value={input.brand || recipe.brand}
                  onChange={(event) => set({ brand: event.target.value })}
                  className="border-border size-9 cursor-pointer rounded-md border bg-transparent p-0.5"
                />
                <span className="text-muted-foreground text-xs">You can change every part of the design later.</span>
              </div>

              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs font-medium">You will get</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {recipe.sections}. Written for a {recipe.name.toLowerCase()}
                  {input.city ? ` in ${input.city}` : ""}, ready to edit.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-border/70 bg-muted/20 flex items-center justify-between gap-3 border-t px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (step === 0) {
                onCreate(blankSite());
                onOpenChange(false);
              } else setStep(step - 1);
            }}
          >
            {step === 0 ? "Start from an empty page" : <><ArrowLeftIcon />Back</>}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">Step {step + 1} of 3</span>
            {step < 2 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next
                <ArrowRightIcon />
              </Button>
            ) : (
              <Button size="sm" onClick={finish}>
                <SparklesIcon />
                Build my website
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
      <p className="text-muted-foreground text-[11px] leading-4">{hint}</p>
    </div>
  );
}
