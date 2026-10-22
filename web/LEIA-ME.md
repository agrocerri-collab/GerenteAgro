# AgroCR Campo — versão que roda hoje

Esta pasta transforma o protótipo `agrocr-app.jsx` num aplicativo que **abre e funciona**,
sem instalar Node, npm ou qualquer programa.

## Como abrir

Dê dois cliques em **`Abrir AgroCR.bat`**.

Abre uma janelinha preta (o servidor) e o navegador em `http://localhost:8765`.
Para desligar, feche a janela preta.

Código de acesso da consultoria: **`agrocr123`** (está em `agrocr-app.jsx`, linha 10).

Cada fazenda tem o **código próprio**, gerado no cadastro e visível em
*Dados da fazenda* quando a consultoria entra. É esse código que o produtor,
o gerente, o operador ou o monitor digitam — e ele abre somente aquela fazenda.

## O que já funciona

| Módulo | Situação |
| --- | --- |
| Perfis consultoria / fazenda | ✅ cada fazenda entra pelo código dela e só vê a si mesma |
| Tabela por tanque do pulverizador | ✅ ha por tanque, produto por tanque e tanque da sobra |
| Ordem de campo | ✅ folha só com o que o operador precisa: sequência, quantidade por tanque, PDF e botão de enviar por WhatsApp |
| Ordem de mistura, bico e observação na receita | ✅ |
| Volume real gasto na execução | ✅ opcional; quando informado, é ele que baixa no estoque |
| Estoque separado por tipo | ✅ herbicida, fungicida, adjuvante… |
| Cadastro de fazendas e talhões | ✅ |
| Dados da lavoura | ✅ cultura, variedade (da lista de compras), plantio, emergência e estande final por talhão. DAE se atualiza sozinho e aparece ao recomendar; espaçamento e população semeada vêm da semeadura |
| Programação / compras | ✅ item a item **ou** anexando planilha (.xlsx ou .csv), com modelo para baixar e folha para preencher à mão |
| Estoque automático (comprado − usado ± ajustes) | ✅ com conversão mL→L, g/t→kg |
| Aplicar em parte do talhão | ✅ área editável por talhão na recomendação (duas variedades no mesmo pivô, faixa com praga). O estoque desconta a área informada |
| Operações no talhão | ✅ divididas em Pulverização, Semeadura e Adubação, cada uma puxando da programação a sua categoria |
| Recomendações e execuções por talhão | ✅ com data, hora, nome de quem recomendou e de quem executou |
| Produtos da receita | ✅ só da programação de compras, com saldo à vista |
| Tabela de calda pronta (ha × vazão × dose) | ✅ por talhão e total, na recomendação e no PDF |
| Grupo / produtor com várias fazendas | ✅ cadastro de grupo com código próprio; abre todas as fazendas do grupo, com lista para escolher |
| Safras | ✅ cada safra guarda compras, operações, chuvas e lavoura; talhões, mapa e documentos seguem em todas. Histórico consultável |
| Documentos da fazenda | ✅ anexar PDF, imagem, planilha — abre offline no talhão |
| Pluviometria | ✅ |
| Visitas técnicas | ✅ |
| Relatório para o campo | ✅ dentro de cada operação — documento de execução, com quantidade por talhão, por tanque e total a retirar do depósito |
| Filtro por talhão nos relatórios | ✅ escolher quais pivôs entram, na central e na folha de campo |
| Relatórios em PDF | ✅ central com 10 relatórios: geral cronológico (com filtro por talhão), pulverização, semeadura, adubação, pluviometria, mapa, dados, estoque e compras |
| Editar cadastros | ✅ fazenda, talhões, compras e recomendações — sem precisar excluir e refazer |
| Editar recomendação | ✅ tudo, enquanto nenhum talhão foi executado; depois só data, bico, pulverizador e observação |
| Registro de alterações | ✅ toda alteração fica assinada (quem, função, o quê e quando), com relatório próprio |
| Semeadura por população | ✅ espaçamento + população → sementes/metro, sementes e bags por talhão |
| Unidade Bag | ✅ 1 bag = 5.000.000 sementes; o estoque fecha em bag |
| Mapa KML | ✅ lê KML comum e o de agricultura de precisão (com `Schema`), calcula a área de cada talhão, desconta buracos e liga polígono ↔ talhão |
| Mapa em imagem | ✅ anexar foto/print/croqui (.jpg, .png) além do KML; fica comprimido e abre offline. PDF não — converta em imagem |
| Satélite no mapa | ✅ imagens da Esri por baixo dos talhões. **Precisa de internet** — sem sinal fica só o desenho. Botão liga/desliga para poupar dados |
| Leitura de receita por foto (IA) | ❌ precisa de servidor com chave da API (Fase 2) |

