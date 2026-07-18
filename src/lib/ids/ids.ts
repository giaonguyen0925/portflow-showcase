const ID_BODY = /^[a-f0-9]{32}$/;

export type PrefixedId<P extends string> = `${P}_${string}`;

export function createId<P extends string>(prefix: P): PrefixedId<P> {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function isPrefixedId(value: string, prefix: string): boolean {
  if (!value.startsWith(`${prefix}_`)) {
    return false;
  }

  return ID_BODY.test(value.slice(prefix.length + 1));
}

export const createProjectId = () => createId("project");
export const createAssetId = () => createId("asset");
export const createUploadId = () => createId("upload");
export const createRowId = () => createId("row");
export const createColumnId = () => createId("column");
export const createBlockId = () => createId("block");

/** Release IDs sort lexicographically by creation time. */
export function createReleaseId(now: Date = new Date()): PrefixedId<"release"> {
  const stamp = now
    .toISOString()
    .replaceAll(/[-:.TZ]/g, "")
    .slice(0, 14);
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  return `release_${stamp}${random}`;
}
