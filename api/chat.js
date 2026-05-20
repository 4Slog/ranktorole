export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');

  // If a token is provided, verify it and apply per-user rate limiting.
  // If no token (preview mode / unauthenticated), allow through — Anthropic
  // API key is the backstop and per-user limits don't apply.
  if (token) {
    const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const { id: user_id } = await userResp.json();

    // Rate limiting — 50 generations per user per month
    const MONTHLY_LIMIT = 50;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    try {
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

      const counterUrl = `${process.env.SUPABASE_URL}/rest/v1/usage_counters`;
      const counterHeaders = {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json'
      };
      if (usage[0]) {
        await fetch(`${counterUrl}?user_id=eq.${user_id}&month=eq.${monthKey}`, {
          method: 'PATCH', headers: counterHeaders,
          body: JSON.stringify({ count: currentCount + 1 })
        });
      } else {
        await fetch(counterUrl, {
          method: 'POST', headers: counterHeaders,
          body: JSON.stringify({ user_id, month: monthKey, count: 1 })
        });
      }
    } catch(e) {
      console.error('Rate limit check failed:', e.message);
    }
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
