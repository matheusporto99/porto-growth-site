// Pesquisa de palavras-chave pelo autocomplete do Google (o que as pessoas realmente digitam).
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function sugestoes(termo) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=br&q=${encodeURIComponent(termo)}`;
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const buf = Buffer.from(await r.arrayBuffer());
    const tipo = r.headers.get('content-type') || '';
    const texto = new TextDecoder(/iso-8859-1/i.test(tipo) ? 'latin1' : 'utf-8').decode(buf);
    const json = JSON.parse(texto);
    return Array.isArray(json[1]) ? json[1] : [];
  } catch {
    return [];
  }
}

export async function pesquisarBuscas(cfg) {
  const termos = [];
  for (const s of cfg.sementes) {
    termos.push(s);
    for (const m of cfg.modificadores || []) termos.push(`${m} ${s}`);
  }
  const achados = new Map();
  for (const t of termos) {
    for (const s of await sugestoes(t)) {
      const k = s.toLowerCase().trim();
      achados.set(k, (achados.get(k) || 0) + 1);
    }
    await espera(250);
  }
  // as que aparecem para mais de uma busca vêm primeiro
  return [...achados.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 150);
}
