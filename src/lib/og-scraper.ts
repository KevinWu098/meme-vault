import type { OGMetadata } from "../types";

// Convert Twitter/X URLs to fxtwitter for OG scraping (Twitter blocks direct scraping)
function getScrapableUrl(url: string): string {
  const twitterPattern = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i;
  const match = url.match(twitterPattern);
  if (match) {
    const username = match[3];
    const statusId = match[4];
    return `https://fxtwitter.com/${username}/status/${statusId}`;
  }
  return url;
}

export async function fetchOGMetadata(url: string): Promise<OGMetadata> {
  const scrapableUrl = getScrapableUrl(url);
  const isFxTwitter = scrapableUrl.includes("fxtwitter.com");

  // fxtwitter requires a bot User-Agent to return OG metadata (otherwise redirects to Twitter)
  const userAgent = isFxTwitter
    ? "TelegramBot (like TwitterBot)"
    : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const response = await fetch(scrapableUrl, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();
  return parseOGMetadata(html);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function extractMetaContent(html: string, property: string): string | undefined {
  // Try both property= and name= attributes, in both orders with content=
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }
  return undefined;
}

function parseOGMetadata(html: string): OGMetadata {
  const metadata: OGMetadata = {};

  // Extract image - prefer og:image, fallback to twitter:image
  metadata.imageUrl =
    extractMetaContent(html, "og:image") ||
    extractMetaContent(html, "twitter:image");

  // Extract title and description
  const ogTitle = extractMetaContent(html, "og:title");
  const ogDescription = extractMetaContent(html, "og:description");
  const twitterTitle = extractMetaContent(html, "twitter:title");
  const twitterDescription = extractMetaContent(html, "twitter:description");
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titleTag = titleTagMatch?.[1] ? decodeHtmlEntities(titleTagMatch[1].trim()) : undefined;

  metadata.title = ogTitle || twitterTitle || titleTag;
  metadata.description = ogDescription || twitterDescription;

  // Try to extract image dimensions for aspect ratio
  const width = extractMetaContent(html, "og:image:width");
  const height = extractMetaContent(html, "og:image:height");

  if (width && height) {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (w > 0 && h > 0) {
      metadata.aspectRatio = w / h;
    }
  }

  return metadata;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

