/**
 * Starting points. Each template is the shape of README that kind of project
 * usually needs, filled with content worth editing rather than lorem ipsum.
 */
import { BLOCK_INFO, uid, type Badge, type Block, type BlockType, type Project } from "./types";

export type TemplateId = "library" | "app" | "cli" | "profile" | "minimal";

export const TEMPLATES: { id: TemplateId; label: string; note: string }[] = [
  { id: "library", label: "Library", note: "npm package, API, examples" },
  { id: "app", label: "Web app", note: "Screenshots, stack, deploy" },
  { id: "cli", label: "CLI tool", note: "Terminal banner, commands" },
  { id: "profile", label: "Profile", note: "Your GitHub profile page" },
  { id: "minimal", label: "Minimal", note: "Just the essentials" },
];

const badge = (kind: Badge["kind"], extra: Partial<Badge> = {}): Badge => ({ id: uid(), kind, ...extra });

/** A fresh block of any type, with sensible starter content. */
export function newBlock(type: BlockType, p: Pick<Project, "name" | "owner" | "repo" | "description">): Block {
  const id = uid();
  const title = BLOCK_INFO[type].heading;
  const pkg = p.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  switch (type) {
    case "banner":
      return { id, type, style: "aurora", tagline: p.description, font: "inter" };
    case "badges":
      return { id, type, style: "flat-square", items: [badge("npm-version"), badge("license"), badge("stars"), badge("prs")] };
    case "intro":
      return { id, type, text: p.description, links: [{ label: "Live demo", url: "" }, { label: "Docs", url: "" }] };
    case "toc":
      return { id, type, title };
    case "features":
      return {
        id,
        type,
        title,
        columns: 3,
        items: [
          { icon: "⚡", title: "Fast", text: "Starts instantly and stays out of your way." },
          { icon: "🧩", title: "Composable", text: "Small pieces that fit together the way you need." },
          { icon: "🔒", title: "Type-safe", text: "Written in TypeScript, with every option typed." },
          { icon: "🌗", title: "Themeable", text: "Light, dark and everything between." },
          { icon: "📦", title: "Tiny", text: "No dependencies, tree-shakeable, under 5 kB." },
          { icon: "♿", title: "Accessible", text: "Keyboard and screen reader friendly by default." },
        ],
      };
    case "screenshots":
      return { id, type, title, columns: 2, images: [{ src: "", alt: "Screenshot" }] };
    case "install":
      return { id, type, title, pkg, managers: ["npm", "pnpm", "yarn", "bun"], extra: "", dev: false };
    case "usage":
      return {
        id,
        type,
        title,
        lang: "ts",
        note: "",
        code: `import { create } from "${pkg}";\n\nconst app = create({\n  theme: "dark",\n});\n\napp.start();`,
      };
    case "api":
      return {
        id,
        type,
        title,
        rows: [
          { name: "theme", type: `"light" | "dark"`, def: `"light"`, desc: "Colour scheme to start with." },
          { name: "onReady", type: "() => void", def: "—", desc: "Called once everything is set up." },
        ],
      };
    case "stack":
      return { id, type, title, icons: ["ts", "react", "nextjs", "tailwind", "vite"], perline: 12 };
    case "alert":
      return { id, type, kind: "TIP", text: "Star the repo to follow along with new releases." };
    case "roadmap":
      return {
        id,
        type,
        title,
        items: [
          { text: "First public release", done: true },
          { text: "Plugin system", done: false },
          { text: "Docs site", done: false },
        ],
      };
    case "faq":
      return {
        id,
        type,
        title,
        items: [
          { q: "Is it free?", a: "Yes. It's open source under the MIT license." },
          { q: "Does it work with Next.js?", a: "Yes, with both the app and pages routers." },
        ],
      };
    case "contributing":
      return {
        id,
        type,
        title,
        text: "Contributions are what make open source great. Fork the repo, create a branch, and open a pull request. Bug reports and ideas are welcome in the issues.",
        contributors: true,
        starHistory: true,
      };
    case "license":
      return { id, type, title, license: "MIT", holder: p.owner || "the authors" };
    case "profile":
      return { id, type, title, username: p.owner, stats: true, streak: true, langs: true };
    case "custom":
      return { id, type, markdown: "## Anything else\n\nWrite **markdown** here. GitHub alerts, tables and `code` all work." };
    case "footer":
      return { id, type, text: `Made with care by @${p.owner || "you"}`, wave: true, backToTop: true };
  }
}

export function fromTemplate(template: TemplateId, base: Pick<Project, "name" | "owner" | "repo" | "description">): Block[] {
  const b = (type: BlockType) => newBlock(type, base);
  switch (template) {
    case "library":
      return [b("banner"), b("badges"), b("intro"), b("toc"), b("features"), b("install"), b("usage"), b("api"), b("roadmap"), b("contributing"), b("license"), b("footer")];
    case "app": {
      const banner = b("banner");
      if (banner.type === "banner") banner.style = "waves";
      const badges = b("badges");
      if (badges.type === "badges") badges.items = [badge("custom", { label: "status", message: "live", color: "22c55e" }), badge("license"), badge("last-commit"), badge("stars")];
      return [banner, badges, b("intro"), b("screenshots"), b("features"), b("stack"), b("install"), b("faq"), b("contributing"), b("license"), b("footer")];
    }
    case "cli": {
      const banner = b("banner");
      if (banner.type === "banner") {
        banner.style = "terminal";
        banner.font = "mono";
      }
      const usage = b("usage");
      if (usage.type === "usage") {
        usage.lang = "bash";
        usage.code = `# Create a new project\nnpx ${base.name.toLowerCase()} init my-app\n\n# See every command\nnpx ${base.name.toLowerCase()} --help`;
      }
      const api = b("api");
      if (api.type === "api") {
        api.title = "Commands";
        api.rows = [
          { name: "init <dir>", type: "command", def: "—", desc: "Scaffold a new project." },
          { name: "--force", type: "flag", def: "false", desc: "Overwrite existing files." },
        ];
      }
      const install = b("install");
      if (install.type === "install") install.extra = `npx ${base.name.toLowerCase()} --version`;
      return [banner, b("badges"), b("intro"), install, usage, api, b("alert"), b("license"), b("footer")];
    }
    case "profile": {
      const banner = b("banner");
      if (banner.type === "banner") {
        banner.style = "typing";
        banner.tagline = "Full-stack developer | Open-source tinkerer | Coffee-powered";
      }
      const intro = b("intro");
      if (intro.type === "intro") {
        intro.text = "I build fast, accessible things for the web. Currently exploring design systems and developer tooling.";
        intro.links = [
          { label: "Website", url: "" },
          { label: "LinkedIn", url: "" },
          { label: "X", url: "" },
        ];
      }
      const stack = b("stack");
      if (stack.type === "stack") {
        stack.title = "Tech I use";
        stack.icons = ["ts", "react", "nextjs", "nodejs", "tailwind", "postgres", "docker", "figma", "git"];
      }
      return [banner, intro, stack, b("profile"), b("footer")];
    }
    case "minimal": {
      const banner = b("banner");
      if (banner.type === "banner") banner.style = "minimal";
      return [banner, b("badges"), b("intro"), b("install"), b("usage"), b("license")];
    }
  }
}

export function starterProject(): Project {
  const base = { name: "TM Tools", owner: "your-name", repo: "tm-tools", description: "Free design and developer tools that feel like magic." };
  return { ...base, accent: "#10b981", animated: true, dividers: false, emoji: true, blocks: fromTemplate("library", base) };
}
