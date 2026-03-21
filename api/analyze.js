export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, mediaType, hint } = req.body;
    if (!image) return res.status(400).json({ error: 'Image manquante' });

    const prompts = {
      standings: `Analyse ce screenshot de classement de football. Extrais TOUTES les équipes visibles.
RÉPONDS EN JSON VALIDE uniquement :
{
  "type": "standings",
  "league": "nom du championnat ou null",
  "season": "saison ou null",
  "teams": [
    {"rank": 1, "name": "Équipe", "played": 0, "wins": 0, "draws": 0, "losses": 0, "gf": 0, "ga": 0, "gd": 0, "points": 0, "form": "WWDLW"}
  ]
}`,

      topscorers: `Analyse ce screenshot de top buteurs/classement de buteurs. Extrais TOUS les joueurs visibles.
RÉPONDS EN JSON VALIDE uniquement :
{
  "type": "topscorers",
  "league": "nom championnat ou null",
  "players": [
    {"rank": 1, "name": "Nom Joueur", "team": "Équipe", "goals": 0, "assists": 0, "apps": 0, "xG": null, "penalties": 0}
  ]
}`,

      'lineup-home': `Analyse ce screenshot de composition d'équipe. Extrais tous les joueurs.
RÉPONDS EN JSON VALIDE uniquement :
{
  "type": "lineup",
  "team": "nom équipe",
  "formation": "4-3-3",
  "players": [
    {"name": "Nom Joueur", "number": 0, "position": "GK|DEF|MID|ATT", "starting": true}
  ]
}`,

      'lineup-away': `Analyse ce screenshot de composition d'équipe. Extrais tous les joueurs.
RÉPONDS EN JSON VALIDE uniquement :
{
  "type": "lineup",
  "team": "nom équipe",
  "formation": "4-3-3",
  "players": [
    {"name": "Nom Joueur", "number": 0, "position": "GK|DEF|MID|ATT", "starting": true}
  ]
}`,

      h2h: `Analyse ce screenshot de confrontations directes (H2H) entre deux équipes. Extrais tous les matchs visibles.
RÉPONDS EN JSON VALIDE uniquement :
{
  "type": "h2h",
  "team1": "Équipe 1",
  "team2": "Équipe 2",
  "matches": [
    {"date": "2024-01-15", "home": "Équipe", "away": "Équipe", "homeGoals": 0, "awayGoals": 0}
  ]
}`,

      understat: `Tu es expert xG football. Analyse ce screenshot Understat.
Types possibles : page équipe (tableau xG par situation), page match (xG dom vs ext), page joueurs.
Pour page équipe : ADDITIONNE toutes les lignes xG.
RÉPONDS EN JSON VALIDE uniquement :
{
  "page_type": "team_season|match|players",
  "team_name": null,
  "home_team": null, "away_team": null,
  "home_score": null, "away_score": null,
  "home_xG": null, "away_xG": null,
  "home_xGA": null, "away_xGA": null,
  "team_xG_total": null, "team_xGA_total": null, "team_goals_total": null,
  "home_realization": null, "away_realization": null,
  "home_status": null, "away_status": null,
  "total_xG": null,
  "top_scorers": [{"name":"","goals":0,"xG":0.00,"apps":0,"score_probability":0}],
  "bets": {
    "over":     {"confidence":"haute|moyenne|faible","reason":""},
    "btts":     {"confidence":"haute|moyenne|faible","reason":""},
    "home_win": {"confidence":"haute|moyenne|faible","reason":""},
    "away_win": {"confidence":"haute|moyenne|faible","reason":""}
  },
  "analysis": "3-4 phrases en français",
  "value_bet": "",
  "data_confidence": "haute|moyenne|faible"
}`
    };

    const prompt = prompts[hint] || prompts.understat;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: image } },
          { type: 'text', text: prompt }
        ]}]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    let raw = data.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Réponse non parseable' });

    const parsed = JSON.parse(match[0]);

    // Map team_season totals for understat
    if (parsed.page_type === 'team_season' && parsed.team_xG_total != null && parsed.home_xG == null) {
      parsed.home_xG  = parsed.team_xG_total;
      parsed.home_xGA = parsed.team_xGA_total;
      parsed.home_score = parsed.team_goals_total;
      if (parsed.team_goals_total != null && parsed.team_xG_total > 0) {
        const real = parseFloat(((parsed.team_goals_total / parsed.team_xG_total) * 100).toFixed(1));
        parsed.home_realization = real;
        parsed.home_status = real > 110 ? 'surperformance' : real < 90 ? 'sous-performance' : 'normal';
      }
    }

    parsed._source = 'ai';
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
