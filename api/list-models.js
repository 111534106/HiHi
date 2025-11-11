// Simple endpoint: list available Generative Language models using GEMINI_API_KEY
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set.' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'List models request failed', details: data });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Error listing models:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
