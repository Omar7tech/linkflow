/**
 * Website Builder — starting points.
 *
 * Two kinds of head start. A *recipe* is a whole business in a box: pick
 * "Bakery", type your name, and you get sections, wording and a palette that
 * already read like a bakery. A *vibe* restyles whatever you picked without
 * touching a word of the copy.
 *
 * The copy here is deliberately specific. Generic filler ("Welcome to our
 * website") teaches nobody what to write; a real sentence with the person's own
 * name in it can be edited in seconds.
 */
import {
  DEFAULT_THEME, makeBlock, newSite, type Block, type BlockType, type Identity,
  type Meta, type Site, type Theme,
} from "./site-builder";

export type VibeId = "clean" | "bold" | "warm" | "elegant" | "tech" | "playful";

export interface Vibe {
  id: VibeId;
  name: string;
  note: string;
  theme: Partial<Theme>;
}

export const VIBES: readonly Vibe[] = [
  { id: "clean", name: "Clean", note: "Plenty of space, nothing shouting", theme: { font: "modern", radius: "round", density: "regular", headings: "regular", shadow: "soft", pattern: "none", scheme: "light" } },
  { id: "bold", name: "Bold", note: "Big type, strong colour", theme: { font: "statement", radius: "soft", density: "regular", headings: "display", shadow: "lifted", pattern: "rays", scheme: "light" } },
  { id: "warm", name: "Warm", note: "Soft serif, friendly and human", theme: { font: "editorial", radius: "soft", density: "airy", headings: "regular", shadow: "soft", pattern: "none", scheme: "light" } },
  { id: "elegant", name: "Elegant", note: "Light, quiet, high-end", theme: { font: "elegant", radius: "square", density: "airy", headings: "display", shadow: "none", pattern: "none", scheme: "light" } },
  { id: "tech", name: "Tech", note: "Dark screen, precise edges", theme: { font: "tech", radius: "soft", density: "regular", headings: "tight", shadow: "lifted", pattern: "glow", scheme: "dark" } },
  { id: "playful", name: "Playful", note: "Rounded shapes, cheerful", theme: { font: "friendly", radius: "pill", density: "regular", headings: "regular", shadow: "soft", pattern: "dots", scheme: "light" } },
];

export interface StarterInput {
  recipe: string;
  name: string;
  tagline: string;
  city: string;
  email: string;
  phone: string;
  vibe: VibeId;
  brand: string;
}

export const EMPTY_STARTER: StarterInput = {
  recipe: "services",
  name: "",
  tagline: "",
  city: "",
  email: "",
  phone: "",
  vibe: "clean",
  brand: "#0f766e",
};

interface Copy extends StarterInput {
  /** The business name, or a safe stand-in while the field is still empty. */
  brandName: string;
  where: string;
}

interface Recipe {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  favicon: string;
  brand: string;
  vibe: VibeId;
  /** Short words for the wizard's "what should it say" preview. */
  sections: string;
  build: (copy: Copy) => Block[];
}

const block = (type: BlockType, variant: string, props: Record<string, unknown>): Block =>
  makeBlock(type, { variant, props: props as Block["props"] });

/** Nav + announcement-free header used by most recipes. */
const nav = (copy: Copy, links: { label: string; href: string }[], cta = "Get in touch", href = "#contact") =>
  block("nav", "left", { logoText: copy.brandName, links, ctaLabel: cta, ctaHref: href, sticky: true });

const footer = (copy: Copy, links: { label: string; href: string }[], tagline: string) =>
  block("footer", "columns", {
    logoText: copy.brandName,
    tagline,
    links,
    email: copy.email,
    phone: copy.phone,
    address: copy.where,
    social: [{ label: "Instagram", href: "" }, { label: "Facebook", href: "" }],
    copyright: `© ${new Date().getFullYear()} ${copy.brandName}. All rights reserved.`,
  });

const contact = (copy: Copy, heading: string, intro: string, hours = "") =>
  block("contact", "split", {
    anchor: "contact", heading, intro,
    email: copy.email || "hello@example.com",
    phone: copy.phone,
    address: copy.where,
    hours,
    formMode: "mailto",
    buttonLabel: "Send message",
    messageLabel: "What do you need?",
    privacyNote: "We answer every message within one working day.",
  });

