export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
  const { id: user_id } = await userResp.json();

  const { id, title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const updateResp = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/resumes?id=eq.${id}&user_id=eq.${user_id}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    }
  );

  res.status(updateResp.ok ? 200 : updateResp.status).end();
}
