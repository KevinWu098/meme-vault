import {
  Action,
  ActionPanel,
  Alert,
  Clipboard,
  closeMainWindow,
  confirmAlert,
  Grid,
  Icon,
  launchCommand,
  LaunchType,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { deleteMeme, getAllMemes, incrementUsage, toggleFavorite } from "./lib/storage";
import type { Meme } from "./types";

interface MemeGridItemProps {
  meme: Meme;
  subtitle: string;
  onCopyUrl: (meme: Meme) => void;
  onCopyImage: (meme: Meme) => void;
  onToggleFavorite: (meme: Meme) => void;
  onDelete: (meme: Meme) => void;
  formatDate: (date: string) => string;
}

function MemeGridItem({ meme, subtitle, onCopyUrl, onCopyImage, onToggleFavorite, onDelete, formatDate }: MemeGridItemProps) {
  return (
    <Grid.Item
      content={{
        source: meme.imageUrl || Icon.Image,
        fallback: Icon.Image,
      }}
      title={meme.title || "Untitled"}
      subtitle={subtitle}
      keywords={[meme.description, meme.url].filter(Boolean) as string[]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action title="Copy URL" icon={Icon.Clipboard} onAction={() => onCopyUrl(meme)} />
            {meme.imageUrl && (
              <Action
                title="Copy Image URL"
                icon={Icon.Link}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                onAction={() => onCopyImage(meme)}
              />
            )}
            <Action.OpenInBrowser url={meme.url} shortcut={{ modifiers: ["cmd"], key: "o" }} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title={meme.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              icon={meme.isFavorite ? Icon.StarDisabled : Icon.Star}
              shortcut={{ modifiers: ["cmd"], key: "f" }}
              onAction={() => onToggleFavorite(meme)}
            />
            <Action
              title="Delete Meme"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["cmd"], key: "backspace" }}
              onAction={() => onDelete(meme)}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Metadata"
              content={JSON.stringify(
                {
                  url: meme.url,
                  title: meme.title,
                  description: meme.description,
                  addedAt: formatDate(meme.addedAt),
                  usageCount: meme.usageCount,
                },
                null,
                2,
              )}
              shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
            />
            <Action
              title="Store to Vault"
              icon={Icon.Plus}
              shortcut={{ modifiers: ["cmd"], key: "s" }}
              onAction={() => launchCommand({ name: "store-meme", type: LaunchType.UserInitiated })}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const { data: memes = [], isLoading, mutate } = useCachedPromise(getAllMemes, [], {
    keepPreviousData: false,
  });
  const [searchText, setSearchText] = useState("");

  // Filter memes
  const filteredMemes = memes.filter((meme) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      meme.url.toLowerCase().includes(search) ||
      meme.title?.toLowerCase().includes(search) ||
      meme.description?.toLowerCase().includes(search)
    );
  });

  // Sort by last used (most recent first), then by added date for never-used items
  const sortByRecentUse = (a: Meme, b: Meme) => {
    const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime; // Most recently used first
    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(); // Then by added date
  };

  const favorites = filteredMemes.filter((m) => m.isFavorite).sort(sortByRecentUse);

  const recent = filteredMemes.filter((m) => !m.isFavorite).sort(sortByRecentUse);

  // Truncate description to ~60 chars to leave room for stats
  const truncateDescription = (desc?: string) => {
    if (!desc) return "";
    if (desc.length <= 60) return desc;
    return desc.slice(0, 57) + "...";
  };

  // Build subtitle: stats first, then description
  const getSubtitle = (meme: Meme) => {
    const stats = `${meme.isFavorite ? "★ " : ""}${meme.usageCount}×`;
    const desc = truncateDescription(meme.description);
    return desc ? `${stats} · ${desc}` : stats;
  };

  const handleCopyUrl = async (meme: Meme) => {
    // Optimistically update cache, then persist to storage
    const now = new Date().toISOString();
    await mutate(
      incrementUsage(meme.id).then(getAllMemes),
      {
        optimisticUpdate: (data) =>
          data?.map((m) =>
            m.id === meme.id ? { ...m, usageCount: m.usageCount + 1, lastUsedAt: now } : m
          ),
      }
    );
    await closeMainWindow();
    await Clipboard.paste(meme.url);
    await showToast({ style: Toast.Style.Success, title: "Pasted" });
  };

  const handleCopyImage = async (meme: Meme) => {
    if (meme.imageUrl) {
      await Clipboard.copy(meme.imageUrl);
      await closeMainWindow();
      await showToast({ style: Toast.Style.Success, title: "Image URL copied" });
    }
  };

  const handleToggleFavorite = async (meme: Meme) => {
    await mutate(
      toggleFavorite(meme.id).then(getAllMemes),
      {
        optimisticUpdate: (data) =>
          data?.map((m) => (m.id === meme.id ? { ...m, isFavorite: !m.isFavorite } : m)),
      }
    );
  };

  const handleDelete = async (meme: Meme) => {
    if (
      await confirmAlert({
        title: "Delete Meme",
        message: `Are you sure you want to delete "${meme.title || meme.url}"?`,
        primaryAction: {
          title: "Delete",
          style: Alert.ActionStyle.Destructive,
        },
      })
    ) {
      await mutate(
        deleteMeme(meme.id).then(getAllMemes),
        {
          optimisticUpdate: (data) => data?.filter((m) => m.id !== meme.id),
        }
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Grid
      columns={3}
      aspectRatio="3/2"
      fit={Grid.Fit.Fill}
      isLoading={isLoading}
      searchBarPlaceholder="Search memes..."
      onSearchTextChange={setSearchText}
    >
      {filteredMemes.length === 0 && !isLoading ? (
        <Grid.EmptyView
          icon={Icon.Image}
          title="No Memes Found"
          description={searchText ? "Try a different search term" : "Add some memes with the 'Store Meme' command"}
        />
      ) : (
        <>
          {favorites.length > 0 && (
            <Grid.Section title="Favorites" subtitle={`${favorites.length} ${favorites.length === 1 ? 'meme' : 'memes'}`}>
              {favorites.map((meme) => (
                <MemeGridItem
                  key={meme.id}
                  meme={meme}
                  subtitle={getSubtitle(meme)}
                  onCopyUrl={handleCopyUrl}
                  onCopyImage={handleCopyImage}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDelete}
                  formatDate={formatDate}
                />
              ))}
            </Grid.Section>
          )}
          {recent.length > 0 && (
            <Grid.Section title="Memes" subtitle={`${recent.length} ${recent.length === 1 ? 'meme' : 'memes'}`}>
              {recent.map((meme) => (
                <MemeGridItem
                  key={meme.id}
                  meme={meme}
                  subtitle={getSubtitle(meme)}
                  onCopyUrl={handleCopyUrl}
                  onCopyImage={handleCopyImage}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDelete}
                  formatDate={formatDate}
                />
              ))}
            </Grid.Section>
          )}
        </>
      )}
    </Grid>
  );
}
