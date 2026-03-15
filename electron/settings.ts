import { app } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export type AppSettings = {
  defaultOutputFolder: string | null;
};

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputFolder: null,
};

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function normalizeFolderPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return path.resolve(trimmed);
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      defaultOutputFolder: normalizeFolderPath(parsed.defaultOutputFolder),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const settingsPath = getSettingsPath();
  await mkdir(path.dirname(settingsPath), { recursive: true });

  const normalized: AppSettings = {
    defaultOutputFolder: normalizeFolderPath(settings.defaultOutputFolder),
  };

  await writeFile(settingsPath, JSON.stringify(normalized, null, 2), "utf8");
}
