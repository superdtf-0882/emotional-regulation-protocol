'use strict';

const VALID_TIERS = ['standard', 'upgraded'];
const VALID_SOURCES = ['qwantz', 'xkcd'];
const VALID_RESPONSES = ['yes', 'no', 'upgrade_requested'];

/**
 * Throws a RangeError (caller maps that to HTTP 400) on anything
 * malformed. Returns a clean, whitelisted record on success — never
 * passes arbitrary client-supplied fields through to storage.
 */
function validateFeedback(body) {
  const { sessionId, tier, emotions, comicSource, comicId, response } = body || {};

  if (typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 100) {
    throw new RangeError('sessionId must be a string between 8 and 100 characters.');
  }
  if (!VALID_TIERS.includes(tier)) {
    throw new RangeError(`tier must be one of: ${VALID_TIERS.join(', ')}`);
  }
  if (!Array.isArray(emotions) || emotions.length < 1 || emotions.length > 3) {
    throw new RangeError('emotions must be an array of 1 to 3 strings.');
  }
  if (!emotions.every((e) => typeof e === 'string' && e.length > 0 && e.length <= 60)) {
    throw new RangeError('each emotion must be a non-empty string up to 60 characters.');
  }
  if (!VALID_SOURCES.includes(comicSource)) {
    throw new RangeError(`comicSource must be one of: ${VALID_SOURCES.join(', ')}`);
  }
  if (!Number.isInteger(comicId) || comicId < 1) {
    throw new RangeError('comicId must be a positive integer.');
  }
  if (!VALID_RESPONSES.includes(response)) {
    throw new RangeError(`response must be one of: ${VALID_RESPONSES.join(', ')}`);
  }

  return { sessionId, tier, emotions, comicSource, comicId, response };
}

module.exports = { validateFeedback, VALID_TIERS, VALID_SOURCES, VALID_RESPONSES };
