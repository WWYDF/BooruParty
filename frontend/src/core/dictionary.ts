import {
  ShieldStar,
  ShieldCheck,
  Lightning,
  User as UserIcon,
  IconProps,
  Gavel,
} from "@phosphor-icons/react";
import { Shield } from "phosphor-react";


export const FILE_TYPE_LABELS: Record<string, string> = {
  png: "Image",
  webp: "Image",
  gif: "Animated",
};

export const ROLE_BADGE: Record<
  string,
  {
    label: string;
    color: string;
    icon: React.FC<IconProps>;
    importance: 'high' | 'low' | 'hide';
  }
> = {
  Admin: {
    label: "Admin",
    color: "text-red-400 bg-red-500/10",
    icon: ShieldCheck,
    importance: 'high'
  },
  Moderator: {
    label: "Moderator",
    color: "text-blue-400 bg-blue-500/10",
    icon: Gavel,
    importance: 'high'
  },
  "Power User": {
    label: "Power User",
    color: "text-blue-400 bg-blue-500/10",
    icon: Lightning,
    importance: 'low'
  },
};

// This should match whats in Fastify.
export const FILE_TYPE_MAP: Record<'image' | 'animated' | 'video' | 'other', string[]> = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'],
  animated: ['.gif', '.apng'],
  video: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
  other: []
};

export type FileType = keyof typeof FILE_TYPE_MAP;

export function resolveFileType(ext: string): FileType {
  const lowered = ext.toLowerCase();

  for (const type of Object.keys(FILE_TYPE_MAP) as FileType[]) {
    if (FILE_TYPE_MAP[type].includes(lowered)) {
      return type;
    }
  }

  return 'other';
}