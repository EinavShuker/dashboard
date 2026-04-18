// api/data.js
//
// Vercel serverless function that serves the Leo dashboard's data.
// The frontend (leo_dashboard.html) calls fetch('/api/data') once on
// page load, and this function returns the full Airtable table as
// { records: [ { id, fields: {...} }, ... ] }.
//
// Required environment variables (set in Vercel → Project → Settings → Environment Variables):
//   AIRTABLE_API_KEY   — personal access token with data.records:read on the base
//   AIRTABLE_BASE_ID   — Airtable base ID (starts with "app...")
//
// The table name is hardcoded below; change it here if it ever moves.

const TABLE_NAME = 'Final_Account_Level_Analysis';

export default async function handler(req, res) {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return res.status(500).json({
      error: 'Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID environment variable',
    });
  }

  try {
    const records = [];
    let offset;

    // Paginate through Airtable (100 rows per page is the API max).
    do {
      const params = new URLSearchParams({ pageSize: '100' });
      if (offset) params.set('offset', offset);

      const url =
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/` +
        `${encodeURIComponent(TABLE_NAME)}?${params.toString()}`;

      const upstream = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      });

      if (!upstream.ok) {
        const detail = await upstream.text();
        return res.status(upstream.status).json({
          error: `Airtable returned ${upstream.status}`,
          detail,
        });
      }

      const page = await upstream.json();
      if (Array.isArray(page.records)) records.push(...page.records);
      offset = page.offset;
    } while (offset);

    // Cache on the edge for 60s; allow stale responses up to 5 min while revalidating.
    res.setHeader(
      'Cache-Control',
      's-maxage=60, stale-while-revalidate=300'
    );
    return res.status(200).json({ records });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch Airtable data',
      detail: String(err && err.message ? err.message : err),
    });
  }
}
