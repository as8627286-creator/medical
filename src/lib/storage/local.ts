import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";
import {
  assertSafeKey,
  STORAGE_NAMESPACE,
  type LoadedObject,
  type StorageProvider,
  type StoredObject,
} from "./types";

/**
 * Filesystem-backed storage driver.
 *
 * The storage root is resolved to an absolute path and every key is checked to
 * stay inside it, so a crafted key cannot read or write outside the volume.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly driver = "local" as const;
  private readonly root: string;

  constructor(root?: string) {
    const env = getEnv();
    this.root = path.resolve(root ?? env.STORAGE_LOCAL_ROOT);
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    const absolute = path.resolve(this.root, key);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (!absolute.startsWith(rootWithSep)) {
      throw new Error("Storage key escapes the storage root.");
    }
    return absolute;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const absolute = this.resolve(key);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, data);
    // The content type is stored next to the object so that `get` can return it
    // without consulting the database.
    await writeFile(`${absolute}.meta`, JSON.stringify({ contentType }), "utf8");
    return { key, bytes: data.byteLength, contentType };
  }

  async get(key: string): Promise<LoadedObject | null> {
    const absolute = this.resolve(key);
    try {
      const info = await stat(absolute);
      if (!info.isFile()) return null;
    } catch {
      return null;
    }
    const body = await readFile(absolute);
    let contentType = "application/octet-stream";
    try {
      const meta = JSON.parse(await readFile(`${absolute}.meta`, "utf8")) as { contentType?: string };
      if (meta.contentType) contentType = meta.contentType;
    } catch {
      // Fall through to the default content type.
    }
    return { body: new Uint8Array(body), contentType, bytes: body.byteLength };
  }

  async delete(key: string): Promise<void> {
    const absolute = this.resolve(key);
    await rm(absolute, { force: true });
    await rm(`${absolute}.meta`, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    const absolute = this.resolve(key);
    try {
      const info = await stat(absolute);
      return info.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Local objects are served through the application media route so that the
   * storage root never has to be exposed by a web server.
   */
  publicUrl(key: string): string | null {
    if (!key.startsWith(`${STORAGE_NAMESPACE.PRODUCTS}/`)) return null;
    return `/media/${key}`;
  }
}
