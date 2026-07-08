export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Is Forma really free?",
    answer:
      "Yes — every tool is free with no usage limits, no accounts and no watermarks. Forma is lean to operate, so there are no costs to pass on to you.",
  },
  {
    question: "Where does my data go?",
    answer:
      "Your input is used for one thing only: generating your links, QR codes, vCards and bulk lists. Nothing you type is ever logged, analyzed or sold. Your recent history and presets are saved only on this device.",
  },
  {
    question: "Do the QR codes expire?",
    answer:
      "Never. Forma generates static QR codes that encode your data directly — there's no redirect service in the middle, so they keep working forever and scan faster.",
  },
  {
    question: "Can I use the generated links and QR codes commercially?",
    answer:
      "Absolutely. Everything you create with Forma is yours — use it in ads, packaging, menus, business cards or anywhere else, no attribution required.",
  },
  {
    question: "Why isn't my WhatsApp link opening a chat?",
    answer:
      "The number must be a full international number without spaces, dashes or a leading plus in the wa.me format — our generator handles that automatically. Also make sure the number actually has a WhatsApp account.",
  },
  {
    question: "What's the difference between error correction levels on QR codes?",
    answer:
      "Error correction adds redundancy so a code still scans when partially covered or damaged. Low (7%) gives the simplest code; High (30%) survives logos and wear, at the cost of denser modules. If you add a logo overlay, use High.",
  },
  {
    question: "Does Forma work on mobile?",
    answer:
      "Yes — every tool is built responsive-first and works on any modern phone or tablet browser. Generators, editors and downloads all behave the same as on desktop.",
  },
  {
    question: "How do UTM parameters help me?",
    answer:
      "UTM parameters tag incoming traffic so analytics tools can attribute visits to a specific source, medium and campaign. Consistent tagging (lowercase, underscores, no spaces) keeps your reports clean — the UTM builder enforces good habits.",
  },
];
