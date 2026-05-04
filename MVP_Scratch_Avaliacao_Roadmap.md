# Roadmap de Implementacao do MVP (4 Sprints)

## Objetivo

Construir um MVP para aulas com Scratch embutido em paginas web, com correcao automatica de desafios e acompanhamento do progresso do aluno.

Este plano foi escrito para permitir que um agente de IA implemente cerca de 90% da programacao, com revisoes humanas nos pontos criticos.

## Escopo do MVP

- Editor Scratch embutido em secoes de aula.
- Botao de verificar por desafio.
- Motor de avaliacao estrutural + comportamental.
- Persistencia de tentativas, pontuacao e projeto (sb3).
- Painel basico do professor com progresso por aluno.

## Criterios de MVP Pronto

- Aluno completa 3 desafios diretamente na pagina.
- Correcao automatica em menos de 2 segundos por desafio (media).
- Professor visualiza progresso por aluno e por desafio.
- Pelo menos 85% das solucoes corretas reconhecidas sem intervencao manual.

## Arquitetura Minima Recomendada

- Frontend: React + Vite (ou Next.js) para componentes de desafio.
- Editor: instancia local do scratch-gui (ou equivalente de runtime + blocos).
- Motor de avaliacao: Node.js/TypeScript.
- API: Fastify ou Express.
- Banco: SQLite para MVP (migravel para PostgreSQL).
- Fila/assinc: nao obrigatorio no MVP.

## Estrutura de Pastas Sugerida

- apps/web: frontend da aula + area do professor.
- apps/api: API de tentativas, score e relatorios.
- packages/evaluator: regras estruturais e comportamentais.
- packages/shared: tipos, DTOs e utilitarios comuns.
- docs: especificacoes tecnicas e prompts para IA.

## Regra de Trabalho para "90% por IA"

- IA implementa: boilerplate, componentes, APIs, models, testes basicos, scripts.
- Humano valida: requisitos pedagogicos, seguranca, regras de avaliacao, UX final.
- Toda tarefa deve terminar com:

1. codigo
2. testes
3. checklist de validacao
4. breve changelog

## Nova Estrategia de Execucao

Esta implementacao passa a seguir 3 fases:

### Fase A - Fork bootstrap (2 a 4 dias)

Objetivo: garantir base self-host do editor antes de aprofundar funcionalidades.

TODOs da Fase A:

1. Fork do ecossistema necessario do editor.
2. Rodar localmente o editor forkado.
3. Publicar uma versao self-host minima.
4. Validar que o editor abre dentro da aplicacao conforme planejado.

### Fase B - Adapter de integracao

Objetivo: criar camada de comunicacao entre a aplicacao e o editor, sem alterar core cedo.

TODOs da Fase B:

1. Definir protocolo de mensagens (import, export, verificar).
2. Implementar adapter no frontend para conversar com editor forkado.
3. Implementar endpoints necessarios na API para verificacao inicial.
4. Cobrir adapter com testes de integracao.

### Fase C - Retomar Sprint MVP

Objetivo: continuar o plano de produto ja definido sobre o editor forkado.

Nesta fase, os sprints abaixo sao executados em cima do editor self-host.

## Sequencia de TODOs por Sprint (Fase C)

## Sprint 1 (Editor embutido + verificar simples)

Meta: aluno abre editor, carrega/salva projeto e recebe validacao simples de 1 desafio.

### TODOs tecnicos

1. [x] Criar monorepo com apps/web, apps/api e packages/evaluator.
2. [x] Configurar lint, format, testes e CI basico.
3. [x] Integrar editor Scratch embutido em uma secao de aula.
4. [x] Implementar importacao de .sb3.
5. [x] Implementar exportacao de .sb3.
6. [x] Criar componente DesafioScratch com estados: pendente, correto, erro.
7. [x] Criar botao Verificar ligado a uma regra fixa simples.
8. [x] Exibir feedback imediato em texto para o aluno.
9. [x] Criar endpoint de healthcheck e endpoint de verificacao simples.
10. [x] Registrar logs minimos de erro no frontend e backend.

### Entregaveis

- Pagina com 1 desafio funcional de ponta a ponta.
- Verificacao simples funcionando com resposta correta/incorreta.

### Validacao humana obrigatoria

- Confirmar que o editor abre em desktop e mobile.
- Confirmar que import/export .sb3 funciona com arquivos reais.

## Sprint 2 (Motor estrutural por JSON + 3 desafios)

Meta: validar 3 desafios com regras estruturais configuraveis.

### TODOs tecnicos

1. Definir schema JSON para regras estruturais.
2. Implementar parser de projeto (.sb3 para JSON interno).
3. Implementar avaliador estrutural por padroes de blocos.
4. Implementar equivalencias de solucao (nao apenas resposta exata).
5. Cadastrar 3 desafios: giro, tamanho, cor.
6. Implementar feedback por erro de regra:

- faltou bloco de evento
- repeticao incorreta
- parametro fora do esperado

7. Criar testes unitarios do evaluator com casos corretos e incorretos.
8. Criar endpoint POST /evaluate/structural.
9. Integrar frontend para mostrar feedback detalhado.
10. Medir tempo de avaliacao e registrar metrica basica.

