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
 * Ensures only one sound plays at a time by stopping any currently playing sound before
 * starting a new one.
 *
 * @param {foundry.audio.SoundCreationOptions} data - An object configuring the audio data to play.
 * @param {string} data.src - The audio source file path, either a public URL or a local path relative to the public directory.
 * @param {number} [data.volume] - The volume level (0.0 to 1.0).
 * @param {boolean} [data.autoplay] - Whether to autoplay the sound.
 * @param {boolean|string[]|object} [socketOptions=false] - Socket emit options passed straight through to AudioHelper.play.
 *   If true, plays for all users. If an array of user IDs, plays for those users only.
 * @returns {Promise<foundry.audio.Sound|void>} A Promise that resolves to a Sound instance, or nothing if autoplay is false.
 * @see {@link https://foundryvtt.com/api/classes/foundry.audio.AudioHelper.html AudioHelper}
 * @see {@link https://foundryvtt.com/api/interfaces/foundry.audio.SoundCreationOptions.html SoundCreationOptions}
 * @see {@link https://foundryvtt.com/api/classes/foundry.audio.Sound.html Sound}
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
