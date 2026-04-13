export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { keyword, location } = req.query;
  const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(keyword)}&LocationName=${encodeURIComponent(location || '')}&ResultsPerPage=6&SortField=OpenDate&SortDirection=Desc`;

  const resp = await fetch(url, {
    headers: {
      'Host': 'data.usajobs.gov',
      'User-Agent': process.env.USAJOBS_EMAIL,
      'Authorization-Key': process.env.USAJOBS_KEY
    }
  });

  const data = await resp.json();
  res.status(resp.status).json(data);
}
