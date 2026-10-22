# Publicador de SEO da Porto Growth

Toda segunda-feira, por volta das 8h (Bahia), um robô no GitHub:

1. pega o próximo tema da fila (`seo/pautas.json`) ou, se a fila estiver vazia, pesquisa no autocomplete do Google o que os médicos estão buscando;
2. escreve o artigo com a API do Claude, usando o perfil da marca (`seo/config.json`);
3. passa por uma segunda revisão: regras, números inventados, promessas, tom e SEO;
4. faz checagens automáticas (HTML seguro, links internos, tamanho do título e da descrição);
5. gera a página do artigo, o índice `/blog/`, o `sitemap.xml`, o `robots.txt` e o `llms.txt`;
6. abre um **Pull Request** com o resumo e o que você precisa conferir.

**Você aprova clicando em Merge.** O Cloudflare Pages publica sozinho.

## Configuração (uma vez só)

1. Crie uma chave de API em https://console.anthropic.com (é paga por uso).
2. No GitHub, em **Settings > Secrets and variables > Actions > New repository secret**, crie `ANTHROPIC_API_KEY` com a chave.
3. Em **Settings > Actions > General**, marque **Allow GitHub Actions to create and approve pull requests** e salve.

## No dia a dia

- **Escolher temas:** edite `seo/pautas.json` e escreva os temas em `fila`.
- **Gerar um artigo extra agora:** aba **Actions > Artigo SEO semanal > Run workflow**. Pode escrever um tema ou deixar vazio.
- **Corrigir um artigo antes de aprovar:** edite `seo/artigos/<nome>.json` dentro do PR. As páginas se refazem sozinhas.
- **Mudar tom, provas ou regras:** edite `seo/config.json`.
- **Mudar o dia:** altere a linha `cron` em `.github/workflows/seo-artigo.yml`.

## Testar sem gastar API

```
SEO_MOCK=1 node seo/gerar.mjs --tema "teste"
```

(Use numa cópia; o teste cria um artigo falso.)

## Para usar com um cliente

Copie a pasta `seo/` e o arquivo `.github/workflows/seo-artigo.yml` para o repositório do site do cliente e reescreva o `seo/config.json` com o público, o tom, as provas e as regras dele. Em sites de médicos, mantenha as regras da Resolução CFM 2.336/2023 bem rígidas.