**Onde os dados ficam:** no próprio aparelho, no `localStorage` do navegador.
Ou seja, funciona 100% offline — mas ainda **não sincroniza entre aparelhos**.
Cada celular/computador tem os seus dados. A sincronização real é o próximo passo.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `Abrir AgroCR.bat` | atalho para ligar o app neste computador |
| `Verificar.bat` | diz o que falta para funcionar no celular |
| `Passo 1 - liberar celular.bat` | roda uma vez; pede permissão de administrador |
| `Passo 2 - abrir no celular.bat` | liga o app para o celular no mesmo Wi-Fi |
| `liberar-rede.ps1`, `diagnostico.ps1` | o que os dois `.bat` acima executam por dentro |
| `servidor.ps1` | servidor local em PowerShell |
| `Gerar arquivo do celular.bat` | traduz o app e monta o `AgroCR-sozinho.html` |
| `build.ps1` | gera o `AgroCR.html` a partir do `..\agrocr-app.jsx` |
| `compilar.html`, `app-compilado.js` | a tradução do app e o resultado dela (**gerado**) |
| `gerar-icones.ps1` | recria os ícones a partir da logo (só se a logo mudar) |
| `AgroCR.html` | **gerado — não edite à mão** |
| `AgroCR-sozinho.html` | **gerado** — arquivo único para o celular |
| `manifest.webmanifest`, `sw.js`, `icone-*.png` | preparo para virar app instalável em HTTPS |
| `vendor\` | React e Babel salvos localmente (funciona sem internet) |

## Mexeu no protótipo?

Edite sempre `..\agrocr-app.jsx` (é a fonte de verdade) e depois rode:

```powershell
.\build.ps1
```

Recarregue a página no navegador (Ctrl+F5).

## Testar no celular Android

Há dois caminhos. O primeiro é o melhor para testar; o segundo é para levar a campo.

### Antes de tudo: rode o `Verificar.bat`

Dois cliques em **`Verificar.bat`**. Ele diz, item por item, o que já está pronto
e o que falta. Se algo aparecer em vermelho, ele explica o que fazer.

### Caminho 1 — celular e computador no mesmo Wi-Fi

**Só funciona em rede sua (casa ou escritório).** Em Wi-Fi de restaurante, hotel ou
qualquer rede aberta, o roteador normalmente impede que dois aparelhos conversem
entre si — não há o que configurar no Windows que resolva. Nesse caso use o Caminho 2.

1. Deixe o Wi-Fi marcado como **Rede particular**:
   *Configurações > Rede e Internet > Wi-Fi > (sua rede) > Rede particular*.
   Faça isso apenas na sua própria rede — em rede pública, deixe como está.
2. Dois cliques em **`Passo 1 - liberar celular.bat`** e clique **Sim** na janela
   de permissão do Windows. Só precisa uma vez.
3. Dois cliques em **`Passo 2 - abrir no celular.bat`**.
   A janela preta mostra o endereço em destaque, algo como `192.168.0.15:8765`.
4. No celular, no **mesmo Wi-Fi**, digite esse endereço no Chrome.
5. Menu do Chrome (⋮) → **Adicionar à tela inicial**. Aparece o ícone da AgroCR.

O computador precisa ficar ligado com a janela preta aberta.

### Caminho 2 — levar no celular, sem computador

Dois cliques em **`Gerar arquivo do celular.bat`**. Ele liga o servidor, traduz o
aplicativo, monta o arquivo e abre a pasta com ele selecionado. Leva uns 20 segundos.

Isso cria **`AgroCR-sozinho.html`** (~285 KB) com tudo dentro: React, logo e o app.
Mande para o celular por WhatsApp, e-mail ou cabo USB, e abra pelo
**Arquivos → Downloads → tocar no arquivo → abrir com Chrome**.

> **Por que existe esse passo de "traduzir".** O aplicativo é escrito em JSX, que o
> navegador não entende direto. Dava para mandar o tradutor (Babel, 2,8 MB) junto no
> arquivo, mas aí o celular de campo teria que traduzir 120 KB de código toda vez que
> abrisse — lento e pesado. Traduzindo antes, no computador, o arquivo fica **10 vezes
> menor** e abre na hora. Se você mexer no `agrocr-app.jsx`, rode o `.bat` de novo.

Funciona sem sinal nenhum. **Teste os dados antes de confiar:** cadastre uma fazenda,
feche o Chrome, abra de novo e veja se ela continua lá. Em alguns aparelhos o Android
limpa os dados de arquivos abertos direto do Downloads.

### E um app instalável de verdade?

Ícone próprio, tela cheia sem barra de endereço e funcionamento offline garantido
exigem **HTTPS** — regra do navegador, não dá para contornar em `http://192.168...`.
Os arquivos `manifest.webmanifest`, `sw.js` e os ícones já estão prontos aqui:
no dia em que o app for publicado num endereço `https://`, ele vira instalável
sem mexer em mais nada.

## Limpar os dados de teste

No navegador: F12 → Console → `localStorage.clear()` → Enter → recarregue.
