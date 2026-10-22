# AgroCR Campo

Aplicativo da consultoria agronômica AgroCR ("Parceria de Resultados") que liga a consultoria às fazendas atendidas no Tocantins.

## Regras para o Claude Code

- **Leia `ESPECIFICACAO.md` antes de qualquer tarefa.** Ela é a fonte de verdade das regras de negócio.
- **Estamos na Fase 1 (MVP).** Não implemente itens das Fases 2 e 3 sem pedido explícito.
- **Prioridade: Android**, aparelhos básicos de campo. Stack: multiplataforma (Flutter ou React Native) com backend em nuvem.
- **Offline-first é requisito crítico.** Todo módulo novo precisa funcionar sem internet e entrar na fila de sincronização. Execuções e chuvas são acréscimos (nunca se sobrescrevem); cadastros usam a última edição.
- **Telas simples**: botões grandes, pouco texto, em português do Brasil. O usuário final é operador de campo com pouca familiaridade com tecnologia.
- **Identidade visual**: azul-marinho e verde da logo AgroCR, seguindo o protótipo React existente (referência de telas e regras de negócio).
- **Regra central do estoque**: saldo = comprado (programação) − usado (dose/ha × área executada) ± ajustes manuais. Converter unidades (mL→L, g e t→kg).

## Escopo do MVP (Fase 1)

Login com dois perfis (consultoria / fazenda), cadastro de fazendas e talhões, recomendações e execuções com datas, estoque automático, pluviometria, relatório de aplicações em PDF, offline com sincronização.
