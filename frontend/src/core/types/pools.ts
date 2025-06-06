import { SafetyType } from "@prisma/client";

export type Pool = {
  id: number;
  name: string;
  artist: string | null;
  description: string | null;
  safety: SafetyType;
  yearStart: number | null;
  yearEnd: number | null;
  lastEdited: string;
  createdAt: string;
  score: number | 0;
  _count: {
    items: number;
  };
  items: PoolItem[];
  user: {
    vote: 1 | 0 | -1;
    signedIn: boolean;
  }
};

type PoolItem = {
  id: number;
  index: number;
  notes: string | null;
  post: {
    id: number;
    previewPath: string;
    safety: "SAFE" | "UNSAFE" | "SKETCHY";
    score: number;
    aspectRatio: number | null;
    uploadedById: string;
    createdAt: string;
    _count: {
      favoritedBy: number;
    };
  };
};
