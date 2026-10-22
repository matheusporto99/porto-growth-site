// Gera as páginas do blog, sitemap.xml, robots.txt e llms.txt
// a partir dos artigos salvos em seo/artigos/*.json.
import fs from 'node:fs';
import path from 'node:path';

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export const dataBR = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

export const contarPalavras = (html) =>
  html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

// ---------- Limpeza do HTML que vem da IA ----------
const PERMITIDAS = new Set(['h2','h3','p','ul','ol','li','strong','em','a','blockquote','table','thead','tbody','tr','th','td','br']);
const ENTIDADE = /^&(#\d+|#x[0-9a-f]+|[a-z]+);/i;

export function limparHtml(html, linksValidos = new Set()) {
  const avisos = [];
  // remove blocos perigosos por inteiro (com conteúdo)
  html = String(html).replace(/<(script|style|iframe|object|embed|form|svg|noscript)\b[\s\S]*?<\/\1\s*>/gi, '');
  const partes = html.split(/(<[^>]*>)/);
  const pilhaA = [];
  let out = '';
  for (const p of partes) {
    if (!p) continue;
    if (p.startsWith('<')) {
      const m = p.match(/^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>$/i);
      if (!m) continue;
      const fecha = !!m[1];
      const tag = m[2].toLowerCase();
      if (tag === 'h1') { out += fecha ? '</h2>' : '<h2>'; avisos.push('h1 no corpo virou h2'); continue; }
      if (!PERMITIDAS.has(tag)) continue;
      if (tag === 'br') { out += '<br>'; continue; }
      if (tag !== 'a') { out += fecha ? `</${tag}>` : `<${tag}>`; continue; }
      if (fecha) { out += pilhaA.pop() ? '</a>' : ''; continue; }
      const href = (m[3].match(/href\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
      const interno = href.startsWith('/');
      const externoOk = /^https:\/\//i.test(href);
      if (interno) {
        const alvo = href.split('#')[0].split('?')[0];
        if (alvo === '/' || alvo === '/blog/' || linksValidos.has(alvo)) {
          out += `<a href="${esc(href)}">`; pilhaA.push(true);
        } else { avisos.push(`link interno inexistente removido: ${href}`); pilhaA.push(false); }
      } else if (externoOk) {
        out += `<a href="${esc(href)}" target="_blank" rel="noopener">`; pilhaA.push(true);
      } else { pilhaA.push(false); }
    } else {
      // texto: escapa < e >, preserva entidades já válidas
      let t = '';
      for (let i = 0; i < p.length; i++) {
        const c = p[i];
        if (c === '<') t += '&lt;';
        else if (c === '>') t += '&gt;';
        else if (c === '&') t += ENTIDADE.test(p.slice(i)) ? '&' : '&amp;';
        else t += c;
      }
      out += t;
    }
  }
  return { html: out.trim(), avisos };
}

// ---------- Estilo compartilhado ----------
const FONTES = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

const ICONES = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#2E0623">`;

const CSS = `<style>
:root{--aub:#450A34;--aub-d:#2E0623;--coral:#FF6F45;--coral-d:#B8472A;--graph:#2B2B2B;--mist:#EFEFEF;--bg:#FAF7F5;--mute:#E3D3DC;--line:#E7DCE2;--serif:'Instrument Serif',Georgia,serif}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--graph);-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}
.eyebrow{font-size:13px;letter-spacing:.16em;font-weight:600;text-transform:uppercase;color:var(--coral-d)}
h1,h2,h3{margin:0}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 32px;border-radius:10px;border:0;font:inherit;font-size:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:transform .15s,background .15s;text-align:center}
.btn:hover{transform:translateY(-1px)}
.btn-coral{background:var(--coral);color:var(--aub-d)}
.btn-coral:hover{background:#FF8A66}
.bar{background:var(--aub-d);color:#fff}
.bar .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-top:22px;padding-bottom:22px}
.bar img{height:34px;width:auto}
.bar nav{display:flex;align-items:center;gap:22px;font-size:14px}
.bar nav a{text-decoration:none;color:#EDE3E9}
.bar .ghost{padding:11px 20px;border:1px solid rgba(255,255,255,.35);border-radius:999px;color:#fff;font-weight:500;min-height:44px;display:inline-flex;align-items:center}
.crumbs{font-size:13px;color:#7a6b74;padding:28px 0 0}
.crumbs a{text-decoration:none;color:#7a6b74}
.crumbs a:hover{color:var(--coral-d)}
.art{max-width:720px;margin:0 auto;padding:0 24px}
.art header{padding:28px 0 36px;border-bottom:1px solid var(--line);margin-bottom:40px}
.art h1{font-family:var(--serif);font-weight:400;letter-spacing:-.01em;font-size:clamp(38px,6vw,56px);line-height:1.06;color:var(--aub-d);margin:14px 0 18px}
.art .lead{font-size:20px;line-height:1.6;color:#3a3a3a}
.art .meta{font-size:14px;color:#7a6b74;margin-top:20px}
.corpo{font-size:18px;line-height:1.75}
.corpo p{margin:0 0 22px}
.corpo h2{font-family:var(--serif);font-weight:400;font-size:clamp(30px,4vw,38px);line-height:1.12;color:var(--aub-d);margin:52px 0 18px}
.corpo h3{font-size:20px;font-weight:700;color:var(--aub-d);margin:34px 0 12px}
.corpo ul,.corpo ol{margin:0 0 24px;padding-left:24px}
.corpo li{margin:0 0 10px}
.corpo strong{color:#1f1f1f}
.corpo a{color:var(--coral-d);text-underline-offset:3px}
.corpo blockquote{margin:30px 0;padding:6px 0 6px 22px;border-left:3px solid var(--coral);font-family:var(--serif);font-size:26px;line-height:1.3;color:var(--aub)}
.corpo blockquote p{margin:0}
.corpo table{width:100%;border-collapse:collapse;margin:0 0 28px;font-size:16px;display:block;overflow-x:auto}
.corpo th,.corpo td{border-bottom:1px solid var(--line);padding:12px 10px;text-align:left;vertical-align:top}
.corpo th{color:var(--aub-d);font-weight:700}
.faq{margin:56px 0 0}
.faq h2{font-family:var(--serif);font-weight:400;font-size:clamp(30px,4vw,38px);color:var(--aub-d);margin:0 0 18px}
.faq details{border-top:1px solid var(--line);padding:18px 0}
.faq details:last-child{border-bottom:1px solid var(--line)}
.faq summary{cursor:pointer;font-weight:600;font-size:18px;color:var(--aub-d);list-style:none;display:flex;justify-content:space-between;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';color:var(--coral-d);font-size:24px;line-height:1}
.faq details[open] summary::after{content:'−'}
.faq details p{margin:12px 0 0;font-size:17px;line-height:1.7}
.cta{margin:64px 0 0;background:var(--aub-d);color:#fff;border-radius:20px;padding:40px 32px;display:flex;flex-direction:column;gap:16px;align-items:flex-start}
.cta .eyebrow{color:var(--coral)}
.cta h2{font-family:var(--serif);font-weight:400;font-size:clamp(30px,4.4vw,40px);line-height:1.1}
.cta p{color:var(--mute);font-size:17px;line-height:1.6;margin:0}
.cta small{color:#C9B6C1;font-size:14px}
.rel{max-width:720px;margin:72px auto 0;padding:0 24px}
.rel h2{font-family:var(--serif);font-weight:400;font-size:32px;color:var(--aub-d);margin:0 0 8px}
.card{display:block;text-decoration:none;padding:24px 0;border-top:1px solid var(--line)}
.card:last-child{border-bottom:1px solid var(--line)}
.card h3{font-family:var(--serif);font-weight:400;font-size:28px;line-height:1.15;color:var(--aub-d);margin:6px 0 8px}
.card p{margin:0;color:#4a4a4a;font-size:16px;line-height:1.6}
.card .d{font-size:13px;color:#7a6b74}
.card:hover h3{color:var(--coral-d)}
.hub{max-width:820px;margin:0 auto;padding:0 24px}
.hub header{padding:48px 0 24px}
.hub h1{font-family:var(--serif);font-weight:400;font-size:clamp(40px,6vw,62px);line-height:1.04;color:var(--aub-d);margin:14px 0 16px}
.hub h1 em{color:var(--coral-d)}
.hub .lead{font-size:19px;line-height:1.6;color:#3a3a3a;max-width:640px}
.vazio{padding:32px 0;color:#7a6b74}
footer{background:var(--aub-d);color:#C9B6C1;padding:48px 0;font-size:14px;margin-top:96px}
footer .wrap{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
footer img{height:34px;width:auto}
footer .r{display:flex;flex-direction:column;gap:6px;text-align:right}
footer a{text-decoration:none}
@media(max-width:720px){
  .bar nav .so-desk{display:none}
  .corpo{font-size:17px}
  .cta{padding:32px 22px}
  .cta .btn{width:100%}
  footer .r{text-align:left}
}
</style>`;

const topo = (cfg, campanha = 'blog') => `<div class="bar"><div class="wrap">
  <a href="/" aria-label="${esc(cfg.site.nome)}"><img src="/logo-branco.png" alt="${esc(cfg.site.nome)}" width="160" height="34"></a>
  <nav><a href="/blog/" class="so-desk">Blog</a><a class="ghost" href="${esc(cfg.site.cta_link)}?utm_source=blog&amp;utm_medium=organico&amp;utm_campaign=${encodeURIComponent(campanha)}&amp;utm_content=botao-topo">Falar com especialista</a></nav>
</div></div>`;

const rodape = (cfg) => `<footer>
  <div class="wrap">
    <a href="/"><img src="/logo-branco.png" alt="${esc(cfg.site.nome)}" width="160" height="34"></a>
    <div class="r">
      <span>Porto Growth &amp; Performance LTDA · CNPJ 65.341.721/0001-00</span>
      <span><a href="/">portogrowth.com.br</a> · <a href="/blog/">Blog</a> · ${esc(cfg.site.cidade)}</span>
      <span>© ${new Date().getFullYear()} Todos os direitos reservados.</span>
    </div>
  </div>
</footer>`;

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// ---------- Página do artigo ----------
export function paginaArtigo(a, cfg, todos) {
  const base = cfg.site.url.replace(/\/$/, '');
  const url = `${base}/blog/${a.slug}/`;
  const palavras = contarPalavras(a.corpo_html);
  const minutos = Math.max(3, Math.round(palavras / 200));
  const ctaLink = `${cfg.site.cta_link}?utm_source=blog&utm_medium=organico&utm_campaign=${encodeURIComponent(a.slug)}&utm_content=caixa-final`;
  const relacionados = todos.filter((x) => x.slug !== a.slug).slice(0, 3);

  const schema = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: a.titulo, description: a.meta_descricao, inLanguage: 'pt-BR',
      datePublished: a.data_publicacao, dateModified: a.data_atualizacao || a.data_publicacao,
      mainEntityOfPage: url, url, image: cfg.site.logo, keywords: a.palavra_chave,
      wordCount: palavras,
      author: { '@type': 'Person', name: cfg.site.autor, url: base + '/' },
      publisher: { '@type': 'Organization', name: cfg.site.nome, url: base + '/', logo: { '@type': 'ImageObject', url: cfg.site.logo } }
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: base + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: base + '/blog/' },
        { '@type': 'ListItem', position: 3, name: a.titulo, item: url }
      ]
    }
  ];
  if (a.faq?.length) schema.push({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: f.pergunta, acceptedAnswer: { '@type': 'Answer', text: f.resposta } }))
  });

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.titulo_seo || a.titulo)}</title>
<meta name="description" content="${esc(a.meta_descricao)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${esc(cfg.site.nome)}">
<meta property="og:title" content="${esc(a.titulo)}">
<meta property="og:description" content="${esc(a.meta_descricao)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(cfg.site.logo)}">
<meta property="article:published_time" content="${a.data_publicacao}">
<meta name="twitter:card" content="summary">
${ICONES}
${FONTES}
${CSS}
${schema.map(ld).join('\n')}
</head>
<body>
${topo(cfg, a.slug)}
<div class="art">
  <nav class="crumbs" aria-label="Você está em"><a href="/">Início</a> › <a href="/blog/">Blog</a></nav>
  <article>
    <header>
      <span class="eyebrow">${esc(a.categoria || 'Aquisição de pacientes')}</span>
      <h1>${esc(a.titulo)}</h1>
      <p class="lead">${esc(a.resumo)}</p>
      <p class="meta">Por ${esc(cfg.site.autor)} · <time datetime="${a.data_publicacao}">${dataBR(a.data_publicacao)}</time> · ${minutos} min de leitura</p>
    </header>
    <div class="corpo">
