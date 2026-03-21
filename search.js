export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query manquante' });

    const prompt = `Recherche les informations football suivantes : "${query}"

Réponds en JSON valide uniquement, sans markdown. Format selon le type de données :

Pour un classement :
{"type":"standings","league":"nom","teams":[{"rank":1,"name":"Équipe","played":0,"wins":0,"draws":0,"losses":0,"gf":0,"ga":0,"gd":0,"points":0,"form":"WWDLW"}]}

Pour des buteurs :
{"type":"topscorers","league":"nom","players":[{"rank":1,"name":"Joueur","team":"Équipe","goals":0,"apps":0,"xG":null}]}

Pour une composition :
{"type":"lineup","team":"Équipe","formation":"4-3-3","players":[{"name":"Joueur","position":"ATT|MID|DEF|GK","starting":true}]}

Si tu ne trouves pas d'informations fiables récentes, réponds :
{"type":"not_found","message":"Données non trouvées — merci d'uploader un screenshot"}

Sois précis et utilise uniquement des données que tu connais avec certitude.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    let raw = data.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Réponse non parseable' });

    const parsed = JSON.parse(match[0]);

    if (parsed.type === 'not_found') {
      return res.status(200).json({ error: parsed.message, data: null });
    }

    return res.status(200).json({
      data: parsed,
      source: 'Claude AI (données d\'entraînement — à vérifier)',
      warning: 'Ces données proviennent de la base de connaissance IA et peuvent être obsolètes. Confirme avec un screenshot récent.'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
