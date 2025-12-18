import { environment } from "@raycast/api";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const IMAGES_DIR = join(environment.supportPath, "images");

export function getStorageStats(): { imageCount: number; totalSizeMB: number } {
  let imageCount = 0;
  let totalBytes = 0;

  if (existsSync(IMAGES_DIR)) {
    const files = readdirSync(IMAGES_DIR);
    imageCount = files.length;
    for (const file of files) {
      try {
        const stat = statSync(join(IMAGES_DIR, file));
        totalBytes += stat.size;
      } catch {
        // Ignore errors for individual files
      }
    }
  }

  return {
    imageCount,
    totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 10) / 10, // Round to 1 decimal
  };
}

export function formatStorageSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}