${a.corpo_html}
    </div>
${a.faq?.length ? `    <section class="faq" aria-labelledby="faq-t">
      <h2 id="faq-t">Perguntas frequentes</h2>
${a.faq.map((f) => `      <details><summary>${esc(f.pergunta)}</summary><p>${esc(f.resposta)}</p></details>`).join('\n')}
    </section>` : ''}
    <aside class="cta">
      <span class="eyebrow">Diagnóstico de Funil</span>
      <h2>${esc(a.cta_titulo || 'Quer ver onde o seu consultório está perdendo paciente?')}</h2>
      <p>Antes de aumentar a verba, a gente mede do anúncio até o tratamento fechado e mostra onde está o furo e quanto ele custa.</p>
      <a class="btn btn-coral" href="${esc(ctaLink)}">${esc(cfg.site.cta_texto)}</a>
      <small>${esc(cfg.site.cta_apoio)}</small>
    </aside>
  </article>
</div>
${relacionados.length ? `<section class="rel" aria-labelledby="rel-t">
  <h2 id="rel-t">Continue lendo</h2>
${relacionados.map(cartao).join('\n')}
</section>` : ''}
${rodape(cfg)}
</body>
</html>
`;
}

const cartao = (a) => `  <a class="card" href="/blog/${a.slug}/">
    <span class="d">${dataBR(a.data_publicacao)}</span>
    <h3>${esc(a.titulo)}</h3>
    <p>${esc(a.resumo)}</p>
  </a>`;

// ---------- Índice do blog ----------
export function paginaIndice(cfg, todos) {
  const base = cfg.site.url.replace(/\/$/, '');
  const desc = 'Artigos para médicos particulares sobre aquisição de pacientes, tráfego pago, atendimento no WhatsApp e funil do consultório, medidos do anúncio até a receita.';
  const schema = {
    '@context': 'https://schema.org', '@type': 'Blog', name: `Blog da ${cfg.site.nome}`, url: base + '/blog/', inLanguage: 'pt-BR', description: desc,
    publisher: { '@type': 'Organization', name: cfg.site.nome, url: base + '/', logo: { '@type': 'ImageObject', url: cfg.site.logo } },
    blogPost: todos.map((a) => ({ '@type': 'BlogPosting', headline: a.titulo, url: `${base}/blog/${a.slug}/`, datePublished: a.data_publicacao }))
  };
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blog: aquisição de pacientes particulares | Porto Growth</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${base}/blog/">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="Blog da ${esc(cfg.site.nome)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${base}/blog/">
<meta property="og:image" content="${esc(cfg.site.logo)}">
${ICONES}
${FONTES}
${CSS}
${ld(schema)}
</head>
<body>
${topo(cfg, 'blog-inicio')}
<div class="hub">
  <header>
    <span class="eyebrow">Blog da Porto</span>
    <h1>Aquisição de pacientes particulares, <em>sem achismo.</em></h1>
    <p class="lead">O que funciona (e o que vaza) no caminho entre o anúncio e o tratamento fechado. Escrito para médicos que não têm tempo a perder.</p>
  </header>
  <div>
${todos.length ? todos.map(cartao).join('\n') : '    <p class="vazio">Os primeiros artigos chegam em breve.</p>'}
  </div>
</div>
${rodape(cfg)}
</body>
</html>
`;
}