export const RECIPES: readonly Recipe[] = [
  {
    id: "services", name: "Local service", emoji: "🔧", blurb: "Plumber, electrician, cleaner, handyman: anyone who comes to a customer.",
    favicon: "🔧", brand: "#1d4ed8", vibe: "clean", sections: "Hero · Services · How it works · Reviews · Contact",
    build: (copy) => [
      nav(copy, [{ label: "Services", href: "#services" }, { label: "How it works", href: "#process" }, { label: "Reviews", href: "#reviews" }, { label: "Contact", href: "#contact" }], "Get a quote"),
      block("hero", "split", {
        eyebrow: copy.where ? `Serving ${copy.where}` : "Local, reliable, on time",
        headline: copy.tagline || `Honest ${copy.recipe === "services" ? "repairs" : "work"}, done when we say`,
        subhead: `${copy.brandName} handles the jobs most people put off. Clear prices before we start, tidy work, and nothing left behind.`,
        primaryLabel: "Get a free quote", primaryHref: "#contact",
        secondaryLabel: "See what we do", secondaryHref: "#services",
        note: copy.phone ? `Or call ${copy.phone}. We answer.` : "Same-week appointments most weeks.",
      }),
      block("features", "cards", {
        anchor: "services", heading: "What we do", intro: "If it is on this list, it is a normal day for us.", columns: "3",
        items: [
          { icon: "🚿", title: "Repairs", text: "Leaks, blockages and the small faults that turn into big ones." },
          { icon: "🧰", title: "Installations", text: "New fittings put in properly, tested before we leave." },
          { icon: "🛟", title: "Emergencies", text: "Same-day call-outs when something cannot wait until Monday." },
        ],
      }),
      block("steps", "numbered", {
        anchor: "process", heading: "How it works", intro: "No surprises, no waiting around all day.",
        items: [
          { title: "Tell us the problem", text: "A photo and a sentence is usually enough for a price." },
          { title: "Get a fixed quote", text: "Sent the same day, with a two-hour arrival window." },
          { title: "We fix it", text: "You pay after the work is done and you are happy with it." },
        ],
      }),
      block("testimonials", "cards", {
        anchor: "reviews", heading: "What people say",
        items: [
          { quote: "Arrived when they said, fixed it in an hour and cleaned up afterwards. Rare these days.", name: "Helena R.", role: copy.where || "Regular customer", photo: "", rating: "5" },
          { quote: "Quoted half what the last company wanted and did a better job.", name: "Marc D.", role: "Landlord", photo: "", rating: "5" },
        ],
      }),
      block("cta", "band", {
        headline: "Got something that needs fixing?", text: "Send a photo and a short description, and you will have a price today.",
        buttonLabel: "Get a free quote", buttonHref: "#contact", note: copy.phone ? `Or call ${copy.phone}` : "",
      }),
      contact(copy, "Get a free quote", "Tell us what is wrong and where you are. Photos help.", "Mon–Fri 8:00–18:00\nSaturday 9:00–13:00"),
      footer(copy, [{ label: "Services", href: "#services" }, { label: "Contact", href: "#contact" }], `Trusted local work${copy.where ? ` in ${copy.where}` : ""}.`),
    ],
  },
  {
    id: "restaurant", name: "Restaurant or café", emoji: "🍽️", blurb: "A menu, the room, the hours and a way to book a table.",
    favicon: "🍽️", brand: "#9a3412", vibe: "warm", sections: "Hero · Story · Menu · Gallery · Hours",
    build: (copy) => [
      block("banner", "soft", { text: copy.where ? `Now taking bookings in ${copy.where}` : "Now taking bookings", linkLabel: "Reserve a table", linkHref: "#contact" }),
      nav(copy, [{ label: "Menu", href: "#menu" }, { label: "About", href: "#about" }, { label: "Gallery", href: "#gallery" }, { label: "Find us", href: "#contact" }], "Book a table"),
      block("hero", "image", {
        eyebrow: copy.where ? copy.where : "",
        headline: copy.tagline || "Cooked fresh, eaten slowly",
        subhead: "Small menu, big flavours, everything made in our own kitchen each morning.",
        primaryLabel: "Book a table", primaryHref: "#contact",
        secondaryLabel: "See the menu", secondaryHref: "#menu",
        note: "Open Tuesday to Sunday · Kitchen closes at 22:00",
        image: "", imageAlt: "",
      }),
      block("split", "right", {
        anchor: "about", eyebrow: "About us", heading: "A short story about the kitchen",
        text: `${copy.brandName} started with one recipe and a very small room.\n\nWe still cook the way we did then: short menu, local suppliers, nothing sitting in a freezer.`,
        bullets: [{ text: "Bread baked every morning" }, { text: "Vegetarian and vegan options daily" }, { text: "Suppliers within 40 km" }],
        image: "", imageAlt: "",
      }),
      block("pricing", "menu", {
        anchor: "menu", heading: "The menu", intro: "A taste of what is on this week. The full card changes with the seasons.", note: "Allergies? Tell us and the kitchen will adjust.",
        items: [
          { name: "Sourdough & cultured butter", price: "€4", period: "", description: "Baked this morning, still warm.", features: "", badge: "", ctaLabel: "", ctaHref: "" },
          { name: "Slow-roast tomato soup", price: "€8", period: "", description: "With basil oil and toasted seeds.", features: "", badge: "", ctaLabel: "", ctaHref: "" },
          { name: "Mushroom pappardelle", price: "€16", period: "", description: "Hand-cut pasta, wild mushrooms, aged cheese.", features: "", badge: "", ctaLabel: "", ctaHref: "" },
          { name: "Chocolate and olive oil cake", price: "€7", period: "", description: "The one people come back for.", features: "", badge: "", ctaLabel: "", ctaHref: "" },
        ],
      }),
      block("gallery", "mixed", { anchor: "gallery", heading: "The room", intro: "", columns: "3", items: [{ image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }] }),
      block("testimonials", "single", {
        heading: "",
        items: [{ quote: "The kind of place you plan your week around. Everything tasted like someone cared about it.", name: "Sofia M.", role: "Regular since 2021", photo: "", rating: "5" }],
      }),
      contact(copy, "Find us", "Walk-ins are welcome, but the small tables go quickly.", "Tuesday – Thursday  12:00–22:00\nFriday – Saturday  12:00–23:00\nSunday  12:00–17:00\nMonday closed"),
      footer(copy, [{ label: "Menu", href: "#menu" }, { label: "Book", href: "#contact" }], "Small kitchen, short menu, everything made here."),
    ],
  },
  {
    id: "salon", name: "Salon or studio", emoji: "💇", blurb: "Hair, beauty, nails, tattoo, massage: price list and booking.",
    favicon: "💇", brand: "#be185d", vibe: "elegant", sections: "Hero · Treatments · Prices · Team · Booking",
    build: (copy) => [
      nav(copy, [{ label: "Treatments", href: "#services" }, { label: "Prices", href: "#pricing" }, { label: "Team", href: "#team" }, { label: "Book", href: "#contact" }], "Book now"),
      block("hero", "split", {
        eyebrow: copy.where || "Appointments available",
        headline: copy.tagline || "Time that belongs to you",
        subhead: `${copy.brandName} is a small studio where nobody is rushed. Come in, sit down, leave feeling like yourself again.`,
        primaryLabel: "Book an appointment", primaryHref: "#contact",
        secondaryLabel: "See prices", secondaryHref: "#pricing",
        note: "Evening slots on Thursdays",
      }),
      block("features", "plain", {
        anchor: "services", heading: "What we do", intro: "", columns: "3",
        items: [
          { icon: "✂️", title: "Cut & style", text: "A shape that works on the mornings you have four minutes." },
          { icon: "🎨", title: "Colour", text: "Gentle formulas, honest advice about what will suit you." },
          { icon: "🧴", title: "Treatments", text: "Deep conditioning and scalp care for tired hair." },
        ],
      }),
      block("pricing", "simple", {
        anchor: "pricing", heading: "Price list", intro: "Prices include the consultation. No hidden extras.", note: "Cancellations are free up to 24 hours before.",
        items: [
          { name: "Cut & finish", price: "€45", period: "", description: "Around 60 minutes.", features: "", badge: "", ctaLabel: "Book", ctaHref: "#contact" },
          { name: "Colour & gloss", price: "€90", period: "", description: "Around two hours.", features: "", badge: "Most booked", ctaLabel: "Book", ctaHref: "#contact" },
          { name: "Treatment", price: "€30", period: "", description: "Add to any appointment.", features: "", badge: "", ctaLabel: "Book", ctaHref: "#contact" },
        ],
      }),
      block("team", "cards", { anchor: "team", heading: "The team", intro: "", columns: "3", items: [{ name: "Ana", role: "Founder & senior stylist", photo: "", link: "" }, { name: "Rita", role: "Colour specialist", photo: "", link: "" }] }),
      block("gallery", "grid", { heading: "Recent work", intro: "", columns: "4", items: [{ image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }] }),
      contact(copy, "Book an appointment", "Tell us what you are thinking about and when suits you.", "Tue–Fri 9:00–19:00\nSaturday 9:00–16:00"),
      footer(copy, [{ label: "Prices", href: "#pricing" }, { label: "Book", href: "#contact" }], "A small studio where nobody is rushed."),
    ],
  },
  {
    id: "fitness", name: "Gym or coach", emoji: "🏋️", blurb: "Classes, memberships, trainers and a first free session.",
    favicon: "💪", brand: "#ea580c", vibe: "bold", sections: "Hero · Classes · Plans · Results · Trial",
    build: (copy) => [
      nav(copy, [{ label: "Classes", href: "#classes" }, { label: "Membership", href: "#membership" }, { label: "Results", href: "#reviews" }, { label: "Start", href: "#contact" }], "Free trial"),
      block("hero", "image", {
        eyebrow: "First session free",
        headline: copy.tagline || "Stronger in twelve weeks. Properly.",
        subhead: "Small groups, real coaching and a plan that fits around work. No contracts, no pressure, no mirrors-only nonsense.",
        primaryLabel: "Book a free session", primaryHref: "#contact",
        secondaryLabel: "See the timetable", secondaryHref: "#classes",
        note: copy.where ? `${copy.where} · Open from 6:00` : "Open from 6:00",
      }),
      block("stats", "band", { heading: "", items: [{ value: "12", label: "people max per class" }, { value: "6:00", label: "first class of the day" }, { value: "4.9★", label: "average member rating" }] }),
      block("features", "numbered", {
        anchor: "classes", heading: "What we do", intro: "Four sessions a day, every one coached.", columns: "2",
        items: [
          { icon: "", title: "Strength", text: "Barbell basics taught properly, then progressed every week." },
          { icon: "", title: "Conditioning", text: "Forty minutes that leave you tired, not broken." },
          { icon: "", title: "Mobility", text: "The boring work that keeps you training at fifty." },
          { icon: "", title: "One to one", text: "A plan written around your body and your calendar." },
        ],
      }),
      block("pricing", "cards", {
        anchor: "membership", heading: "Membership", intro: "Cancel any month. No joining fee, ever.", note: "Students and over-60s: 20% off.",
        items: [
          { name: "Two a week", price: "€39", period: "month", description: "Enough to change how you feel.", features: "Any two classes a week\nApp with your plan\nMonthly check-in", badge: "", ctaLabel: "Start", ctaHref: "#contact" },
          { name: "Unlimited", price: "€59", period: "month", description: "Train as often as you like.", features: "Every class\nProgramme written for you\nMonthly body check\nBring a friend once a month", badge: "Most popular", ctaLabel: "Start", ctaHref: "#contact" },
          { name: "One to one", price: "€45", period: "session", description: "Just you and a coach.", features: "60 minutes\nFull assessment\nPlan you keep", badge: "", ctaLabel: "Enquire", ctaHref: "#contact" },
        ],
      }),
      block("testimonials", "cards", {
        anchor: "reviews", heading: "Results people talk about",
        items: [
          { quote: "I came in unable to do a single press-up. Ten weeks later I did eight in a row and my back stopped hurting.", name: "Diogo P.", role: "Member since March", photo: "", rating: "5" },
          { quote: "The coaching is the difference. Someone actually watches what you are doing.", name: "Inês F.", role: "Member", photo: "", rating: "5" },
        ],
      }),
      block("faq", "list", {
        anchor: "faq", heading: "Before you come", intro: "",
        items: [
          { question: "I have never trained before. Is that a problem?", answer: "No. About half the people in a beginner class have never touched a barbell. You will be taught, not thrown in." },
          { question: "What should I bring?", answer: "Trainers, water and something you can move in. Showers and towels are here." },
          { question: "Can I cancel?", answer: "Any time, with a month's notice. No contract, no cancellation fee." },
        ],
      }),
      contact(copy, "Book your free session", "Tell us your goal and when you can train.", "Mon–Fri 6:00–21:00\nSaturday 8:00–14:00"),
      footer(copy, [{ label: "Timetable", href: "#classes" }, { label: "Membership", href: "#membership" }], "Small groups. Real coaching."),
    ],
  },
  {
    id: "agency", name: "Agency or studio", emoji: "🎨", blurb: "Selected work, services, process and a project enquiry.",
    favicon: "🎯", brand: "#0f172a", vibe: "clean", sections: "Hero · Work · Services · Process · Enquiry",
    build: (copy) => [
      nav(copy, [{ label: "Work", href: "#work" }, { label: "Services", href: "#services" }, { label: "Process", href: "#process" }, { label: "Contact", href: "#contact" }], "Start a project"),
      block("hero", "minimal", {
        eyebrow: copy.where ? `${copy.where} · Working everywhere` : "Independent studio",
        headline: copy.tagline || "Design that earns its place",
        subhead: `${copy.brandName} is a small studio for brands, websites and the things in between. Senior people only, so the person you meet is the person who does the work.`,
        primaryLabel: "Start a project", primaryHref: "#contact",
        secondaryLabel: "See selected work", secondaryHref: "#work",
        note: "Currently booking from next month",
      }),
      block("logos", "row", { heading: "Recent clients", items: [{ label: "Northwind", image: "" }, { label: "Studio Mera", image: "" }, { label: "Bluehouse", image: "" }, { label: "Marren & Co", image: "" }] }),
      block("gallery", "mixed", { anchor: "work", heading: "Selected work", intro: "A few projects we can show in public.", columns: "3", items: [{ image: "", alt: "", caption: "Brand identity for Northwind" }, { image: "", alt: "", caption: "Website for Studio Mera" }, { image: "", alt: "", caption: "Packaging for Bluehouse" }] }),
      block("features", "plain", {
        anchor: "services", heading: "What we do", intro: "", columns: "3",
        items: [
          { icon: "◆", title: "Brand", text: "Naming, identity and the rules that keep it consistent." },
          { icon: "◼", title: "Digital", text: "Websites and products, designed and built end to end." },
          { icon: "◇", title: "Content", text: "Photography, copy and the assets a launch actually needs." },
        ],
      }),
      block("steps", "timeline", {
        anchor: "process", heading: "How we work", intro: "Four weeks from first call to first draft, usually.",
        items: [
          { title: "Conversation", text: "An hour on what you sell, to whom, and what is in the way." },
          { title: "Proposal", text: "Fixed scope, fixed price, dates you can plan around." },
          { title: "Design", text: "Two directions, one chosen, refined together in the open." },
          { title: "Handover", text: "Files, guidelines and a walkthrough so your team can run it." },
        ],
      }),
      block("testimonials", "single", { heading: "", items: [{ quote: "They asked better questions than anyone we spoke to, and the work has been quietly making us money ever since.", name: "Clara Bessa", role: "Founder, Northwind", photo: "", rating: "" }] }),
      block("cta", "split", { headline: "Have something in mind?", text: "Tell us what you are working on. We will say honestly whether we are the right studio for it.", buttonLabel: "Start a project", buttonHref: "#contact", secondaryLabel: "", secondaryHref: "", note: "" }),
      contact(copy, "Start a project", "Budget, deadline, and what you are trying to change.", ""),
      footer(copy, [{ label: "Work", href: "#work" }, { label: "Contact", href: "#contact" }], "A small studio with senior people only."),
    ],
  },
  {
    id: "saas", name: "App or product", emoji: "💻", blurb: "Features, pricing tiers, FAQ and a sign-up call to action.",
    favicon: "⚡", brand: "#6366f1", vibe: "tech", sections: "Hero · Features · How it works · Pricing · FAQ",
    build: (copy) => [
      nav(copy, [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }], "Start free"),
      block("hero", "center", {
        eyebrow: "Now in public beta",
        headline: copy.tagline || "The boring part, handled",
        subhead: `${copy.brandName} takes the work nobody wants to do and does it in the background, so your team can get back to the part that matters.`,
        primaryLabel: "Start free", primaryHref: "#pricing",
        secondaryLabel: "See how it works", secondaryHref: "#how-it-works",
        note: "Free for 14 days · No card required",
        image: "", imageAlt: "",
      }),
      block("logos", "row", { heading: "Used by teams at", items: [{ label: "Northwind", image: "" }, { label: "Bluehouse", image: "" }, { label: "Marren", image: "" }, { label: "Studio Mera", image: "" }] }),
      block("features", "cards", {
        anchor: "features", heading: "What you get", intro: "Everything in one place, nothing you have to configure for a week.", columns: "3",
        items: [
          { icon: "⚡", title: "Set up in minutes", text: "Connect your tools and it starts working. No migration project." },
          { icon: "🔒", title: "Safe by default", text: "Encrypted, backed up, and exportable whenever you want out." },
          { icon: "📊", title: "Answers, not dashboards", text: "The numbers you actually act on, in plain language." },
          { icon: "🤝", title: "Real support", text: "A person replies, usually within the hour." },
          { icon: "🔌", title: "Works with your stack", text: "Slack, Notion, Google and a proper API." },
          { icon: "♻️", title: "Fair pricing", text: "One flat price. No per-seat surprises at renewal." },
        ],
      }),
      block("steps", "cards", {
        anchor: "how-it-works", heading: "How it works", intro: "",
        items: [
          { title: "Connect", text: "One click for the tools you already use." },
          { title: "Configure once", text: "Pick the rules that match how your team works." },
          { title: "Forget about it", text: "It runs quietly and tells you only when something needs you." },
        ],
      }),
      block("pricing", "cards", {
        anchor: "pricing", heading: "Pricing", intro: "Start free. Upgrade when it is obviously worth it.", note: "Prices exclude VAT.",
        items: [
          { name: "Free", price: "€0", period: "forever", description: "For one person getting started.", features: "1 workspace\n100 actions a month\nCommunity support", badge: "", ctaLabel: "Start free", ctaHref: "#contact" },
          { name: "Team", price: "€29", period: "month", description: "For a working team.", features: "Unlimited workspaces\n10,000 actions a month\nPriority support\nAPI access", badge: "Most popular", ctaLabel: "Start 14-day trial", ctaHref: "#contact" },
          { name: "Company", price: "Talk to us", period: "", description: "Security review, SSO, invoicing.", features: "SSO and SCIM\nAudit log\nCustom terms\nShared Slack channel", badge: "", ctaLabel: "Book a call", ctaHref: "#contact" },
        ],
      }),
      block("faq", "columns", {
        anchor: "faq", heading: "Common questions", intro: "",
        items: [
          { question: "Do I need a credit card to try it?", answer: "No. The trial is fourteen days and asks for nothing up front." },
          { question: "Can I export my data?", answer: "Any time, in CSV and JSON. It is your data and it stays that way." },
          { question: "What happens when the trial ends?", answer: "The account drops to the free plan. Nothing is deleted." },
          { question: "Is there an API?", answer: "Yes, REST and webhooks, documented and versioned." },
        ],
      }),
      block("cta", "band", { headline: "Try it on this week's work", text: "Fourteen days, no card, and an export button if it is not for you.", buttonLabel: "Start free", buttonHref: "#contact", secondaryLabel: "", secondaryHref: "", note: "" }),
      contact(copy, "Talk to a human", "Questions about pricing, security or moving your data across?", ""),
      footer(copy, [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }], "Software that does the boring part."),
    ],
  },
  {
    id: "portfolio", name: "Portfolio", emoji: "📸", blurb: "Photographer, designer, writer: work first, words second.",
    favicon: "📸", brand: "#111827", vibe: "elegant", sections: "Hero · Gallery · About · Services · Contact",
    build: (copy) => [
      nav(copy, [{ label: "Work", href: "#work" }, { label: "About", href: "#about" }, { label: "Services", href: "#services" }, { label: "Contact", href: "#contact" }], "Enquire"),
      block("hero", "minimal", {
        eyebrow: copy.where || "",
        headline: copy.tagline || copy.brandName,
        subhead: "Photography for people who would rather not be photographed. Quiet, unposed, and finished properly.",
        primaryLabel: "See the work", primaryHref: "#work",
        secondaryLabel: "Enquire about a date", secondaryHref: "#contact",
        note: "Taking bookings for next season",
      }),
      block("gallery", "mixed", { anchor: "work", heading: "Selected work", intro: "", columns: "3", items: Array.from({ length: 6 }, () => ({ image: "", alt: "", caption: "" })) }),
      block("split", "left", {
        anchor: "about", eyebrow: "About me", heading: "Hello, I'm behind the camera",
        text: `I have been photographing ${copy.where ? `in and around ${copy.where}` : "weddings, families and small businesses"} for over a decade.\n\nMy approach is simple: stay out of the way, wait for the real moment, and hand back pictures you will still like in twenty years.`,
        bullets: [{ text: "Shot on film and digital" }, { text: "Editing included, no presets" }, { text: "Gallery delivered in three weeks" }],
        image: "", imageAlt: "",
      }),
      block("pricing", "cards", {
        anchor: "services", heading: "What I do", intro: "", note: "Travel outside the region is quoted separately.",
        items: [
          { name: "Portrait session", price: "€250", period: "", description: "Ninety minutes, one location.", features: "25 edited photographs\nOnline gallery\nPrint licence", badge: "", ctaLabel: "Enquire", ctaHref: "#contact" },
          { name: "Wedding day", price: "From €1,800", period: "", description: "From morning preparation to first dance.", features: "Ten hours of coverage\n600+ edited photographs\nSecond photographer\nAlbum design", badge: "Most booked", ctaLabel: "Check a date", ctaHref: "#contact" },
          { name: "For business", price: "€600", period: "day", description: "Team, product and place.", features: "Half or full day\nCommercial licence\nRetouching included", badge: "", ctaLabel: "Enquire", ctaHref: "#contact" },
        ],
      }),
      block("testimonials", "single", { heading: "", items: [{ quote: "We forgot there was a photographer there, and then the pictures arrived and we cried.", name: "Rita & João", role: "Married in June", photo: "", rating: "" }] }),
      contact(copy, "Check a date", "Tell me the date, the place and what you are imagining.", ""),
      footer(copy, [{ label: "Work", href: "#work" }, { label: "Contact", href: "#contact" }], "Photography, quietly done."),
    ],
  },
  {
    id: "consultant", name: "Consultant or coach", emoji: "🧭", blurb: "Credibility, a clear offer and a booked call.",
    favicon: "🧭", brand: "#0f766e", vibe: "clean", sections: "Hero · Problem · Offer · Proof · Call",
    build: (copy) => [
      nav(copy, [{ label: "How I help", href: "#help" }, { label: "Working together", href: "#process" }, { label: "Results", href: "#reviews" }, { label: "Book a call", href: "#contact" }], "Book a call"),
      block("hero", "split", {
        eyebrow: "For founders and small teams",
        headline: copy.tagline || "Clear thinking, borrowed by the hour",
        subhead: `I'm ${copy.brandName}. I help small companies work out what to do next, and then make sure it actually gets done.`,
        primaryLabel: "Book a free call", primaryHref: "#contact",
        secondaryLabel: "How I work", secondaryHref: "#process",
        note: "Thirty minutes, no pitch",
      }),
      block("features", "checklist", {
        anchor: "help", heading: "This sounds familiar?", intro: "Most people arrive with one of these.", columns: "2",
        items: [
          { icon: "", title: "Everything is urgent", text: "The team is busy but nothing important moves." },
          { icon: "", title: "Growth stalled", text: "What worked at ten customers stopped working at a hundred." },
          { icon: "", title: "Too many opinions", text: "Every decision goes round the table twice and comes back." },
          { icon: "", title: "No time to think", text: "You know what the problem is. You have no space to solve it." },
        ],
      }),
      block("steps", "timeline", {
        anchor: "process", heading: "Working together", intro: "",
        items: [
          { title: "A free call", text: "Thirty minutes. You explain, I ask questions. No slides." },
          { title: "A short diagnosis", text: "A week of interviews and numbers, then one honest document." },
          { title: "The work", text: "We fix the three things that matter, with your team, in the open." },
          { title: "Handover", text: "You keep the method. I am not trying to live here." },
        ],
      }),
      block("stats", "cards", { heading: "", items: [{ value: "60+", label: "companies advised" }, { value: "14", label: "years doing this" }, { value: "92%", label: "come back or refer" }] }),
      block("testimonials", "cards", {
        anchor: "reviews", heading: "What people say",
        items: [
          { quote: "In one afternoon we cut the roadmap in half and shipped more in the next quarter than in the whole year before.", name: "Pedro Alves", role: "CEO, Bluehouse", photo: "", rating: "5" },
          { quote: "Direct, kind and completely unbothered by politics. Exactly what we needed.", name: "Sara N.", role: "COO, Marren & Co", photo: "", rating: "5" },
        ],
      }),
      block("cta", "card", { headline: "Start with a free call", text: "Thirty minutes on your actual problem. If I am not the right person, I will tell you who is.", buttonLabel: "Book a call", buttonHref: "#contact", secondaryLabel: "", secondaryHref: "", note: "No pitch, no follow-up sequence." }),
      contact(copy, "Book a call", "A sentence about the company and what is stuck is enough.", ""),
      footer(copy, [{ label: "How I help", href: "#help" }, { label: "Book a call", href: "#contact" }], "Clear thinking, borrowed by the hour."),
    ],
  },
  {
    id: "shop", name: "Small shop", emoji: "🛍️", blurb: "Products, the story behind them, and where to buy.",
    favicon: "🛍️", brand: "#166534", vibe: "warm", sections: "Hero · Products · Story · Stockists · Contact",
    build: (copy) => [
      block("banner", "brand", { text: "Free delivery on orders over €40", linkLabel: "Shop now", linkHref: "#products" }),
      nav(copy, [{ label: "Products", href: "#products" }, { label: "Our story", href: "#story" }, { label: "Stockists", href: "#stockists" }, { label: "Contact", href: "#contact" }], "Shop"),
      block("hero", "split", {
        eyebrow: "Made in small batches",
        headline: copy.tagline || "Things made to last longer than a season",
        subhead: `${copy.brandName} makes a short list of products properly, by hand${copy.where ? `, in ${copy.where}` : ""}. Nothing we would not keep ourselves.`,
        primaryLabel: "See the range", primaryHref: "#products",
        secondaryLabel: "Our story", secondaryHref: "#story",
        note: "Ships within two working days",
      }),
      block("gallery", "grid", { anchor: "products", heading: "What we sell", intro: "Photograph each product and add the price in the caption.", columns: "3", items: Array.from({ length: 6 }, () => ({ image: "", alt: "", caption: "Product name, €00" })) }),
      block("split", "right", {
        anchor: "story", eyebrow: "Our story", heading: "Why we make things this way",
        text: "We started because we could not find what we wanted to buy.\n\nEverything is made in small runs, so we can change what is not right instead of shipping a container of it.",
        bullets: [{ text: "Natural materials only" }, { text: "Repairs, not replacements" }, { text: "Plastic-free packaging" }],
        image: "", imageAlt: "",
      }),
      block("features", "plain", {
        anchor: "stockists", heading: "Where to find us", intro: "", columns: "3",
        items: [
          { icon: "🏪", title: "Our shop", text: copy.where ? `Open Thursday to Sunday in ${copy.where}.` : "Open Thursday to Sunday." },
          { icon: "🚚", title: "Delivery", text: "Two working days nationwide, tracked." },
          { icon: "🤝", title: "Stockists", text: "Twelve independent shops carry the range." },
        ],
      }),
      block("newsletter", "band", { heading: "New things, twice a year", text: "We only write when there is something worth saying.", action: "", buttonLabel: "Subscribe", note: "Unsubscribe in one click." }),
      contact(copy, "Contact", "Questions about an order, a repair or stocking us?", "Thursday – Sunday  11:00–19:00"),
      footer(copy, [{ label: "Products", href: "#products" }, { label: "Contact", href: "#contact" }], "Made in small batches, meant to be kept."),
    ],
  },
  {
    id: "event", name: "Event", emoji: "🎟️", blurb: "Date, place, programme, speakers and tickets.",
    favicon: "🎟️", brand: "#7c3aed", vibe: "bold", sections: "Hero · Programme · Speakers · Tickets · Venue",
    build: (copy) => [
      nav(copy, [{ label: "Programme", href: "#programme" }, { label: "Speakers", href: "#speakers" }, { label: "Tickets", href: "#tickets" }, { label: "Venue", href: "#venue" }], "Get tickets", "#tickets"),
      block("hero", "center", {
        eyebrow: copy.where ? `${copy.where} · One day only` : "One day only",
        headline: copy.tagline || `${copy.brandName} 2026`,
        subhead: "A single day, one room, twelve talks worth travelling for. No parallel tracks, no sales pitches from the stage.",
        primaryLabel: "Get tickets", primaryHref: "#tickets",
        secondaryLabel: "See the programme", secondaryHref: "#programme",
        note: "Early tickets until the end of the month",
        image: "", imageAlt: "",
      }),
      block("stats", "plain", { heading: "", items: [{ value: "12", label: "talks" }, { value: "300", label: "seats" }, { value: "1", label: "unforgettable day" }] }),
      block("steps", "timeline", {
        anchor: "programme", heading: "The programme", intro: "Doors open at 8:30.",
        items: [
          { title: "09:00 Opening", text: "Why we are all here, in ten minutes." },
          { title: "09:30 Morning talks", text: "Four sessions, thirty minutes each, no slides over ten." },
          { title: "13:00 Long lunch", text: "Proper food and the conversations you actually came for." },
          { title: "14:30 Afternoon", text: "Workshops, then the closing talk at 17:30." },
        ],
      }),
      block("team", "cards", { anchor: "speakers", heading: "The speakers", intro: "More announced each month.", columns: "4", items: Array.from({ length: 4 }, (_, i) => ({ name: `Speaker ${i + 1}`, role: "Role, Company", photo: "", link: "" })) }),
      block("pricing", "cards", {
        anchor: "tickets", heading: "Tickets", intro: "", note: "Students: write to us, we keep seats back.",
        items: [
          { name: "Early", price: "€90", period: "", description: "Until the end of the month.", features: "Full day\nLunch and coffee\nRecordings afterwards", badge: "Best value", ctaLabel: "Buy", ctaHref: "#contact" },
          { name: "Standard", price: "€140", period: "", description: "From next month.", features: "Full day\nLunch and coffee\nRecordings afterwards", badge: "", ctaLabel: "Buy", ctaHref: "#contact" },
          { name: "Team of four", price: "€440", period: "", description: "Bring the people who will act on it.", features: "Four tickets\nReserved seating\nRecordings afterwards", badge: "", ctaLabel: "Buy", ctaHref: "#contact" },
        ],
      }),
      block("embed", "map", { anchor: "venue", heading: "Getting there", url: "", html: "", caption: "Ten minutes from the central station.", ratio: "16x9" }),
      contact(copy, "Questions", "Accessibility, invoices, sponsorship: ask away.", ""),
      footer(copy, [{ label: "Programme", href: "#programme" }, { label: "Tickets", href: "#tickets" }], "One day, one room, twelve talks."),
    ],
  },
  {
    id: "nonprofit", name: "Charity or club", emoji: "🌱", blurb: "Mission, impact, how to help and how to join.",
    favicon: "🌱", brand: "#15803d", vibe: "warm", sections: "Hero · Mission · Impact · Help · Join",
    build: (copy) => [
      nav(copy, [{ label: "What we do", href: "#what-we-do" }, { label: "Impact", href: "#impact" }, { label: "Help out", href: "#help" }, { label: "Contact", href: "#contact" }], "Donate", "#help"),
      block("hero", "image", {
        eyebrow: copy.where || "",
        headline: copy.tagline || "Small group. Stubborn about one thing.",
        subhead: `${copy.brandName} is volunteers doing practical work where it is needed. Every euro is accounted for in public.`,
        primaryLabel: "Help out", primaryHref: "#help",
        secondaryLabel: "What we do", secondaryHref: "#what-we-do",
        note: "Registered non-profit",
      }),
      block("features", "cards", {
        anchor: "what-we-do", heading: "What we do", intro: "", columns: "3",
        items: [
          { icon: "🌳", title: "On the ground", text: "Weekly sessions, anyone welcome, tools provided." },
          { icon: "📚", title: "Education", text: "Free workshops in schools and community centres." },
          { icon: "🗳️", title: "Advocacy", text: "Turning up to the meetings where decisions get made." },
        ],
      }),
      block("stats", "band", { anchor: "impact", heading: "The difference it makes", items: [{ value: "8,400", label: "trees planted" }, { value: "260", label: "volunteers" }, { value: "100%", label: "of donations spent locally" }] }),
      block("split", "right", {
        anchor: "help", eyebrow: "How you can help", heading: "Three ways in",
        text: "Give an hour a month, give money, or give a skill.\n\nAll three are worth the same to us, and all three are easy to start.",
        bullets: [{ text: "Volunteer on Saturday mornings" }, { text: "Donate monthly or once" }, { text: "Partner with us as a company or school" }],
        ctaLabel: "Get involved", ctaHref: "#contact", image: "", imageAlt: "",
      }),
      block("faq", "list", {
        heading: "Questions people ask", intro: "",
        items: [
          { question: "Where does the money go?", answer: "Published every quarter, down to the receipt. Nobody here takes a salary." },
          { question: "Can I come once and see?", answer: "Yes. Turn up on a Saturday, no commitment, no forms." },
          { question: "Do you take company volunteers?", answer: "Gladly. We run team days most months." },
        ],
      }),
      block("newsletter", "inline", { heading: "Monthly note", text: "What we did, what we spent, what is next.", action: "", buttonLabel: "Subscribe", note: "" }),
      contact(copy, "Get involved", "Tell us what you would like to do, or just ask.", "Saturdays 9:00–13:00"),
      footer(copy, [{ label: "What we do", href: "#what-we-do" }, { label: "Help out", href: "#help" }], "Volunteers doing practical work."),
    ],
  },
  {
    id: "onepage", name: "Personal page", emoji: "🙋", blurb: "A tiny page about you and where to find you. Perfect first site.",
    favicon: "👋", brand: "#2563eb", vibe: "playful", sections: "Hero · About · Links · Contact",
    build: (copy) => [
      block("hero", "center", {
        eyebrow: "",
        headline: copy.brandName === "Your business" ? "Hello, I'm…" : `Hello, I'm ${copy.brandName}`,
        subhead: copy.tagline || "One page about what I do, what I'm working on, and how to reach me.",
        primaryLabel: "Say hello", primaryHref: "#contact",
        secondaryLabel: "", secondaryHref: "",
        note: copy.where ? `Based in ${copy.where}` : "",
        image: "", imageAlt: "",
      }),
      block("text", "narrow", {
        heading: "About",
        body: "Two or three sentences about what you do and who you do it for.\n\nA second paragraph for the part people always ask about: where you trained, what you are known for, or what you are building right now.",
      }),
      block("features", "plain", {
        heading: "What I'm working on", intro: "", columns: "3",
        items: [
          { icon: "✍️", title: "Writing", text: "A newsletter about the craft, twice a month." },
          { icon: "🛠️", title: "Building", text: "A small tool that solves one annoying problem." },
          { icon: "🎤", title: "Speaking", text: "Available for talks and workshops." },
        ],
      }),
      block("cta", "card", { headline: "Find me elsewhere", text: "Links to the places where I post more often.", buttonLabel: "Email me", buttonHref: copy.email ? `mailto:${copy.email}` : "#contact", secondaryLabel: "", secondaryHref: "", note: "" }),
      contact(copy, "Say hello", "Work, questions or just to say hi.", ""),
      footer(copy, [], ""),
    ],
  },
];

