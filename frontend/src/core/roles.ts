import {
  ShieldStar,
  ShieldCheck,
  Lightning,
  User as UserIcon,
  IconProps,
  Gavel,
} from "@phosphor-icons/react";
import { Shield } from "phosphor-react";

export const ROLE_BADGE: Record<
  string,
  {
    label: string;
    color: string;
    icon: React.FC<IconProps>;
    importance: 'high' | 'low' | 'hide';
  }
> = {
  ADMIN: {
    label: "Admin",
    color: "text-red-400 bg-red-500/10",
    icon: ShieldCheck,
    importance: 'high'
  },
  MODERATOR: {
    label: "Moderator",
    color: "text-blue-400 bg-blue-500/10",
    icon: Gavel,
    importance: 'high'
  },
  "POWER USER": {
    label: "Power User",
    color: "text-yellow-400 bg-yellow-500/10",
    icon: Lightning,
    importance: 'low'
  },
};