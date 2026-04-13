export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY }
  });
  if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
  const { id: user_id } = await userResp.json();

  const listResp = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/resumes?user_id=eq.${user_id}&order=created_at.desc&select=id,title,branch,mos,resume_type,created_at,content`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    }
  );

  const data = await listResp.json();
  res.status(listResp.status).json(data);
}
