"use client";

import { MailIcon, MessageSquareIcon, Share2Icon } from "lucide-react";
import { ModedTool, type ToolMode } from "@/components/shared/tool-modes";
import { EmailTool } from "./email-tool";
import { ShareTool } from "./share-tool";
import { SmsTool } from "./sms-tool";

const MODES: ToolMode[] = [
  { id: "share", label: "Share a link", icon: Share2Icon, Tool: ShareTool },
  { id: "sms", label: "SMS link", icon: MessageSquareIcon, Tool: SmsTool },
  { id: "email", label: "Email link", icon: MailIcon, Tool: EmailTool },
];

/** Share links for the networks, plus the sms: and mailto: link builders. */
export function ShareHub() {
  return <ModedTool modes={MODES} label="Kind of link" />;
}
