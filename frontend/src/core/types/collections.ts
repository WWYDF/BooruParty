import { Posts } from "./posts";

// collectionSummarySelect (POST /api/collections returns exactly this)
export type CollectionSummary = {
  id: string;           // uuid
  name: string;
  isPublic: boolean;    // false = only the owner can see it (or find it with collection:<id>)
  itemCount: number;    // every post in it, including ones the viewer can't see
  ownerId: string;
  updatedAt: string;
  createdAt: string;
};

// GET /api/collections?owner=<username>
export type CollectionCard = CollectionSummary & {
  cover: Posts | null;  // most recently added post the viewer can see; null = none visible
};

export type CollectionList = {
  collections: CollectionCard[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const COLLECTION_SORTS = ['updated', 'newest', 'name', 'size'] as const;
export type CollectionSort = typeof COLLECTION_SORTS[number];

// GET /api/collections/own?postId=<id>
export type OwnCollection = CollectionSummary & {
  hasPost: boolean;     // only sent when postId was given
};

// The feed query that shows a collection's posts
export const collectionQuery = (id: string) => `collection:${id}`;
