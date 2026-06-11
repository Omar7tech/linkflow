"use client";

import {
  useForm,
  useWatch,
  type DefaultValues,
  type FieldValues,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { ToolId } from "@/types";
import { useHistory } from "./useHistory";

interface UseGeneratorOptions<TValues extends FieldValues, TParsed> {
  toolId: ToolId;
  schema: z.ZodType<TParsed>;
  defaultValues: DefaultValues<TValues>;
  /** Pure builder — receives the parsed (post-transform) values. */
  build: (values: TParsed) => string;
  /** Short label stored alongside the output in history. */
  historyLabel: (values: TParsed) => string;
  /** Share one history instance across multiple generators on a page. */
  history?: ReturnType<typeof useHistory>;
}

/**
 * Shared generator pattern used by every tool:
 * RHF form + zod validation + a live output computed on each change.
 * History is written via `commit()` when the user actually copies/opens/shares.
 */
export function useGenerator<TValues extends FieldValues, TParsed = TValues>({
  toolId,
  schema,
  defaultValues,
  build,
  historyLabel,
  history: externalHistory,
}: UseGeneratorOptions<TValues, TParsed>) {
  const form = useForm<TValues>({
    resolver: zodResolver(schema as never) as unknown as Resolver<TValues>,
    defaultValues,
    mode: "onTouched",
  });

  const internalHistory = useHistory(toolId);
  const history = externalHistory ?? internalHistory;

  const values = useWatch({ control: form.control }) as TValues;
  const parsed = schema.safeParse(values);

  let output: string | null = null;
  let label = "";
  if (parsed.success) {
    try {
      output = build(parsed.data);
      label = historyLabel(parsed.data);
    } catch {
      output = null;
    }
  }

  /** Persist the current output to history — call on copy/open/share/download. */
  const commit = () => {
    if (output) history.add(label, output);
  };

  return { form, values, output, isValid: output !== null, commit, history };
}
