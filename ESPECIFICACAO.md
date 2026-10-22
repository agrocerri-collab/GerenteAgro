# AgroCR Campo — Especificação do aplicativo

**AgroCR Campo** — Especificação funcional e técnica do aplicativo
Documento para orçamento e desenvolvimento — agosto de 2026
**AgroCR — Parceria de Resultados**

---

## 1. Visão geral

O AgroCR Campo é o aplicativo da consultoria agronômica AgroCR que liga a consultoria às fazendas atendidas. A consultoria cadastra as fazendas, os talhões, o mapa, a programação de compras e as recomendações de aplicação; o produtor e o operador da fazenda executam as aplicações, atualizam o estoque e lançam as chuvas. Tudo fica registrado por talhão, com data de recomendação e data de execução, gerando relatórios em PDF.

Já existe um protótipo funcional (web) construído pela consultoria que valida o fluxo completo e serve de referência visual e funcional para o desenvolvimento. Este documento descreve o que o aplicativo definitivo precisa ter.

### Objetivos do produto

- Registrar todas as aplicações por talhão, com rastreabilidade completa (o que, quando foi recomendado, quando foi executado e por quem).
- Funcionar para operadores de campo com pouca familiaridade com tecnologia: telas simples, botões grandes, pouco texto.
- Funcionar offline no campo e sincronizar automaticamente quando houver sinal.
- Manter o estoque de insumos de cada fazenda sempre atualizado, descontando o que foi aplicado.
- Gerar relatórios profissionais em PDF com a identidade visual da AgroCR.

---

## 2. Perfis de usuário e permissões

O aplicativo abre com a logo da AgroCR e uma tela de login. Existem dois perfis:

| Recurso | Consultoria | Fazenda (produtor / operador) |
| --- | --- | --- |
| **Fazendas visíveis** | Todas as fazendas atendidas | Somente a própria fazenda |
| **Cadastro de fazendas e talhões** | Criar, editar e excluir | Somente visualizar |
| **Mapa (KML)** | Importar e substituir | Visualizar |
| **Programação / compras** | Lançar e excluir itens | Visualizar |
| **Estoque** | Visualizar e ajustar | Visualizar e lançar ajustes (entrada/saída) |
| **Recomendações de aplicação** | Criar, editar e excluir | Visualizar e marcar como executado por talhão |
| **Visitas técnicas** | Registrar com fotos e gerar PDF | Visualizar relatórios |
| **Pluviometria** | Visualizar e lançar | Lançar chuvas e visualizar |
| **Relatórios em PDF** | Todos | Da própria fazenda |

- Login individual por usuário (e-mail ou telefone + senha), com papel definido pelo administrador da consultoria.
- Cada usuário do perfil fazenda é vinculado a uma única fazenda. Um produtor com mais de uma fazenda pode ter acesso a mais de uma.
- A consultoria administra os usuários (criar, desativar, redefinir senha).

---

## 3. Módulos funcionais

### 3.1 Dados da fazenda

- Fazenda: nome, produtor, município/UF, observações.
- Talhões: nome, área (ha), cultura, variedade/híbrido. A área total da fazenda é a soma dos talhões.

### 3.2 Mapa (KML)

- Importação de arquivo KML/KMZ com os polígonos dos talhões (exportado do Google Earth ou de softwares de agricultura de precisão).
- Exibição do mapa com os talhões desenhados e nomeados; ao tocar em um talhão, exibir nome, área e a última aplicação.
- Desejável: vincular automaticamente cada polígono ao talhão cadastrado pelo nome, e exibir camada de satélite.

### 3.3 Programação / compras

- Lançamento de tudo que foi comprado para a safra, por categoria: herbicida, inseticida, fungicida, biológico, adjuvante, foliar, fertilizante/adubo, tratamento de sementes, sementes e outros.
- Campos: produto, categoria, quantidade, unidade (L, mL, kg, g, t, sc, un), preço unitário (opcional), observação (nota fiscal, fornecedor).
- Total investido calculado automaticamente quando houver preços.

### 3.4 Estoque atualizado

O estoque é calculado automaticamente, sem digitação duplicada:

- **Regra central:** Saldo = comprado (programação) − usado (aplicações executadas) ± ajustes manuais.
- **Cálculo do usado:** Dose por hectare × área do talhão marcado como executado, somando todos os talhões executados de todas as recomendações.
- **Unidades:** mL é convertido para L, g e t para kg, para que compra e uso fechem na mesma unidade.
- **Ajustes:** Entrada ou saída com quantidade, motivo (sobra de calda, perda, compra extra, inventário) e nome de quem lançou. O pessoal da fazenda pode lançar.
- **Alertas:** Alerta visual quando o saldo de um produto ficar baixo ou negativo.

### 3.5 Recomendações e aplicações

