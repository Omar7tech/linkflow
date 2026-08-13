import type { LucideIcon } from "lucide-react";
import {
  BotIcon,
  BoxIcon,
  BracesIcon,
  BugIcon,
  CloudIcon,
  Code2Icon,
  DatabaseIcon,
  FileKeyIcon,
  FileWarningIcon,
  FingerprintIcon,
  FolderTreeIcon,
  FrameIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayersIcon,
  LinkIcon,
  LockKeyholeIcon,
  MailWarningIcon,
  NetworkIcon,
  PackageIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  ScanSearchIcon,
  ServerIcon,
  ShieldQuestionIcon,
  SmartphoneIcon,
  TimerResetIcon,
  UploadCloudIcon,
  UserRoundSearchIcon,
} from "lucide-react";

export type AttackCategory = "Application" | "Identity" | "Network" | "Endpoint" | "Cloud" | "Supply chain" | "AI";
export type AttackKind =
  | "sql" | "nosql" | "command" | "xss" | "csrf" | "clickjack" | "redirect"
  | "ssrf" | "idor" | "traversal" | "upload" | "deserialize"
  | "phishing" | "credential" | "mfa" | "session"
  | "mitm" | "dns" | "ddos" | "replay"
  | "ransomware" | "fileless"
  | "bucket" | "iam" | "container"
  | "dependency" | "typosquat"
  | "prompt" | "poison" | "race";

export type Attack = {
  id: string;
  title: string;
  category: AttackCategory;
  kind: AttackKind;
  icon: LucideIcon;
  difficulty: "FOUNDATION" | "INTERMEDIATE" | "ADVANCED";
  mission: string;
  action: string;
  observe: string;
  defense: string;
  tags: string[];
};

export const ATTACK_CATEGORIES: AttackCategory[] = ["Application", "Identity", "Network", "Endpoint", "Cloud", "Supply chain", "AI"];