export const recipeById = (id: string): Recipe => RECIPES.find((recipe) => recipe.id === id) ?? RECIPES[0];

/** Applies a vibe on top of a recipe's own colour. */
export function themeFor(recipeId: string, vibe: VibeId, brand?: string): Theme {
  const recipe = recipeById(recipeId);
  const vibeTheme = VIBES.find((v) => v.id === vibe)?.theme ?? {};
  return {
    ...DEFAULT_THEME,
    brand: brand || recipe.brand,
    accent: DEFAULT_THEME.accent,
    ...vibeTheme,
  };
}

/** Turns the four wizard answers into a finished site. */
export function buildStarter(input: StarterInput): Site {
  const recipe = recipeById(input.recipe);
  const brandName = input.name.trim() || "Your business";
  const copy: Copy = {
    ...input,
    name: brandName,
    brandName,
    where: [input.city.trim()].filter(Boolean).join(""),
  };
  const blocks = recipe.build(copy).slice(0, 24);
  const theme = themeFor(input.recipe, input.vibe, input.brand);
  const identity: Identity = {
    name: brandName,
    tagline: input.tagline.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    address: input.city.trim(),
    city: input.city.trim(),
    kind: recipe.name,
  };
  const meta: Meta = {
    title: [brandName, input.city.trim() ? `${recipe.name} in ${input.city.trim()}` : recipe.name].filter(Boolean).join(": ").slice(0, 60),
    description: (input.tagline.trim() || `${brandName}. ${recipe.blurb}`).slice(0, 155),
    favicon: recipe.favicon,
    lang: "en",
    url: "",
    ogImage: "",
    indexable: true,
  };
  const site = newSite(brandName, blocks, theme);
  return { ...site, meta, identity };
}

/** A blank page with just enough structure to not feel empty. */
export function blankSite(): Site {
  return newSite("Untitled site");
}