- A consultoria cria a recomendação: tipo (herbicida, inseticida, fungicida, biológico, foliar, dessecação), alvo, produtos com dose por hectare, vazão (L/ha), data recomendada e os talhões selecionados.
- Leitura automática de receita: tirar foto da receita (inclusive manuscrita) ou colar o texto, e o aplicativo preenche os produtos, doses, vazão e alvo usando IA (com conferência humana antes de salvar).
- A recomendação chega na hora para a fazenda (notificação push).
- O operador abre a recomendação, vê os talhões e marca cada um como EXECUTADO, informando o nome; a data e a hora são registradas automaticamente. Pode anexar fotos e observação.
- A execução aparece imediatamente para a consultoria, com data de recomendação e data de execução lado a lado.
- O estoque é descontado automaticamente na execução.

### 3.6 Visitas técnicas

- O técnico/agrônomo registra a visita: data, responsável e uma lista de observações, cada uma com título, descrição e fotos.
- Relatório da visita em PDF com a logo da AgroCR, pronto para enviar ao produtor por WhatsApp/e-mail.

### 3.7 Pluviometria

- O produtor/operador lança as chuvas: data, milímetros, pluviômetro/local e quem lançou (aceita 0 mm para fechar períodos).
- Painel com acumulado do mês, gráfico de acumulado mensal e contador de dias sem chuva, com alerta visual de veranico.
- Desejável: mais de um pluviômetro por fazenda e acumulado por decêndio.

### 3.8 Relatórios em PDF

- Relatório de aplicações por talhão: recomendado × executado, produtos e doses, datas e responsáveis.
- Relatório de visita técnica com fotos.
- Desejável: relatório de estoque e de pluviometria; todos com cabeçalho AgroCR e compartilhamento direto no WhatsApp.

---

## 4. Requisitos técnicos

### 4.1 Offline primeiro (requisito crítico)

- O aplicativo precisa funcionar totalmente sem internet no campo: consultar recomendações, marcar execuções, lançar chuvas, ajustar estoque e tirar fotos.
- Sincronização automática em segundo plano quando houver sinal, com indicador claro de "sincronizado / pendente".
- Resolução de conflitos simples: registros de execução e chuva nunca se sobrescrevem (são acréscimos); cadastros usam a última edição.

### 4.2 Plataforma

- Android como prioridade (aparelhos comuns de campo, inclusive básicos), iOS em seguida. Sugestão: desenvolvimento multiplataforma (Flutter ou React Native) com backend em nuvem.
- Painel web para a consultoria é desejável (cadastros em massa e relatórios ficam mais fáceis no computador).

### 4.3 Outros requisitos

- Notificações push: nova recomendação (para a fazenda) e execução realizada (para a consultoria).
- Fotos comprimidas no aparelho antes do envio para economizar dados móveis.
- Leitura de receita por foto/texto via API de IA (por exemplo, a API da Anthropic/Claude com visão), sempre com conferência do usuário antes de salvar.
- Backup diário automático dos dados; exportação em planilha (Excel/CSV) por fazenda.
- Identidade visual: azul-marinho e verde da logo AgroCR "Parceria de Resultados", seguindo o protótipo existente.

---

## 5. Modelo de dados (entidades principais)

| Entidade | Campos principais |
| --- | --- |
| **Usuário** | nome, e-mail/telefone, senha, papel (consultoria/fazenda), fazendas vinculadas, ativo |
| **Fazenda** | nome, produtor, município/UF, observações |
| **Talhão** | fazenda, nome, área (ha), cultura, variedade, polígono (coordenadas do KML) |
| **Compra (programação)** | fazenda, produto, categoria, quantidade, unidade, preço unitário, observação, data |
| **Recomendação** | fazenda, tipo, alvo, produtos [nome, dose, unidade], vazão, data recomendada, talhões, criada por, criada em |
| **Execução** | recomendação, talhão, data/hora (automática), operador, observação, fotos |
| **Ajuste de estoque** | fazenda, produto, quantidade (+/−), motivo, quem lançou, data |
| **Visita** | fazenda, data, técnico, observações [título, texto, fotos] |
| **Chuva** | fazenda, data, mm, pluviômetro/local, quem lançou |

---

## 6. Fases sugeridas de desenvolvimento

**Fase 1 — MVP (essencial para começar a usar):**

- Login com dois perfis, cadastro de fazendas e talhões, recomendações e execuções com datas, estoque automático, pluviometria, relatório de aplicações em PDF e offline com sincronização.

**Fase 2 — Consolidação:**

- Mapa KML interativo com satélite, visitas técnicas com relatório, leitura de receita por foto (IA), notificações push e painel web da consultoria.

**Fase 3 — Inteligência agronômica:**

- Custo por hectare e por talhão a partir dos preços da programação.
- Alerta de repetição de mecanismo de ação (grupos FRAC/IRAC/HRAC) no mesmo talhão, para manejo de resistência.
- Intervalo de reentrada e período de carência por produto, com aviso de liberação do talhão.
- Monitoramento de pragas com níveis de controle e registro do estádio fenológico nas aplicações.

---

## 7. Material de referência

- Protótipo funcional (arquivo React de tela única) com todos os fluxos implementados: perfis, ícones da fazenda, mapa KML, programação, estoque calculado, visitas, aplicações com leitura de receita por IA e pluviometria. Deve ser usado como referência de telas, textos e regras de negócio.
- Logo oficial AgroCR "Parceria de Resultados" (fornecida pela consultoria).

---

*Contato do responsável pelo projeto: consultoria AgroCR.*
