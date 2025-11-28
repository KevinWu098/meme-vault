export interface Meme {
  id: string;
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  addedAt: string;
  lastUsedAt?: string;
  usageCount: number;
  isFavorite: boolean;
  aspectRatio?: number;
}

export interface OGMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  aspectRatio?: number;
}


