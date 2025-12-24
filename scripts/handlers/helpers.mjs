import { MODULE_ID } from "../raise-my-hand.mjs";

/** @type {number} Timestamp of last hand raise/X-card action (0 = never) */
let lastSentNotification = 0;

/** @type {Sound|null} Track the module's currently playing sound */
let currentPlayingSound = null;

/**
 * Check if the timeout has passed since the last hand raise/X-card action.
 * @returns {boolean} True if timeout has passed or is disabled, false if too soon
 */
export function timeoutPassed() {
  const timeoutSeconds = game.settings.get(MODULE_ID, "notificationTimeout");
  const now = Date.now();
  return (now - lastSentNotification) >= (timeoutSeconds * 1000);
}

/**
 * Check if timeout has passed and update timestamp if so.
 * @returns {boolean} True if timeout passed and timestamp was updated, false if too soon
 */
export function checkAndUpdateTimeout() {
  if (!timeoutPassed()) return false;

  lastSentNotification = Date.now();

  return true;
}

/**
 * Wrapper for the AudioHelper.play() method to stop the previous sound if it exists.
 *
 * @param {object} data        An object configuring the audio data to play. See AudioHelper.play for details.
 * @param {string} data.src    The audio source file path, either a public URL or a local path relative to the public directory.
 * @param {boolean|object} [socketOptions=false]  Socket emit options passed straight through to AudioHelper.play.
 * @returns {Promise<Sound|void>}  A Promise that resolves to a Sound instance, or nothing if autoplay is false.
 */
export async function playSoundWithReplacement(data, socketOptions=false) {
  // Stop the previous sound if it exists (stop() is idempotent and checks .playing internally)
  try {
    await currentPlayingSound?.stop();
  } catch (error) {
    console.warn("Error stopping previous sound:", error);
  }

  // Play the new sound and store the reference
  // AudioHelper.play() returns a Sound or void (if autoplay is false)
  const sound = await foundry.audio.AudioHelper.play(data, socketOptions);
  // Only store the sound if it was actually created (not undefined)
  if (sound) {
    currentPlayingSound = sound;
  }
}
