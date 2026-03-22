export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { matchData } = req.body;
    if (!matchData) return res.status(400).json({ error: 'Donnees manquantes' });

    const d = matchData;
    const b = d.bets || {};

    const prompt = `Tu es un tipster professionnel expert en statistiques football xG.
Voici les donnees completes d un match. Analyse et donne une decision COHERENTE avec ces chiffres.

=== DONNEES MATCH ===
Equipe DOM : ${d.ht} | xG/match : ${d.adjXgH || d.hxg || '?'} | xGA/match : ${d.hxga || '?'} | Realisation : ${d.hr ? Math.round(d.hr)+'%' : '?'}
Equipe EXT : ${d.at} | xG/match : ${d.adjXgA || d.axg || '?'} | xGA/match : ${d.axga || '?'} | Realisation : ${d.ar ? Math.round(d.ar)+'%' : '?'}

=== PROBABILITES CALCULEES (Poisson + xG) ===
${d.ht} WIN : ${b.hw ? b.hw.pct : '?'}%
NUL : ${b.draw ? b.draw.pct : '?'}%
${d.at} WIN : ${b.aw ? b.aw.pct : '?'}%
OVER 2.5 : ${b.over ? b.over.pct : '?'}%
OVER 3.5 : ${b.over35pct || '?'}%
BTTS : ${b.btts ? b.btts.pct : '?'}%

=== SIGNAL QUALITE ===
Signal : ${b.signal || 'NON CALCULE'}
Qualite match : ${b.qualityOk ? 'OK' : 'FAIBLE'}
xG/match ajuste : DOM ${b.attackH ? b.attackH.toFixed(2) : '?'} | EXT ${b.attackA ? b.attackA.toFixed(2) : '?'}

=== EDGES (si cotes entrees) ===
${b.hw && b.hw.r ? d.ht+' WIN : '+b.hw.r : ''}
${b.draw && b.draw.r ? 'NUL : '+b.draw.r : ''}
${b.aw && b.aw.r ? d.at+' WIN : '+b.aw.r : ''}
${b.over && b.over.r ? 'OVER 2.5 : '+b.over.r : ''}
${b.btts && b.btts.r ? 'BTTS : '+b.btts.r : ''}

=== VALUE BETS DETECTEES ===
${b.values && b.values.length ? b.values.map(v => v.label+' edge +'+v.val.edge+'%').join(', ') : 'Aucune (pas de cotes entrees)'}

=== SCORES PROBABLES ===
${b.exactScores ? b.exactScores.map(s => s.score+' ('+s.pct+'%)').join(' | ') : ''}

=== CLASSEMENT (si disponible) ===
${d.hstand ? d.ht+' : '+d.hstand.rank+'e - '+d.hstand.points+'pts' : ''}
${d.astand ? d.at+' : '+d.astand.rank+'e - '+d.astand.points+'pts' : ''}

IMPORTANT : Ton analyse doit etre COHERENTE avec les probabilites ci-dessus.
Si DOM=38% et EXT=37%, ne dis pas que DOM est largement favori.
Si une value bet est detectee avec edge > 10%, mets-la en avant.
Si le signal est "NO BET", dis-le clairement.

Reponds UNIQUEMENT avec ce format exact (remplace les crochets) :
Analyse : [2-3 phrases sur dynamique des equipes ET coherentes avec les probas ci-dessus]
Value Bet : [pari le plus logique selon les probas ET edges, ou NON si aucun signal]
Confiance : [X/10 coherent avec les probas - si 38% vs 37% max 5/10]
A eviter : [pari contre-indique selon les stats]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content.map(b => b.text || '').join('').trim();
    return res.status(200).json({ analysis: text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
