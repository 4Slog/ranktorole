export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // Verify user
  const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
  const { id: user_id } = await userResp.json();

  const { title, branch, mos, resume_type, content } = req.body;

  const insertResp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/resumes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ user_id, title, branch, mos, resume_type, content })
  });

  const data = await insertResp.json();
  res.status(insertResp.status).json(data);
}
