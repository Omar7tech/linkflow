import {
  BarChart3Icon,
  BookOpenIcon,
  ContactIcon,
  FrameIcon,
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
  BookOpen: BookOpenIcon,
  Contact: ContactIcon,
  Frame: FrameIcon,
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
