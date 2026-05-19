export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // Verify user token
  const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
  const { id: user_id } = await userResp.json();

  // Rate limiting — 50 generations per user per month
  const MONTHLY_LIMIT = 50;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; // e.g. "2026-05"

  try {
    // Upsert usage record and get current count
    const usageResp = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/usage_counters?user_id=eq.${user_id}&month=eq.${monthKey}`,
      { headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      }}
    );
    const usage = await usageResp.json();
    const currentCount = usage[0]?.count || 0;

    if (currentCount >= MONTHLY_LIMIT) {
      return res.status(429).json({
        error: `Monthly generation limit reached (${MONTHLY_LIMIT}/month). Resets on the 1st.`
      });
    }

    // Increment counter
    if (usage[0]) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/usage_counters?user_id=eq.${user_id}&month=eq.${monthKey}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ count: currentCount + 1 })
      });
    } else {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/usage_counters`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id, month: monthKey, count: 1 })
      });
    }
  } catch(e) {
    // If rate limit check fails, allow through rather than blocking legitimate users
    console.error('Rate limit check failed:', e.message);
  }

  // Forward to Claude API
  const { model, max_tokens, messages } = req.body;
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model, max_tokens, messages })
  });

  const data = await resp.json();
  res.status(resp.status).json(data);
}
