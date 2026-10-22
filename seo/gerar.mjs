#!/usr/bin/env node
// Publicador de SEO da Porto Growth.
//
//   node seo/gerar.mjs                  -> escolhe a pauta, escreve, revisa e gera as páginas
//   node seo/gerar.mjs --tema "..."     -> escreve sobre um tema específico
//   node seo/gerar.mjs --de-json a.json -> importa um artigo já escrito (mesmo formato de seo/artigos)
//   node seo/gerar.mjs --rebuild        -> só reconstrói blog, sitemap, robots e llms.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconstruir, carregarArtigos, limparHtml, contarPalavras } from './lib/render.mjs';
import { pesquisarBuscas } from './lib/pesquisa.mjs';
import { chamarClaude, FERRAMENTA_PAUTA, FERRAMENTA_ARTIGO, FERRAMENTA_REVISAO } from './lib/claude.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lerJson = (rel) => JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
const gravarJson = (rel, obj) => fs.writeFileSync(path.join(RAIZ, rel), JSON.stringify(obj, null, 2) + '\n');
const cfg = lerJson('seo/config.json');

const args = process.argv.slice(2);
const arg = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
const hojeBahia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');

// ---------- Contexto da marca enviado à IA ----------
function sistema() {
  return `Você é o redator de SEO da ${cfg.site.nome}, agência de ${cfg.site.cidade}.

PÚBLICO: ${cfg.publico}

TESE DA MARCA: ${cfg.tese}

TOM DE VOZ: ${cfg.tom_de_voz}

PROVAS QUE PODEM SER CITADAS (as únicas fontes de números reais):
${cfg.provas_permitidas.map((p) => `- ${p}`).join('\n')}

REGRAS QUE NUNCA PODEM SER QUEBRADAS:
${cfg.regras.map((r) => `- ${r}`).join('\n')}`;
}

function listaPublicados(todos) {
  if (!todos.length) return 'Nenhum artigo publicado ainda.';
  return todos.map((a) => `- /blog/${a.slug}/ | ${a.titulo} | palavra-chave: ${a.palavra_chave}`).join('\n');
}

// ---------- Etapas ----------
async function escolherPauta(todos, pautas) {
  console.log('Pesquisando o que os médicos buscam no Google...');
  const buscas = await pesquisarBuscas(cfg);
  console.log(`  ${buscas.length} buscas encontradas`);
  const ja = [...pautas.publicados, ...todos.map((a) => a.palavra_chave)];
  return chamarClaude({
    modelo: cfg.modelo,
    sistema: sistema(),
    ferramenta: FERRAMENTA_PAUTA,
    maxTokens: 2000,
    mensagem: `Escolha o tema do próximo artigo do blog.

Buscas reais do autocomplete do Google (as primeiras aparecem em mais variações):
${buscas.length ? buscas.join('\n') : '(a pesquisa não retornou nada hoje; use as sementes: ' + cfg.sementes.join(', ') + ')'}

Já publicados (não repita tema nem palavra-chave):
${listaPublicados(todos)}
${ja.length ? '\nTemas já usados: ' + ja.join('; ') : ''}

Critérios, nesta ordem:
1. Busca que um médico particular faria quando está perto de contratar ajuda para conseguir pacientes.
2. Tema em que a tese da marca (o furo entre o WhatsApp e o tratamento fechado) dá uma resposta melhor que a dos concorrentes.
3. Busca específica (cauda longa) em vez de termos genéricos e disputados.
Evite temas de paciente leigo (sintomas, doenças) porque o público do blog é o médico.`
  });
}

