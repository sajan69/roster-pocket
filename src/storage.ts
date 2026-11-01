import { empty, validate } from "./domain";
import type { Workspace } from "./domain";
export type Snapshot = { revision: number; data: Workspace };
let connection: Promise<IDBDatabase> | null = null;
function db() {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("roster-pocket", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("workspace");
      r.onerror = () => reject(new Error("Browser storage is unavailable."));
      r.onblocked = () =>
        reject(new Error("Close other RosterPocket tabs, then reload."));
      r.onsuccess = () => {
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
    });
  return connection;
}
function snapshot(value: unknown): Snapshot {
  if (value === undefined) return { revision: 0, data: empty() };
  if (
    !value ||
    typeof value !== "object" ||
    !("revision" in value) ||
    !("data" in value) ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1
  )
    throw new Error("Stored data could not be read. It has not been changed.");
  return { revision: value.revision, data: validate(value.data) };
}
export async function load(): Promise<Snapshot> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("workspace", "readonly");
    const r = tx.objectStore("workspace").get("current");
    let result: Snapshot;
    r.onsuccess = () => {
      try {
        result = snapshot(r.result);
      } catch (error) {
        reject(error);
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () =>
      reject(new Error("Could not read saved data."));
  });
}
export async function save(
  expected: number,
  data: Workspace,
): Promise<Snapshot> {
  const checked = validate(data);
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    const r = store.get("current");
    let next: Snapshot;
    let reason = "Could not save. Your previous saved schedule is unchanged.";
    r.onsuccess = () => {
      try {
        const current = snapshot(r.result);
        if (current.revision !== expected) {
          reason = "Another tab saved changes. Reload before editing again.";
          tx.abort();
          return;
        }
        next = { revision: expected + 1, data: checked };
        store.put(next, "current");
      } catch {
        reason = "Stored data could not be read. It has not been changed.";
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = tx.onerror = () => reject(new Error(reason));
  });
}
