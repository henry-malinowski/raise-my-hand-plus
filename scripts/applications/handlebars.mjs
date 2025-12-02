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
 * Check if a Set has a value.
 * @param {Set} set     The set to check
 * @param {*} value     The value to check for
 * @returns {boolean}   Whether the set contains the value
 */
function setHas(set, value) {
  return (set instanceof Set) && set.has(value);
}
