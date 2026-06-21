'use strict';

const crypto = require('crypto');

/**
 * Persists user feedback as one blob per response, keyed by timestamp +
 * a short random suffix. Each write is independent — no shared file gets
 * read, modified, and rewritten — so there's no race condition even if
 * two people submit at the same instant.
 *
 * Local dev has no Blob token by default, so writes fall back to a local
 * NDJSON file under local-data/ (gitignored). To test real Blob writes
 * locally, run `vercel dev` instead (it injects the token automatically).
 */

const BLOB_PATH_PREFIX = 'responses';
let blobModule = null;

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN || process.env.BLOB_STORE_ID);
}

async function loadBlobModule() {
  if (!blobModule) {
    blobModule = await import('@vercel/blob');
  }
  return blobModule;
}

function buildPathname(record) {
  const ts = record.recordedAt.replace(/[:.]/g, '-');
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${BLOB_PATH_PREFIX}/${ts}-${suffix}.json`;
}

async function writeToBlob(record) {
  const { put } = await loadBlobModule();
  const pathname = buildPathname(record);
  await put(pathname, JSON.stringify(record, null, 2), {
    access: 'private',
    contentType: 'application/json',
  });
}

async function writeToLocalFile(record) {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'local-data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'responses.ndjson');
  fs.appendFileSync(file, JSON.stringify(record) + '\n');
  console.warn(
    '[store] BLOB_READ_WRITE_TOKEN not set — wrote feedback to local-data/responses.ndjson instead. ' +
    'This is fine for local testing but will NOT persist on Vercel. See README for production setup.'
  );
}

async function writeFeedback(record) {
  const withTimestamp = { ...record, recordedAt: new Date().toISOString() };
  if (hasBlobToken()) {
    await writeToBlob(withTimestamp);
  } else {
    await writeToLocalFile(withTimestamp);
  }
  return withTimestamp;
}

module.exports = { writeFeedback };
