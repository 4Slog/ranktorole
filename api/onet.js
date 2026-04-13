export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { keyword } = req.query;
  const auth = Buffer.from(process.env.ONET_KEY + ':developer').toString('base64');

  const resp = await fetch(
    `https://services.onetcenter.org/ws/mnm/search?keyword=${encodeURIComponent(keyword)}&client=ranktorole`,
    { headers: { 'Authorization': 'Basic ' + auth } }
  );

  const data = await resp.json();
  res.status(resp.status).json(data);
}
