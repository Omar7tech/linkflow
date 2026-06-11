export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Is LinkFlow really free?",
    answer:
      "Yes — every tool is free with no usage limits, no accounts and no watermarks. LinkFlow is lean to operate, so there are no costs to pass on to you.",
  },
  {
    question: "Where does my data go?",
    answer:
      "Your input is used for one thing only: generating your links, QR codes, vCards and bulk lists. Nothing you type is ever logged, analyzed or sold. Your recent history and presets are saved only on this device.",
  },
  {
    question: "Do the QR codes expire?",
    answer:
      "Never. LinkFlow generates static QR codes that encode your data directly — there's no redirect service in the middle, so they keep working forever and scan faster.",
  },
  {
    question: "Can I use the generated links and QR codes commercially?",
    answer:
      "Absolutely. Everything you create with LinkFlow is yours — use it in ads, packaging, menus, business cards or anywhere else, no attribution required.",
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
    question: "Does LinkFlow work offline?",
    answer:
      "Mostly, yes. LinkFlow is an installable PWA — after your first visit, the app shell is cached and most generators keep working without a connection. Add it to your home screen for an app-like experience.",
  },
  {
    question: "How do UTM parameters help me?",
    answer:
      "UTM parameters tag incoming traffic so analytics tools can attribute visits to a specific source, medium and campaign. Consistent tagging (lowercase, underscores, no spaces) keeps your reports clean — the UTM builder enforces good habits.",
  },
];
