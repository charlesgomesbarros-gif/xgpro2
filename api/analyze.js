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
      standings: `Analyse ce screenshot de classement football. Extrais TOUTES les equipes visibles.
REPONDS EN JSON VALIDE uniquement, sans texte avant ou apres :
{
  "type": "standings",
  "league": "nom du championnat ou null",
  "season": "saison ou null",
  "teams": [
    {"rank": 1, "name": "Equipe", "played": 0, "wins": 0, "draws": 0, "losses": 0, "gf": 0, "ga": 0, "gd": 0, "points": 0, "form": "WWDLW"}
  ]
}`,

      topscorers: `Analyse ce screenshot de top buteurs. Extrais TOUS les joueurs visibles.
REPONDS EN JSON VALIDE uniquement, sans texte avant ou apres :
{
  "type": "topscorers",
  "league": "nom championnat ou null",
  "players": [
    {"rank": 1, "name": "Nom Joueur", "team": "Equipe", "goals": 0, "assists": 0, "apps": 0, "xG": null, "penalties": 0}
  ]
}`,

      "lineup-home": `Analyse ce screenshot de composition equipe. Extrais tous les joueurs.
REPONDS EN JSON VALIDE uniquement :
{
  "type": "lineup",
  "team": "nom equipe",
  "formation": "4-3-3",
  "players": [
    {"name": "Nom Joueur", "number": 0, "position": "GK|DEF|MID|ATT", "starting": true}
  ]
}`,

      "lineup-away": `Analyse ce screenshot de composition equipe. Extrais tous les joueurs.
REPONDS EN JSON VALIDE uniquement :
{
  "type": "lineup",
  "team": "nom equipe",
  "formation": "4-3-3",
  "players": [
    {"name": "Nom Joueur", "number": 0, "position": "GK|DEF|MID|ATT", "starting": true}
  ]
}`,

      "lastgames-home": `Analyse ce screenshot des derniers matchs d une equipe (Last games Understat).
Extrais les 5 derniers matchs avec xG et xGA de chaque match.
REPONDS EN JSON VALIDE uniquement :
{
  "type": "lastgames",
  "team": "nom equipe",
  "matches": [
    {"date": "2025-01-15", "opponent": "Equipe", "home": true, "xG": 1.8, "xGA": 1.2, "goals": 2, "goalsAgainst": 1, "result": "W"}
  ]
}`,

      "lastgames-away": `Analyse ce screenshot des derniers matchs d une equipe (Last games Understat).
Extrais les 5 derniers matchs avec xG et xGA de chaque match.
REPONDS EN JSON VALIDE uniquement :
{
  "type": "lastgames",
  "team": "nom equipe",
  "matches": [
    {"date": "2025-01-15", "opponent": "Equipe", "home": false, "xG": 1.3, "xGA": 1.6, "goals": 1, "goalsAgainst": 2, "result": "L"}
  ]
}`,

      h2h: `Analyse ce screenshot de confrontations directes H2H. Extrais tous les matchs visibles.
REPONDS EN JSON VALIDE uniquement :
{
  "type": "h2h",
  "team1": "Equipe 1",
  "team2": "Equipe 2",
  "matches": [
    {"date": "2024-01-15", "home": "Equipe", "away": "Equipe", "homeGoals": 0, "awayGoals": 0}
  ]
}`,

      understat: `Tu es expert xG football. Analyse ce screenshot Understat.

TYPES DE PAGES POSSIBLES :
- Page equipe (tableau par situation: Open play, Corner, Set piece...) : ADDITIONNE toutes les lignes xG et GA
- Page match : xG domicile vs exterieur
- Page joueurs : liste avec stats individuelles

POUR LES JOUEURS : extrais imperativement xG90 (colonne xG90 du tableau Understat).
xG90 = expected goals par 90 minutes. C'est la stat cle pour les probabilites de marquer.

REPONDS EN JSON VALIDE uniquement, sans texte avant ou apres :
{
  "page_type": "team_season|match|players",
  "team_name": null,
  "home_team": null,
  "away_team": null,
  "home_score": null,
  "away_score": null,
  "home_xG": null,
  "away_xG": null,
  "home_xGA": null,
  "away_xGA": null,
  "team_xG_total": null,
  "team_xGA_total": null,
  "team_goals_total": null,
  "team_goals_against_total": null,
  "home_realization": null,
  "away_realization": null,
  "home_status": null,
  "away_status": null,
  "total_xG": null,
  "top_scorers": [
    {"name": "", "goals": 0, "xG": 0.00, "xG90": 0.00, "xA90": 0.00, "apps": 0, "minutes": 0, "position": "", "score_probability": 0}
  ],
  "bets": {
    "over": {"confidence": "haute|moyenne|faible", "reason": ""},
    "btts": {"confidence": "haute|moyenne|faible", "reason": ""},
    "home_win": {"confidence": "haute|moyenne|faible", "reason": ""},
    "away_win": {"confidence": "haute|moyenne|faible", "reason": ""}
  },
  "analysis": "3-4 phrases en francais sur la forme, forces/faiblesses offensives et defensives",
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
    const matchJson = raw.match(/\{[\s\S]*\}/);
    if (!matchJson) return res.status(500).json({ error: 'Reponse non parseable' });

    const parsed = JSON.parse(matchJson[0]);

    // Map team_season totals
    if (parsed.page_type === 'team_season' && parsed.team_xG_total != null && parsed.home_xG == null) {
      parsed.home_xG   = parsed.team_xG_total;
      parsed.home_xGA  = parsed.team_xGA_total;
      parsed.home_score = parsed.team_goals_total;
      if (parsed.team_goals_total != null && parsed.team_xG_total > 0) {
        const real = parseFloat(((parsed.team_goals_total / parsed.team_xG_total) * 100).toFixed(1));
        parsed.home_realization = real;
        parsed.home_status = real > 110 ? 'surperformance' : real < 90 ? 'sous-performance' : 'normal';
      }
    }

    // Calculate score_probability from xG90 for each scorer
    if (parsed.top_scorers && parsed.top_scorers.length) {
      parsed.top_scorers = parsed.top_scorers.map(function(s) {
        if (!s.score_probability || s.score_probability === 0) {
          const xg90 = s.xG90 ? parseFloat(s.xG90) : (s.xG && s.apps ? parseFloat(s.xG) / s.apps : 0);
          s.score_probability = Math.min(Math.round(xg90 * 100), 75);
        }
        return s;
      });
    }

    parsed._source = 'ai';
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
