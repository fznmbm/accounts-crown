import { CONFIG } from "../config";

export async function getOwnerUserId() {
  return CONFIG.ownerUserId;
}

export function clearOwnerCache() {}