export const ATTACKS: Attack[] = [
  { id: "sql-injection", title: "SQL injection", category: "Application", kind: "sql", icon: DatabaseIcon, difficulty: "FOUNDATION", mission: "Bypass a fictional login and watch the database parse your text as SQL structure.", action: "Edit the username, then run the query.", observe: "Follow the colored tokens from input to WHERE logic to returned rows.", defense: "Switch to parameters so input stays data.", tags: ["OWASP", "database", "injection"] },
  { id: "nosql-injection", title: "NoSQL injection", category: "Application", kind: "nosql", icon: BracesIcon, difficulty: "INTERMEDIATE", mission: "Turn a login value into an operator object inside a simulated document query.", action: "Change the request body and submit it.", observe: "See the object type change from string to operator.", defense: "Enforce a strict request schema.", tags: ["MongoDB", "operator", "schema"] },
  { id: "command-injection", title: "Command injection", category: "Application", kind: "command", icon: Code2Icon, difficulty: "ADVANCED", mission: "See how an unsafe diagnostics field becomes a second shell command.", action: "Add a command separator to the host field.", observe: "The shell splits one intended command into two jobs.", defense: "Use an argument array and allowlist.", tags: ["shell", "RCE", "validation"] },
  { id: "stored-xss", title: "Stored XSS", category: "Application", kind: "xss", icon: BugIcon, difficulty: "FOUNDATION", mission: "Store a comment and inspect whether the browser creates text or an executable DOM node.", action: "Insert the provided harmless script marker.", observe: "Watch the DOM tree and visitor session panel.", defense: "Encode output and apply a content security policy.", tags: ["browser", "DOM", "session"] },
  { id: "csrf", title: "Cross-site request forgery", category: "Application", kind: "csrf", icon: RefreshCwIcon, difficulty: "INTERMEDIATE", mission: "Use a malicious tab to send a bank action with another tab's existing session.", action: "Open the lure and send the hidden form.", observe: "The browser automatically attaches the session cookie.", defense: "Require a per-request anti-CSRF token.", tags: ["browser", "cookie", "request"] },
  { id: "clickjacking", title: "Clickjacking", category: "Application", kind: "clickjack", icon: LayersIcon, difficulty: "FOUNDATION", mission: "Reveal the invisible sensitive button positioned under a harmless-looking control.", action: "Adjust the overlay opacity, then click the lure.", observe: "One pointer event lands on a different interface.", defense: "Block framing with frame-ancestors.", tags: ["iframe", "UI redress", "browser"] },
  { id: "open-redirect", title: "Open redirect", category: "Application", kind: "redirect", icon: LinkIcon, difficulty: "FOUNDATION", mission: "Inspect how a trusted domain forwards a visitor to an untrusted destination.", action: "Change the next URL and follow the redirect.", observe: "Trust is borrowed from the first hostname.", defense: "Allowlist destinations and use identifiers.", tags: ["URL", "phishing", "redirect"] },
  { id: "ssrf", title: "Server-side request forgery", category: "Application", kind: "ssrf", icon: ServerIcon, difficulty: "ADVANCED", mission: "Make a public image fetcher attempt to reach a simulated internal metadata service.", action: "Choose a destination and let the server fetch it.", observe: "The request originates inside the trusted network.", defense: "Enforce destination and network egress rules.", tags: ["server", "metadata", "cloud"] },
  { id: "idor", title: "IDOR / BOLA", category: "Application", kind: "idor", icon: UserRoundSearchIcon, difficulty: "FOUNDATION", mission: "Change a record identifier and test whether ownership is checked.", action: "Move from your invoice to another account's invoice.", observe: "Authentication succeeds while authorization fails.", defense: "Check object ownership on every request.", tags: ["API", "authorization", "object"] },
  { id: "path-traversal", title: "Path traversal", category: "Application", kind: "traversal", icon: FolderTreeIcon, difficulty: "INTERMEDIATE", mission: "Watch path segments walk out of the intended downloads directory.", action: "Add parent-directory segments to the filename.", observe: "The normalized path resolves above the allowed root.", defense: "Resolve paths and enforce a fixed root.", tags: ["filesystem", "path", "files"] },
  { id: "file-upload", title: "Malicious file upload", category: "Application", kind: "upload", icon: UploadCloudIcon, difficulty: "INTERMEDIATE", mission: "Send disguised files through a simulated upload inspection pipeline.", action: "Select a file and compare extension, MIME, and signature.", observe: "A filename alone is not a file type.", defense: "Verify signatures, rename, isolate, and scan.", tags: ["upload", "MIME", "malware"] },
  { id: "deserialization", title: "Unsafe deserialization", category: "Application", kind: "deserialize", icon: BoxIcon, difficulty: "ADVANCED", mission: "Expand an untrusted object and see a dangerous behavior field become executable intent.", action: "Decode the sample object.", observe: "Reconstruction crosses from data into behavior.", defense: "Use simple schemas and reject polymorphic types.", tags: ["object", "RCE", "schema"] },

  { id: "phishing", title: "Spear phishing", category: "Identity", kind: "phishing", icon: MailWarningIcon, difficulty: "FOUNDATION", mission: "Investigate a convincing message by checking identity, language, and destination.", action: "Mark every suspicious part of the email.", observe: "The display name and visible button hide the real origins.", defense: "Verify through a second channel and report.", tags: ["email", "social engineering", "BEC"] },
  { id: "credential-stuffing", title: "Credential stuffing", category: "Identity", kind: "credential", icon: KeyRoundIcon, difficulty: "FOUNDATION", mission: "Run leaked username/password pairs against a fictional login fleet.", action: "Start the wave, then enable layered identity controls.", observe: "One reused password converts a leak into takeover.", defense: "MFA, breach checks, and adaptive rate limits.", tags: ["password", "automation", "ATO"] },
  { id: "password-spraying", title: "Password spraying", category: "Identity", kind: "credential", icon: FingerprintIcon, difficulty: "INTERMEDIATE", mission: "Try one common password across many accounts without tripping per-account lockouts.", action: "Change the distribution strategy.", observe: "Low-and-slow attempts spread the detection signal.", defense: "Tenant-wide detection and banned passwords.", tags: ["password", "identity", "low-and-slow"] },
  { id: "mfa-fatigue", title: "MFA fatigue", category: "Identity", kind: "mfa", icon: SmartphoneIcon, difficulty: "FOUNDATION", mission: "Experience repeated approval prompts and inspect why a single tap completes a takeover.", action: "Send prompts, then change the MFA method.", observe: "A second factor can still be socially engineered.", defense: "Number matching and phishing-resistant keys.", tags: ["MFA", "push", "social engineering"] },
  { id: "session-hijacking", title: "Session hijacking", category: "Identity", kind: "session", icon: FileKeyIcon, difficulty: "INTERMEDIATE", mission: "Move a simulated session token between browsers and test what the server trusts.", action: "Copy the token into the second browser.", observe: "The token—not the password—represents the signed-in user.", defense: "Short life, rotation, secure cookies, and binding signals.", tags: ["cookie", "token", "account"] },

  { id: "mitm", title: "Man-in-the-middle", category: "Network", kind: "mitm", icon: NetworkIcon, difficulty: "FOUNDATION", mission: "Send a packet across a hostile access point and inspect what is readable or mutable.", action: "Transmit with and without transport encryption.", observe: "Routing metadata remains visible while protected content does not.", defense: "TLS validation and secure network access.", tags: ["packet", "TLS", "interception"] },
  { id: "dns-spoofing", title: "DNS spoofing", category: "Network", kind: "dns", icon: GlobeIcon, difficulty: "INTERMEDIATE", mission: "Compare a legitimate and poisoned DNS answer before a browser connects.", action: "Inject the false resolver response.", observe: "The earliest accepted answer controls the destination.", defense: "DNSSEC, trusted resolvers, and TLS hostname checks.", tags: ["DNS", "resolver", "spoofing"] },
  { id: "ddos", title: "Distributed denial of service", category: "Network", kind: "ddos", icon: RadioTowerIcon, difficulty: "FOUNDATION", mission: "Drive request volume past origin capacity while keeping real users visible.", action: "Change attack volume and place mitigation layers.", observe: "Availability fails before authentication matters.", defense: "Edge absorption, rate control, caching, and queues.", tags: ["availability", "botnet", "traffic"] },
  { id: "replay", title: "Replay attack", category: "Network", kind: "replay", icon: TimerResetIcon, difficulty: "INTERMEDIATE", mission: "Capture one valid signed action and attempt to submit it again.", action: "Replay the transaction packet.", observe: "Integrity does not guarantee freshness.", defense: "Use nonces, timestamps, and one-time identifiers.", tags: ["nonce", "token", "protocol"] },

  { id: "ransomware", title: "Ransomware", category: "Endpoint", kind: "ransomware", icon: LockKeyholeIcon, difficulty: "FOUNDATION", mission: "Trigger a safe file-encryption animation and contain it before shared storage is reached.", action: "Run the sample, isolate the host, and recover.", observe: "Reachable files and credentials determine blast radius.", defense: "Segmentation, EDR, least privilege, and immutable backups.", tags: ["malware", "encryption", "recovery"] },
  { id: "fileless", title: "Fileless malware", category: "Endpoint", kind: "fileless", icon: BugIcon, difficulty: "ADVANCED", mission: "Trace malicious behavior through trusted system processes without a dropped executable.", action: "Expand the process tree and inspect memory activity.", observe: "Trusted tools can perform untrusted actions.", defense: "Behavior detection, constrained scripting, and logging.", tags: ["memory", "process", "living off the land"] },

  { id: "public-bucket", title: "Public cloud storage", category: "Cloud", kind: "bucket", icon: CloudIcon, difficulty: "FOUNDATION", mission: "Change a bucket policy and see exactly which identities gain access.", action: "Edit exposure and test three viewers.", observe: "One policy statement expands the trust boundary globally.", defense: "Block public access and continuously audit policy.", tags: ["storage", "policy", "exposure"] },
  { id: "iam-escalation", title: "Cloud IAM escalation", category: "Cloud", kind: "iam", icon: ShieldQuestionIcon, difficulty: "ADVANCED", mission: "Chain harmless-looking permissions into a new privileged identity.", action: "Connect allowed actions to an escalation path.", observe: "Permission combinations can be stronger than each permission alone.", defense: "Graph effective permissions and protect role delegation.", tags: ["IAM", "privilege", "policy"] },
  { id: "container-escape", title: "Container escape", category: "Cloud", kind: "container", icon: FrameIcon, difficulty: "ADVANCED", mission: "Inspect how an over-privileged container reaches the host boundary.", action: "Toggle runtime privileges and attempt each boundary.", observe: "A container is process isolation, not a security guarantee.", defense: "Rootless runtime, syscall controls, and minimal mounts.", tags: ["container", "host", "runtime"] },

  { id: "dependency-confusion", title: "Dependency confusion", category: "Supply chain", kind: "dependency", icon: PackageIcon, difficulty: "INTERMEDIATE", mission: "Let a package manager choose between private and public packages with the same name.", action: "Change source priority and version numbers.", observe: "Resolution rules select provenance before code review begins.", defense: "Private scopes, source pinning, and provenance verification.", tags: ["package", "registry", "build"] },
  { id: "typosquatting", title: "Package typosquatting", category: "Supply chain", kind: "typosquat", icon: ScanSearchIcon, difficulty: "FOUNDATION", mission: "Choose dependencies from a search result where one character changes the publisher.", action: "Inspect names, downloads, age, and signing identity.", observe: "Visual similarity exploits rushed installation.", defense: "Lockfiles, allowlists, and verified publishers.", tags: ["package", "typo", "registry"] },

  { id: "prompt-injection", title: "Indirect prompt injection", category: "AI", kind: "prompt", icon: BotIcon, difficulty: "INTERMEDIATE", mission: "Place hostile instructions inside retrieved content and inspect the model's instruction stack.", action: "Run with and without content isolation and tool limits.", observe: "Untrusted data competes with trusted instructions.", defense: "Separate trust levels and constrain tools and outputs.", tags: ["LLM", "RAG", "instructions"] },
  { id: "data-poisoning", title: "Training-data poisoning", category: "AI", kind: "poison", icon: FileWarningIcon, difficulty: "ADVANCED", mission: "Add crafted points to a tiny classifier and watch its decision boundary move.", action: "Inject or remove poisoned samples.", observe: "A small strategic change can distort learned behavior.", defense: "Provenance, robust training, and outlier review.", tags: ["ML", "training", "integrity"] },
  { id: "race-condition", title: "Race condition", category: "Application", kind: "race", icon: BracesIcon, difficulty: "INTERMEDIATE", mission: "Send two valid redemptions before either transaction updates shared state.", action: "Fire both requests and then enable an atomic lock.", observe: "Correct individual requests produce an incorrect combined result.", defense: "Atomic transactions, locks, and idempotency keys.", tags: ["concurrency", "state", "logic"] },
];
