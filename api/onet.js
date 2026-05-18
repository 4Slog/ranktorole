export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { keyword } = req.query;
  if (!keyword) return res.status(400).json({ error: 'keyword is required' });

  const user = process.env.ONET_USER;
  const pass = process.env.ONET_PASS;
  if (!user || !pass) {
    console.error('O*NET credentials missing: ONET_USER or ONET_PASS not set');
    return res.status(500).json({ error: 'O*NET credentials not configured' });
  }

  const auth = Buffer.from(user + ':' + pass).toString('base64');

  let resp;
  try {
    resp = await fetch(
      `https://services.onetcenter.org/ws/mnm/search?keyword=${encodeURIComponent(keyword)}&client=veterantransition`,
      {
        headers: {
          'Authorization': 'Basic ' + auth,
          'Accept': 'application/json'
        }
      }
    );
  } catch (e) {
    console.error('O*NET fetch error:', e.message);
    return res.status(502).json({ error: 'Failed to reach O*NET service' });
  }

  const text = await resp.text();
  try {
    const data = JSON.parse(text);
    return res.status(resp.status).json(data);
  } catch (e) {
    console.error('O*NET non-JSON response (HTTP ' + resp.status + '):', text.slice(0, 200));
    return res.status(502).json({ error: 'O*NET returned unexpected response', status: resp.status });
  }
}
