// Chamada à API do Claude com ferramenta obrigatória (resposta sempre em JSON válido).
const API = 'https://api.anthropic.com/v1/messages';

export async function chamarClaude({ modelo, sistema, mensagem, ferramenta, maxTokens = 16000 }) {
  if (process.env.SEO_MOCK) return (await import('./mock.mjs')).respostaFalsa(ferramenta.name, mensagem);

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error('Falta a variável ANTHROPIC_API_KEY (crie o secret no GitHub: Settings > Secrets and variables > Actions).');

  const corpo = {
    model: modelo,
    max_tokens: maxTokens,
    system: sistema,
    messages: [{ role: 'user', content: mensagem }],
    tools: [ferramenta],
    tool_choice: { type: 'tool', name: ferramenta.name }
  };

  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(corpo)
    });
    if (r.ok) {
      const json = await r.json();
      const bloco = json.content.find((c) => c.type === 'tool_use');
      if (!bloco) throw new Error('A IA não devolveu o formato esperado.');
      if (json.stop_reason === 'max_tokens') throw new Error('Resposta cortada por tamanho; aumente maxTokens.');
      return bloco.input;
    }
    const texto = await r.text();
    if ((r.status === 429 || r.status >= 500) && tentativa < 4) {
      const espera = 5000 * tentativa;
      console.warn(`API respondeu ${r.status}; nova tentativa em ${espera / 1000}s`);
      await new Promise((ok) => setTimeout(ok, espera));
      continue;
    }
    throw new Error(`Erro da API do Claude (${r.status}): ${texto.slice(0, 500)}`);
  }
}

// ---------- Formatos de resposta ----------
const camposArtigo = {
  titulo: { type: 'string', description: 'Título H1, claro e com a palavra-chave. Até 70 caracteres.' },
  titulo_seo: { type: 'string', description: 'Título para a aba e o Google. Até 60 caracteres, palavra-chave no início.' },
  meta_descricao: { type: 'string', description: 'Entre 130 e 155 caracteres. Promete a resposta, sem clickbait.' },
  slug: { type: 'string', description: 'URL curta, minúsculas, sem acento, palavras separadas por hífen. Ex.: trafego-pago-para-medicos' },
  palavra_chave: { type: 'string' },
  categoria: { type: 'string', description: 'Uma de: Aquisição de pacientes, Tráfego pago, Atendimento e WhatsApp, Funil e métricas, Publicidade médica' },
  resumo: { type: 'string', description: 'Linha fina abaixo do título, 1 a 2 frases, até 220 caracteres.' },
  corpo_html: { type: 'string', description: 'Corpo do artigo em HTML. Só as tags h2, h3, p, ul, ol, li, strong, em, a, blockquote, table. Sem h1, sem estilos, sem classes.' },
  faq: {
    type: 'array',
    items: { type: 'object', properties: { pergunta: { type: 'string' }, resposta: { type: 'string', description: '2 a 4 frases, resposta completa e direta.' } }, required: ['pergunta', 'resposta'] }
  },
  cta_titulo: { type: 'string', description: 'Pergunta curta para a caixa de chamada ao final, ligada ao tema do artigo.' }
};
const obrigatoriosArtigo = Object.keys(camposArtigo);

export const FERRAMENTA_PAUTA = {
  name: 'escolher_pauta',
  description: 'Escolhe o melhor tema para o próximo artigo.',
  input_schema: {
    type: 'object',
    properties: {
      palavra_chave: { type: 'string', description: 'Busca principal que o artigo deve responder.' },
      titulo_provisorio: { type: 'string' },
      intencao: { type: 'string', description: 'O que o médico que busca isso quer resolver.' },
      angulo: { type: 'string', description: 'Como ligar o tema à tese da Porto sem virar propaganda.' },
      perguntas_relacionadas: { type: 'array', items: { type: 'string' } },
      por_que: { type: 'string', description: 'Por que este tema agora, em uma frase.' }
    },
    required: ['palavra_chave', 'titulo_provisorio', 'intencao', 'angulo', 'perguntas_relacionadas', 'por_que']
  }
};

export const FERRAMENTA_ARTIGO = {
  name: 'salvar_artigo',
  description: 'Salva o artigo completo.',
  input_schema: { type: 'object', properties: camposArtigo, required: obrigatoriosArtigo }
};

export const FERRAMENTA_REVISAO = {
  name: 'salvar_revisao',
  description: 'Salva o artigo revisado e a lista do que mudou.',
  input_schema: {
    type: 'object',
    properties: {
      ...camposArtigo,
      alteracoes: { type: 'array', items: { type: 'string' }, description: 'O que foi corrigido e por quê, uma linha cada.' },
      conferir: { type: 'array', items: { type: 'string' }, description: 'Pontos que o Matheus deve conferir antes de aprovar (afirmações que dependem de fonte externa, dados sensíveis). Vazio se nada.' }
    },
    required: [...obrigatoriosArtigo, 'alteracoes', 'conferir']
  }
};
