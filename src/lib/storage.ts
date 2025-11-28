import { LocalStorage } from "@raycast/api";
import type { Meme } from "../types";

const MEMES_KEY = "memes";

export async function getAllMemes(): Promise<Meme[]> {
  const data = await LocalStorage.getItem<string>(MEMES_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data) as Meme[];
  } catch {
    return [];
  }
}

export async function saveMeme(meme: Meme): Promise<void> {
  const memes = await getAllMemes();
  const existingIndex = memes.findIndex((m) => m.id === meme.id);
  if (existingIndex >= 0) {
    memes[existingIndex] = meme;
  } else {
    memes.unshift(meme);
  }
  await LocalStorage.setItem(MEMES_KEY, JSON.stringify(memes));
}

export async function deleteMeme(id: string): Promise<void> {
  const memes = await getAllMemes();
  const filtered = memes.filter((m) => m.id !== id);
  await LocalStorage.setItem(MEMES_KEY, JSON.stringify(filtered));
}

export async function incrementUsage(id: string): Promise<void> {
  const memes = await getAllMemes();
  const meme = memes.find((m) => m.id === id);
  if (meme) {
    meme.usageCount += 1;
    await LocalStorage.setItem(MEMES_KEY, JSON.stringify(memes));
  }
}

export async function toggleFavorite(id: string): Promise<void> {
  const memes = await getAllMemes();
  const meme = memes.find((m) => m.id === id);
  if (meme) {
    meme.isFavorite = !meme.isFavorite;
    await LocalStorage.setItem(MEMES_KEY, JSON.stringify(memes));
  }
}

export async function getMemeByUrl(url: string): Promise<Meme | undefined> {
  const memes = await getAllMemes();
  return memes.find((m) => m.url === url);
}

