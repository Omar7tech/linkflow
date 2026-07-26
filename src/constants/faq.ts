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
    question: "Do I need an account to use Forma?",
    answer:
      "No. There's no sign-up, login or email required — open any tool and start creating. Your presets and recent history are saved locally in your browser, not to an account.",
  },
  {
    question: "Where does my data go?",
    answer:
      "Your input is used for one thing only: generating your result. Nothing you type is ever logged, analyzed or sold, and there are no ad or tracking pixels. Recent history and presets stay in this browser.",
  },
  {
    question: "Are my uploaded images and files stored?",
    answer:
      "Most tools process your image right in the browser. A few — like AI background removal or extracting a site's design — do the heavy lifting on our servers, but your file is used only to produce your result and is never kept afterwards.",
  },
  {
    question: "Do the QR codes expire?",
    answer:
      "Never. Forma generates static QR codes that encode your data directly — there's no redirect service in the middle, so they keep working forever and scan faster.",
  },
  {
    question: "Which QR error-correction level should I use?",
    answer:
      "Error correction adds redundancy so a code still scans when partially covered or damaged. Low (7%) makes the simplest, least dense code; High (30%) survives logos and wear. If you drop a logo in the middle, use High.",
  },
  {
    question: "What file formats can I export?",
    answer:
      "It depends on the tool: QR codes, barcodes and graphics export as crisp SVG or high-res PNG; design systems as CSS variables, Tailwind, SCSS or JSON; invoices and mockups as PDF or PNG; and data tools as CSV. Look for the export menu inside each tool.",
  },
  {
    question: "How does the background remover work?",
    answer:
      "It uses an AI segmentation model for photos and detailed art, plus instant color-matching for flat graphics and logos. You get feathered edges and auto-trim, then download a clean transparent PNG.",
  },
  {
    question: "Why isn't my WhatsApp link opening a chat?",
    answer:
      "The number must be a full international number in the wa.me format, without spaces, dashes or a leading plus — the generator handles that formatting for you. Also make sure the number actually has a WhatsApp account.",
  },
  {
    question: "How do UTM parameters help me?",
    answer:
      "UTM parameters tag incoming traffic so analytics tools can attribute visits to a specific source, medium and campaign. Consistent tagging (lowercase, underscores, no spaces) keeps your reports clean — the UTM builder enforces good habits.",
  },
  {
    question: "Can I use everything I create commercially?",
    answer:
      "Absolutely. Everything you make with Forma — links, QR codes, images, palettes, code snippets — is yours to use in ads, packaging, apps, client work or anywhere else, with no attribution required.",
  },
  {
    question: "Does Forma work on mobile and in every browser?",
    answer:
      "Yes. Every tool is responsive-first and runs in any modern browser — Chrome, Safari, Firefox or Edge — on phone, tablet or desktop. Generators, editors and downloads all behave the same everywhere.",
  },
];
