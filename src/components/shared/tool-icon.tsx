import {
  BarChart3Icon,
  ContactIcon,
  HashIcon,
  KeyRoundIcon,
  LinkIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PhoneIcon,
  QrCodeIcon,
  Share2Icon,
  SparklesIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  BarChart3: BarChart3Icon,
  Contact: ContactIcon,
  Hash: HashIcon,
  KeyRound: KeyRoundIcon,
  Mail: MailIcon,
  MessageCircle: MessageCircleIcon,
  MessageSquare: MessageSquareIcon,
  Phone: PhoneIcon,
  QrCode: QrCodeIcon,
  Share2: Share2Icon,
  Sparkles: SparklesIcon,
  Type: TypeIcon,
};

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? LinkIcon;
  return <Icon className={className} aria-hidden />;
}
