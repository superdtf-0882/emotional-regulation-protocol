'use strict';

const BLOB_PATH_PREFIX = 'responses';
let blobModule = null;

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN || process.env.BLOB_STORE_ID);
}

async function loadBlobModule() {
  if (!blobModule) blobModule = await import('@vercel/blob');
  return blobModule;
}

async function readAllFromBlob() {
  const { list, download } = await loadBlobModule();
  const records = [];
  let cursor;
  do {
    const page = await list({ prefix: BLOB_PATH_PREFIX + '/', cursor, limit: 1000 });
    for (const blob of page.blobs) {
      try {
        const res = await download(blob.url);
        if (res.ok) records.push(await res.json());
      } catch { /* skip unreadable blobs */ }
    }
    cursor = page.cursor;
  } while (cursor);
  return records;
}

async function readAllFromLocalFile() {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '..', 'local-data', 'responses.ndjson');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

async function readAllFeedback() {
  return hasBlobToken() ? readAllFromBlob() : readAllFromLocalFile();
}

module.exports = { readAllFeedback };