// ---------- sitemap, robots, llms ----------
export function sitemap(cfg, todos) {
  const base = cfg.site.url.replace(/\/$/, '');
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: base + '/', lastmod: hoje },
    { loc: base + '/blog/', lastmod: todos[0]?.data_atualizacao || todos[0]?.data_publicacao || hoje },
    ...todos.map((a) => ({ loc: `${base}/blog/${a.slug}/`, lastmod: a.data_atualizacao || a.data_publicacao }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
}

export const robots = (cfg) => `User-agent: *
Allow: /
Disallow: /seo/

Sitemap: ${cfg.site.url.replace(/\/$/, '')}/sitemap.xml
`;

export function llms(cfg, todos) {
  const base = cfg.site.url.replace(/\/$/, '');
  return `# ${cfg.site.nome}

> ${cfg.tese}

Agência de tráfego pago e aquisição de pacientes para médicos particulares, sediada em ${cfg.site.cidade}. Atende consultórios em todo o Brasil.

## Páginas

- [Início](${base}/): diagnóstico de funil e Metodologia Fluxo Privado™
- [Blog](${base}/blog/): artigos sobre aquisição de pacientes particulares

## Artigos

${todos.map((a) => `- [${a.titulo}](${base}/blog/${a.slug}/): ${a.resumo}`).join('\n')}
`;
}

// ---------- Reconstrói tudo ----------
export function carregarArtigos(raiz) {
  const dir = path.join(raiz, 'seo', 'artigos');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter((a) => a.status !== 'rascunho')
    .sort((x, y) => (y.data_publicacao + y.slug).localeCompare(x.data_publicacao + x.slug));
}

export function reconstruir(raiz, cfg) {
  const todos = carregarArtigos(raiz);
  const gravar = (rel, conteudo) => {
    const p = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, conteudo);
  };
  for (const a of todos) gravar(`blog/${a.slug}/index.html`, paginaArtigo(a, cfg, todos));
  gravar('blog/index.html', paginaIndice(cfg, todos));
  gravar('sitemap.xml', sitemap(cfg, todos));
  gravar('robots.txt', robots(cfg));
  gravar('llms.txt', llms(cfg, todos));
  return todos;
}
