/**
 * Get the Foundry package ID from the URL of the loaded module script.
 *
 * This lets the same source run from either the development folder
 * (raise-my-hand-plus) or the packaged folder (raise-my-hand).
 *
 * @param {string} moduleUrl - A module script URL.
 * @returns {string}
 */
export function getModuleId(moduleUrl = import.meta.url) {
  const match = moduleUrl.match(/(?:^|\/)modules\/([^/?#]+)\//);
  return match ? decodeURIComponent(match[1]) : "raise-my-hand";
}

/**
 * The module ID used for FoundryVTT module registration and settings.
 * @type {string}
 */
export const MODULE_ID = getModuleId();
