import { Action, ActionPanel, environment, Form, showToast, Toast, popToRoot } from "@raycast/api";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { basename, extname, join } from "path";
import { useState } from "react";
import { fetchOGMetadata, generateId, isValidUrl } from "./lib/og-scraper";
import { getMemeByUrl, saveMeme } from "./lib/storage";
import type { Meme } from "./types";

const IMAGES_DIR = join(environment.supportPath, "images");

// Ensure images directory exists
function ensureImagesDir() {
  if (!existsSync(IMAGES_DIR)) {
    mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

export default function Command() {
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | undefined>();

  async function handleSubmit() {
    const hasUrl = url.trim().length > 0;
    const hasFile = files.length > 0;

    if (!hasUrl && !hasFile) {
      setUrlError("Enter a URL or select an image file");
      return;
    }

    if (hasUrl && !isValidUrl(url.trim())) {
      setUrlError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    setUrlError(undefined);

    try {
      if (hasFile && files[0]) {
        // Store local image
        await storeLocalImage(files[0], title);
      } else if (hasUrl) {
        // Store from URL
        await storeFromUrl(url.trim());
      }

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

  async function storeFromUrl(urlStr: string) {
    // Check if meme already exists
    const existing = await getMemeByUrl(urlStr);
    if (existing) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Meme Already Exists",
        message: existing.title || urlStr,
      });
      return;
    }

    // Fetch OG metadata
    const metadata = await fetchOGMetadata(urlStr);

    // Create meme object
    const meme: Meme = {
      id: generateId(),
      url: urlStr,
      title: metadata.title,
      description: metadata.description,
      imageUrl: metadata.imageUrl,
      addedAt: new Date().toISOString(),
      usageCount: 0,
      isFavorite: false,
      aspectRatio: metadata.aspectRatio,
    };

    await saveMeme(meme);
    await showToast({ style: Toast.Style.Success, title: "Saved", message: meme.title || "Meme" });
  }

  async function storeLocalImage(filePath: string, customTitle: string) {
    ensureImagesDir();

    // Generate unique filename
    const id = generateId();
    const ext = extname(filePath) || ".png";
    const filename = `${id}${ext}`;
    const destPath = join(IMAGES_DIR, filename);

    // Copy file to images directory
    copyFileSync(filePath, destPath);

    // Create meme object
    const meme: Meme = {
      id,
      url: `file://${destPath}`, // Use file:// URL for local files
      title: customTitle || basename(filePath, ext),
      localPath: destPath,
      imageUrl: destPath, // Use local path for display
      addedAt: new Date().toISOString(),
      usageCount: 0,
      isFavorite: false,
    };

    await saveMeme(meme);
    await showToast({ style: Toast.Style.Success, title: "Saved", message: meme.title || "Image" });
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Store to Vault" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Add a meme from URL or select a local image file" />

      <Form.TextField
        id="url"
        title="URL"
        placeholder="https://tenor.com/view/..."
        value={url}
        onChange={(newValue) => {
          setUrl(newValue);
          if (newValue.trim()) setFiles([]); // Clear file if URL entered
          if (urlError) setUrlError(undefined);
        }}
        error={urlError}
      />

      <Form.Separator />

      <Form.FilePicker
        id="file"
        title="Or Select Image"
        allowMultipleSelection={false}
        canChooseDirectories={false}
        canChooseFiles={true}
        value={files}
        onChange={(newFiles) => {
          setFiles(newFiles);
          if (newFiles.length > 0) setUrl(""); // Clear URL if file selected
          if (urlError) setUrlError(undefined);
        }}
      />

      {files.length > 0 && (
        <Form.TextField
          id="title"
          title="Title (Optional)"
          placeholder="My awesome meme"
          value={title}
          onChange={setTitle}
        />
      )}
    </Form>
  );
}