async function redigir(pauta, todos) {
  const { palavras_min, palavras_max, faq_min, faq_max } = cfg.artigo;
  return chamarClaude({
    modelo: cfg.modelo,
    sistema: sistema(),
    ferramenta: FERRAMENTA_ARTIGO,
    mensagem: `Escreva o artigo completo.

TEMA: ${pauta.titulo_provisorio || pauta.palavra_chave}
PALAVRA-CHAVE: ${pauta.palavra_chave}
${pauta.intencao ? 'INTENÇÃO DE QUEM BUSCA: ' + pauta.intencao : ''}
${pauta.angulo ? 'ÂNGULO: ' + pauta.angulo : ''}
${pauta.perguntas_relacionadas?.length ? 'PERGUNTAS RELACIONADAS PARA COBRIR: ' + pauta.perguntas_relacionadas.join(' | ') : ''}

ARTIGOS DO BLOG PARA LINK INTERNO (use 1 a 3 links quando fizer sentido, só destes endereços):
${listaPublicados(todos)}

ESTRUTURA:
- Comece com 2 ou 3 frases que respondem a pergunta principal direto, sem introdução genérica. É esse trecho que o Google e as IAs costumam citar.
- Use h2 escritos como as perguntas que o médico faria. Use h3 só se precisar dividir um h2.
- Parágrafos curtos (2 a 4 frases). Pelo menos uma lista e um exemplo prático com números (das provas permitidas ou marcados como "exemplo ilustrativo").
- Termine com uma seção prática: checklist ou próximo passo que o médico pode fazer hoje.
- Cite a Porto no máximo 2 vezes no corpo e sem tom de propaganda. Não coloque chamada para contato no corpo; a página já tem uma caixa no final.
- Entre ${palavras_min} e ${palavras_max} palavras no corpo.
- FAQ com ${faq_min} a ${faq_max} perguntas que não repetem os h2.
- Evite frases de IA: "no cenário atual", "é crucial", "desvendar", "mergulhar", "no mundo de hoje", "em suma", "vale ressaltar".`
  });
}

async function revisar(artigo, todos) {
  return chamarClaude({
    modelo: cfg.modelo_revisao || cfg.modelo,
    sistema: sistema(),
    ferramenta: FERRAMENTA_REVISAO,
    mensagem: `Você agora é o revisor. Revise o artigo abaixo e devolva a versão corrigida completa.

Confira, nesta ordem:
1. REGRAS: alguma regra da marca foi quebrada? Corrija.
2. NÚMEROS: todo número, porcentagem, estudo ou nome de cliente precisa estar nas provas permitidas ou estar marcado como exemplo ilustrativo. Se não estiver, remova ou reescreva sem o número.
3. PROMESSAS: troque qualquer garantia de resultado por linguagem honesta.
4. RESPOSTA DIRETA: as 2 ou 3 primeiras frases respondem a palavra-chave "${artigo.palavra_chave}"? Se não, reescreva a abertura.
5. TOM: corte frases genéricas de IA, jargão e enrolação. Mantenha o tamanho parecido.
6. SEO: palavra-chave no titulo, no titulo_seo (até 60 caracteres), na meta_descricao (130 a 155 caracteres) e em pelo menos um h2. Links internos só para estes endereços:
${listaPublicados(todos)}

Em "alteracoes", liste o que mudou. Em "conferir", liste o que o Matheus precisa checar com os próprios olhos antes de aprovar.

ARTIGO:
${JSON.stringify(artigo, null, 2)}`
  });
}

// ---------- Checagens automáticas (sem IA) ----------
function validar(a, todos) {
  const avisos = [];
  const linksValidos = new Set(todos.map((x) => `/blog/${x.slug}/`));
  const limpo = limparHtml(a.corpo_html, linksValidos);
  a.corpo_html = limpo.html;
  avisos.push(...limpo.avisos);

  a.slug = slugify(a.slug || a.titulo);
  const usados = new Set(todos.map((x) => x.slug));
  if (usados.has(a.slug)) { let n = 2; while (usados.has(`${a.slug}-${n}`)) n++; a.slug = `${a.slug}-${n}`; avisos.push(`slug repetido; usei ${a.slug}`); }

  if ((a.titulo_seo || '').length > 60) avisos.push(`título SEO com ${a.titulo_seo.length} caracteres (ideal até 60)`);
  const md = (a.meta_descricao || '').length;
  if (md < 110 || md > 160) avisos.push(`meta descrição com ${md} caracteres (ideal 130 a 155)`);
  const palavras = contarPalavras(a.corpo_html);
  if (palavras < cfg.artigo.palavras_min * 0.8) avisos.push(`artigo curto: ${palavras} palavras`);
  const pc = (a.palavra_chave || '').toLowerCase();
  const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (pc && !sem(a.titulo + ' ' + a.titulo_seo).includes(sem(pc).split(' ').slice(0, 2).join(' ')))
    avisos.push('palavra-chave não aparece no título');
  if (!/<h2>/.test(a.corpo_html)) avisos.push('artigo sem subtítulos h2');
  a.faq = (a.faq || []).filter((f) => f.pergunta && f.resposta).slice(0, cfg.artigo.faq_max);
  return { artigo: a, avisos, palavras };
}

