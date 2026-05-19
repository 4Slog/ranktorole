export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const checks = { anthropic: false, supabase: false, onet: false };

  await Promise.allSettled([
    // Anthropic — models list endpoint, cheap HEAD-equivalent
    fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
    }).then(r => { if (r.ok || r.status === 401) checks.anthropic = true; }),

    // Supabase — REST health endpoint
    fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: { 'apikey': process.env.SUPABASE_ANON_KEY }
    }).then(r => { if (r.status < 500) checks.supabase = true; }),

    // O*NET — keyword search with a minimal query
    fetch('https://services.onetcenter.org/ws/mnm/search?keyword=veteran', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${process.env.ONET_USER}:${process.env.ONET_PASS}`).toString('base64')
      }
    }).then(r => { if (r.status < 500) checks.onet = true; })
  ]);

  const allOk = Object.values(checks).every(Boolean);
  res.status(200).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0',
    checks
  });
}
