// Respostas falsas para testar o fluxo sem gastar a API: SEO_MOCK=1 node seo/gerar.mjs
const artigo = {
  titulo: 'Artigo de teste: como o paciente some entre o WhatsApp e a consulta',
  titulo_seo: 'Artigo de teste: paciente some no WhatsApp',
  meta_descricao: 'Texto de teste do publicador da Porto Growth. Serve só para conferir se o fluxo de pauta, redação, revisão e publicação funciona de ponta a ponta.',
  slug: 'artigo-de-teste',
  palavra_chave: 'artigo de teste',
  categoria: 'Atendimento e WhatsApp',
  resumo: 'Resumo de teste para conferir a listagem do blog.',
  corpo_html: '<p>Abertura de teste.</p><h2>Primeira pergunta?</h2><p>Resposta com <a href="/blog/nao-existe/">link quebrado</a> e <script>alert(1)</script>texto.</p><ul><li>Item</li></ul>',
  faq: [{ pergunta: 'Pergunta de teste?', resposta: 'Resposta de teste.' }],
  cta_titulo: 'Quer testar o seu funil?'
};

export function respostaFalsa(nome) {
  if (nome === 'escolher_pauta') return { palavra_chave: 'artigo de teste', titulo_provisorio: 'Artigo de teste', intencao: 'teste', angulo: 'teste', perguntas_relacionadas: [], por_que: 'teste' };
  if (nome === 'salvar_artigo') return structuredClone(artigo);
  if (nome === 'salvar_revisao') return { ...structuredClone(artigo), alteracoes: ['teste de revisão'], conferir: ['teste de conferência'] };
  throw new Error('ferramenta desconhecida no mock: ' + nome);
}
