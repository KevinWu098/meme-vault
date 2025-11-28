import { Action, ActionPanel, Form, showToast, Toast, popToRoot } from "@raycast/api";
import { useState } from "react";
import { fetchOGMetadata, generateId, isValidUrl } from "./lib/og-scraper";
import { getMemeByUrl, saveMeme } from "./lib/storage";
import type { Meme } from "./types";

export default function Command() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | undefined>();

  async function handleSubmit() {
    if (!url.trim()) {
      setUrlError("URL is required");
      return;
    }

    if (!isValidUrl(url.trim())) {
      setUrlError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    setUrlError(undefined);

    try {
      // Check if meme already exists
      const existing = await getMemeByUrl(url.trim());
      if (existing) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Meme Already Exists",
          message: existing.title || url.trim(),
        });
        setIsLoading(false);
        return;
      }

      // Fetch OG metadata
      const metadata = await fetchOGMetadata(url.trim());

      // Create meme object
      const meme: Meme = {
        id: generateId(),
        url: url.trim(),
        title: metadata.title,
        description: metadata.description,
        imageUrl: metadata.imageUrl,
        addedAt: new Date().toISOString(),
        usageCount: 0,
        isFavorite: false,
        aspectRatio: metadata.aspectRatio,
      };

      // Save to storage
      await saveMeme(meme);

      await showToast({ style: Toast.Style.Success, title: "Saved", message: meme.title || "Meme" });
      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Store Meme",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Store Meme" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="URL"
        placeholder="https://tenor.com/view/..."
        value={url}
        onChange={(newValue) => {
          setUrl(newValue);
          if (urlError) setUrlError(undefined);
        }}
        error={urlError}
        autoFocus
      />
      <Form.Description
        title="Supported Sources"
        text="Tenor, Giphy, Twitter/X, and any site with Open Graph metadata"
      />
    </Form>
  );
}