function salvar(a) {
  const dir = path.join(RAIZ, 'seo', 'artigos');
  fs.mkdirSync(dir, { recursive: true });
  const campos = ['slug','titulo','titulo_seo','meta_descricao','palavra_chave','categoria','resumo','cta_titulo','data_publicacao','data_atualizacao','corpo_html','faq'];
  const final = Object.fromEntries(campos.filter((c) => a[c] !== undefined).map((c) => [c, a[c]]));
  fs.writeFileSync(path.join(dir, `${a.slug}.json`), JSON.stringify(final, null, 2) + '\n');
}

function relatorioPR(a, extras) {
  const url = `${cfg.site.url}/blog/${a.slug}/`;
  const md = `## Novo artigo: ${a.titulo}

**Palavra-chave:** ${a.palavra_chave}
**Endereço depois de aprovado:** ${url}
**Tamanho:** ${extras.palavras} palavras · ${a.faq.length} perguntas no FAQ
${extras.porque ? `**Por que este tema:** ${extras.porque}\n` : ''}
**Como aparece no Google**
> **${a.titulo_seo}**
> ${a.meta_descricao}

${extras.conferir?.length ? `### Confira antes de aprovar\n${extras.conferir.map((c) => `- [ ] ${c}`).join('\n')}\n` : ''}
${extras.alteracoes?.length ? `### O que a revisão corrigiu\n${extras.alteracoes.map((c) => `- ${c}`).join('\n')}\n` : ''}
${extras.avisos?.length ? `### Avisos automáticos\n${extras.avisos.map((c) => `- ${c}`).join('\n')}\n` : ''}
---
**Para publicar:** abra a prévia do Cloudflare (link nos checks deste PR), leia o artigo e clique em **Merge**.
**Para ajustar:** edite \`seo/artigos/${a.slug}.json\` aqui mesmo no GitHub (ícone de lápis). O robô refaz a página sozinho em cerca de 1 minuto.
**Para descartar:** feche o PR sem fazer merge.
`;
  fs.writeFileSync(path.join(RAIZ, 'seo', '.pr.md'), md);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `titulo=${a.titulo.replace(/\n/g, ' ')}\nslug=${a.slug}\n`);
  }
}

// ---------- Execução ----------
async function principal() {
  if (args.includes('--rebuild')) {
    const todos = reconstruir(RAIZ, cfg);
    console.log(`Reconstruído: ${todos.length} artigo(s), blog, sitemap.xml, robots.txt, llms.txt`);
    return;
  }

  const todos = carregarArtigos(RAIZ);
  const pautas = lerJson('seo/pautas.json');
  const data = arg('--data') || hojeBahia();
  let artigo, extras = {};

  const deJson = arg('--de-json');
  if (deJson) {
    artigo = JSON.parse(fs.readFileSync(path.resolve(deJson), 'utf8'));
  } else {
    const temaManual = arg('--tema') || process.env.SEO_TEMA?.trim();
    let pauta;
    if (temaManual) pauta = { palavra_chave: temaManual, titulo_provisorio: temaManual };
    else if (pautas.fila.length) pauta = { palavra_chave: pautas.fila[0], titulo_provisorio: pautas.fila[0] };
    else { pauta = await escolherPauta(todos, pautas); extras.porque = pauta.por_que; }
    console.log(`Tema: ${pauta.titulo_provisorio}`);

    console.log('Escrevendo...');
    const rascunho = await redigir(pauta, todos);
    console.log('Revisando...');
    const revisado = await revisar(rascunho, todos);
    extras.alteracoes = revisado.alteracoes;
    extras.conferir = revisado.conferir;
    delete revisado.alteracoes; delete revisado.conferir;
    artigo = revisado;

    // tira o tema da fila
    const usado = pauta.titulo_provisorio;
    pautas.fila = pautas.fila.filter((t) => t !== usado && t !== temaManual);
    pautas.publicados.push(usado);
    gravarJson('seo/pautas.json', pautas);
  }

  artigo.data_publicacao = artigo.data_publicacao || data;
  const v = validar(artigo, todos);
  salvar(v.artigo);
  reconstruir(RAIZ, cfg);
  relatorioPR(v.artigo, { ...extras, avisos: v.avisos, palavras: v.palavras });

  console.log(`\nPronto: blog/${v.artigo.slug}/index.html (${v.palavras} palavras)`);
  if (v.avisos.length) console.log('Avisos:\n- ' + v.avisos.join('\n- '));
}

principal().catch((e) => { console.error('\nERRO: ' + e.message); process.exit(1); });
