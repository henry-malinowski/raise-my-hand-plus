/**
 * Register custom Handlebars helpers.
 * @returns {void}
 */
export function registerHandlebarsHelpers() {
  Handlebars.registerHelper({
    setHas
  });
}

/**
 * Handlebars helper function for checking Set membership in templates.
 * @param {Set} set - The set to check
 * @param {*} value - The value to check for
 * @returns {boolean} Whether the set contains the value
 */
function setHas(set, value) {
  return (set instanceof Set) && set.has(value);
}
