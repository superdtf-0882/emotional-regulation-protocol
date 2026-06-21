'use strict';

module.exports = async function handler(req, res) {
  const blobKeys = Object.keys(process.env).filter(k => k.includes('BLOB') || k.includes('VERCEL_OIDC'));

  // Test list
  let blobListResult = null;
  let blobListError = null;
  try {
    const { list } = await import('@vercel/blob');
    const page = await list({ prefix: 'responses/', limit: 5 });
    blobListResult = { blobCount: page.blobs.length, hasMore: page.hasMore };
  } catch (err) {
    blobListError = err.message;
  }

  // Test write
  let blobWriteResult = null;
  let blobWriteError = null;
  try {
    const { put, del } = await import('@vercel/blob');
    const testPayload = JSON.stringify({ test: true, ts: new Date().toISOString() });
    const blob = await put('responses/debug-test.json', testPayload, {
      access: 'public',
      contentType: 'application/json',
    });
    blobWriteResult = { url: blob.url };
    await del(blob.url);
  } catch (err) {
    blobWriteError = err.message;
  }

  // Test feedback body parsing
  let bodyParseResult = req.body ? typeof req.body : 'no body';

  res.status(200).json({
    blobKeys,
    hasBlobReadWriteToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    blobListResult,
    blobListError,
    blobWriteResult,
    blobWriteError,
    bodyParseResult,
  });
};