### Entregaveis

- Motor estrutural orientado por JSON.
- 3 desafios da aula avaliados automaticamente.

### Validacao humana obrigatoria

- Revisar se regras aceitam solucoes alternativas pedagogicamente validas.
- Revisar mensagens de feedback para linguagem infantil/juvenil adequada.

## Sprint 3 (Motor comportamental + XP + persistencia)

Meta: avaliar comportamento final no runtime e salvar progresso do aluno.

### TODOs tecnicos

1. Implementar avaliador comportamental com execucao curta por cenario.
2. Simular eventos (clique/tecla) e avancar ticks no runtime.
3. Verificar estado final de ator (direcao, tamanho, efeito de cor).
4. Implementar timeout de seguranca para avaliacao.
5. Criar modelo de dados: alunos, tentativas, pontuacao, desafio, timestamp.
6. Criar migracoes SQLite.
7. Criar endpoint POST /attempts para salvar tentativas.
8. Criar endpoint GET /students/:id/progress.
9. Implementar XP/pontuacao persistente no frontend.
10. Adicionar testes de integracao API + evaluator.

### Entregaveis

- Correcao comportamental ativa para os 3 desafios.
- Persistencia completa de tentativa e score.

### Validacao humana obrigatoria

- Revisar se avaliacao comportamental nao pune solucoes criativas corretas.
- Conferir privacidade dos dados (minimizacao e retencao).

## Sprint 4 (Painel professor + relatorio + hardening)

Meta: disponibilizar visao de turma e estabilizar performance/seguranca.

### TODOs tecnicos

1. Criar painel professor com lista de alunos e status por desafio.
2. Criar relatorio basico por competencia (sequencia, repeticao, eventos).
3. Implementar filtros por turma e periodo.
4. Adicionar indicador de tempo medio por desafio.
5. Otimizar carregamento do editor com lazy load.
6. Limitar upload de arquivo e validar MIME/extensao.
7. Sanitizar entradas e aplicar rate limit na API.
8. Melhorar observabilidade (logs estruturados e erros).
9. Rodar testes de carga simples para alvo <2s por avaliacao.
10. Congelar escopo e preparar release MVP.

### Entregaveis

- Painel do professor funcional.
- Relatorio basico por aluno/desafio/competencia.
- Performance e seguranca em nivel MVP.

### Validacao humana obrigatoria

- Verificar qualidade pedagogica do relatorio.
- Confirmar que os criterios de MVP pronto foram atingidos.

## Plano de Execucao com IA (90%)

## Fluxo padrao por tarefa

1. IA gera implementacao inicial.
2. IA gera testes associados.
3. IA executa validacoes locais.
4. Humano revisa pontos criticos.
5. IA ajusta conforme feedback e fecha tarefa.

## Checkpoints obrigatorios de revisao humana

- Qualquer alteracao de regra de avaliacao pedagogica.
- Qualquer alteracao de seguranca/autenticacao.
- Aprovar mensagens mostradas aos alunos.
- Aprovar metricas mostradas ao professor.

## Definicao de pronto por tarefa

- Funcionalidade implementada.
- Testes automatizados passando.
- Sem erros de lint/build.
- Documentacao curta atualizada.

## Prompts base para acelerar o agente de IA

### Prompt 1 - Implementacao de feature

"Implemente a feature [NOME] em [CAMINHO], com testes unitarios e de integracao. Preserve APIs existentes, inclua tratamento de erro e retorne diff resumido com arquivos alterados."

### Prompt 2 - Regras de avaliacao

"Crie regras JSON para o desafio [NOME], aceitando solucoes equivalentes. Gere casos de teste positivo e negativo, incluindo feedback textual para cada falha comum."

### Prompt 3 - Hardening

"Analise os endpoints da API e aplique validacao de input, limite de upload, rate limit e logs estruturados. Inclua checklist de seguranca ao final."

## Riscos e Mitigacoes (operacional)

- Peso do editor: lazy load + abrir apenas quando necessario.
- Correcao rigida: regras por equivalencia + testes com solucoes alternativas.
- Manutencao do fork: minimizar mudancas no core; encapsular customizacao.
- Privacidade: coletar apenas dados necessarios e definir retencao.

## Decisao Arquitetural Atual

- A execucao do MVP passa a priorizar fork/self-host do editor.
- Integracoes via iframe com editor oficial nao sao baseline por restricoes de frame cross-domain.
- O adapter deve ser a camada principal de extensao para evitar alteracoes prematuras no core do editor.

## Cronograma sugerido

- Sprint 1: 1 semana.
- Sprint 2: 1 semana.
- Sprint 3: 1 a 2 semanas.
- Sprint 4: 1 semana.

Total estimado: 4 a 5 semanas para MVP funcional.

## Checklist final de go-live

1. 3 desafios funcionando ponta a ponta.
2. Correcao media <2s.
3. Painel professor com progresso por aluno.
4. Taxa de acerto automatico >=85% em base de testes.
5. Backup de banco e plano de rollback.
6. Documento de operacao basica para professor.
