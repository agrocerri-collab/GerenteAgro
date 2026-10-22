// Gera web/pedido-fornecedor.xlsx — a planilha padrão que a consultoria/fazenda manda para o fornecedor
// preencher (pedido ou cotação). Formatada: título, blocos coloridos, campos amarelos para preencher, listas
// de escolha (pagamento, moeda, ciclo, cultura, categoria, unidade) e 50 linhas de itens.
// O app lê o arquivo devolvido com interpretarPedidoFornecedor (agrocr-app.jsx): os RÓTULOS da coluna A e os
// títulos da tabela de itens são o contrato — se mudar aqui, confira lá.
// Uso: ferramentas\node\node.exe ferramentas\gerar-planilha-fornecedor.js
const fs = require("fs"), path = require("path");
const archiver = require(path.join(__dirname, "cli/node_modules/archiver"));
const SAIDA = path.join(__dirname, "..", "web", "pedido-fornecedor.xlsx");

const CATEGORIAS = ["Herbicida", "Inseticida", "Fungicida", "Biológico", "Adjuvante", "Foliar", "Fertilizante / Adubo", "Tratamento de sementes", "Sementes", "Outro"];
const UNIDADES = ["L", "mL", "kg", "g", "t", "sc", "bag", "un"];
const CULTURAS = ["Soja", "Milho", "Algodão", "Sorgo", "Feijão", "Arroz", "Trigo"];
const N_ITENS = 50;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// estilos (índices de cellXfs em styles.xml)
const E = { padrao: 0, titulo: 1, secao: 2, rotulo: 3, campo: 4, dica: 5, cabTabela: 6, celTexto: 7, campoData: 8, campoNumero: 9, celNumero: 10, campoTexto: 11, aviso: 12 };
const linhas = [];   // { r, alt?, cels: [[col, valor|null, estilo]] }
const merges = [], validacoes = [];
const cel = (col, r, v, s) => (v == null || v === "" ? `<c r="${col}${r}" s="${s}"/>` : `<c r="${col}${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`);
const add = (r, cels, alt) => linhas.push({ r, alt, xml: cels.map(([c, v, s]) => cel(c, r, v, s)).join("") });
const faixa = (r, texto, estilo, alt) => { add(r, ["A", "B", "C", "D", "E", "F", "G", "H"].map((c, i) => [c, i === 0 ? texto : null, estilo]), alt); merges.push(`A${r}:H${r}`); };
const campo = (r, rotulo, estilo, dica, lista) => {
  add(r, [["A", rotulo, E.rotulo], ["B", null, estilo], ["C", null, estilo], ["D", null, estilo], ["E", null, estilo], ["F", dica || null, E.dica], ["G", null, E.dica], ["H", null, E.dica]], 21);
  merges.push(`B${r}:E${r}`, `F${r}:H${r}`);
  if (lista) validacoes.push(`<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" sqref="B${r}"><formula1>"${lista.join(",")}"</formula1></dataValidation>`);
};

faixa(1, "PEDIDO / COTAÇÃO DE INSUMOS", E.titulo, 34);
faixa(2, "Preencha os campos em AMARELO e devolva este arquivo (pode salvar em Excel mesmo). Não apague nem mude os títulos em cinza.", E.aviso, 30);

faixa(4, "1. FORNECEDOR", E.secao, 22);
campo(5, "Fornecedor (empresa)", E.campoTexto, "nome da revenda / empresa");
campo(6, "Nome do vendedor", E.campoTexto, "quem atende o pedido");
campo(7, "WhatsApp / telefone (com DDD)", E.campoTexto, "ex.: 63 99999-0000");
campo(8, "CNPJ (opcional)", E.campoTexto, "");

faixa(10, "2. PEDIDO", E.secao, 22);
campo(11, "Número do pedido", E.campoTexto, "número do pedido ou da cotação");
campo(12, "Data do pedido", E.campoData, "dd/mm/aaaa");
campo(13, "Ciclo", E.campoTexto, "escolha na lista: Safra, Safrinha ou Ambas", ["Safra", "Safrinha", "Ambas"]);
campo(14, "Cultura", E.campoTexto, "escolha na lista (vale para todos os itens)", CULTURAS);

faixa(16, "3. PAGAMENTO", E.secao, 22);
campo(17, "Forma de pagamento", E.campoTexto, "escolha na lista", ["À vista", "A prazo", "Na safra", "Barter"]);
campo(18, "Vencimento", E.campoData, "dd/mm/aaaa — só se for a prazo ou na safra");
campo(19, "Moeda", E.campoTexto, "R$ ou US$", ["R$", "US$"]);
campo(20, "Dólar do negócio", E.campoNumero, "só se o preço for em US$ (ex.: 5,40)");
campo(21, "Barter - total de sacas de soja", E.campoNumero, "só se for barter: quantas sacas pagam o pacote");
campo(22, "Barter - preço da saca travado", E.campoNumero, "opcional: preço da saca combinado");
campo(23, "Observações", E.campoTexto, "frete, local de entrega, prazo de entrega…");

faixa(25, "4. ITENS — um produto por linha", E.secao, 22);
const R_CAB = 26;
add(R_CAB, [["A", "Produto", E.cabTabela], ["B", "Categoria", E.cabTabela], ["C", "Quantidade", E.cabTabela], ["D", "Unidade", E.cabTabela], ["E", "Preço unitário", E.cabTabela], ["F", "Ciclo (opcional)", E.cabTabela], ["G", "Cultura (opcional)", E.cabTabela], ["H", "Observação", E.cabTabela]], 30);
for (let i = 1; i <= N_ITENS; i++) {
  const r = R_CAB + i;
  add(r, [["A", null, E.celTexto], ["B", null, E.celTexto], ["C", null, E.celNumero], ["D", null, E.celTexto], ["E", null, E.celNumero], ["F", null, E.celTexto], ["G", null, E.celTexto], ["H", null, E.celTexto]], 19);
}
const r1 = R_CAB + 1, rN = R_CAB + N_ITENS;
const lista = (col, itens) => `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" sqref="${col}${r1}:${col}${rN}"><formula1>"${itens.join(",")}"</formula1></dataValidation>`;
validacoes.push(lista("B", CATEGORIAS), lista("D", UNIDADES), lista("F", ["Safra", "Safrinha", "Ambas"]), lista("G", CULTURAS));

const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><selection activeCell="B5" sqref="B5"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols><col min="1" max="1" width="36" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="3" width="13" customWidth="1"/><col min="4" max="4" width="11" customWidth="1"/><col min="5" max="5" width="16" customWidth="1"/><col min="6" max="6" width="16" customWidth="1"/><col min="7" max="7" width="18" customWidth="1"/><col min="8" max="8" width="34" customWidth="1"/></cols>
<sheetData>${linhas.map((l) => `<row r="${l.r}"${l.alt ? ` ht="${l.alt}" customHeight="1"` : ""}>${l.xml}</row>`).join("")}</sheetData>
<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>
<dataValidations count="${validacoes.length}">${validacoes.join("")}</dataValidations>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/>
</worksheet>`;

const cor = (hex) => `<color rgb="FF${hex}"/>`;
const borda = `<border><left style="thin">${cor("B8C2CF")}</left><right style="thin">${cor("B8C2CF")}</right><top style="thin">${cor("B8C2CF")}</top><bottom style="thin">${cor("B8C2CF")}</bottom><diagonal/></border>`;
const xf = (font, fill, border, extra, numFmt) => `<xf numFmtId="${numFmt || 0}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${numFmt ? ' applyNumberFormat="1"' : ""} applyAlignment="1">${extra || '<alignment vertical="center"/>'}</xf>`;
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="7">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="16"/>${cor("FFFFFF")}<name val="Calibri"/></font>
<font><b/><sz val="11"/>${cor("FFFFFF")}<name val="Calibri"/></font>
<font><b/><sz val="11"/>${cor("17335F")}<name val="Calibri"/></font>
<font><i/><sz val="9"/>${cor("6B7785")}<name val="Calibri"/></font>
<font><b/><sz val="10"/>${cor("FFFFFF")}<name val="Calibri"/></font>
<font><b/><sz val="10"/>${cor("7A5C00")}<name val="Calibri"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF17335F"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2E8B57"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6CC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F7"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFBE6"/></patternFill></fill>
</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${borda}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
${xf(1, 2, 0, '<alignment horizontal="center" vertical="center"/>')}
${xf(2, 3, 0, '<alignment vertical="center" indent="1"/>')}
${xf(3, 5, 1, '<alignment vertical="center" indent="1"/>')}
${xf(0, 4, 1)}
${xf(4, 0, 0, '<alignment vertical="center" indent="1"/>')}
${xf(5, 2, 1, '<alignment horizontal="center" vertical="center" wrapText="1"/>')}
${xf(0, 6, 1, '<alignment vertical="center"/>', 49)}
${xf(0, 4, 1, '<alignment horizontal="left" vertical="center"/>', 14)}
${xf(0, 4, 1, '<alignment horizontal="left" vertical="center"/>', 4)}
${xf(0, 6, 1, '<alignment vertical="center"/>', 4)}
${xf(0, 4, 1, '<alignment vertical="center"/>', 49)}
${xf(6, 6, 0, '<alignment vertical="center" wrapText="1" indent="1"/>')}
</cellXfs>
</styleSheet>`;

// folha 2: como preencher
const ajuda = [
  ["COMO PREENCHER", E.titulo],
  ["1. Preencha os campos amarelos da folha \"Pedido\". Os campos com lista mostram uma setinha: escolha uma das opções.", E.padrao],
  ["2. Forma de pagamento: À vista, A prazo (boleto), Na safra ou Barter (troca por soja).", E.padrao],
  ["3. Se for BARTER: informe o total de sacas de soja do pacote; o preço da saca travado é opcional. O preço unitário dos itens pode ficar em branco.", E.padrao],
  ["4. Se for em DÓLAR: escolha US$ em Moeda, informe o dólar do negócio e coloque o preço unitário em dólar.", E.padrao],
  ["5. Itens: um produto por linha, com categoria, quantidade e unidade. Ciclo e cultura só se forem diferentes do que está no bloco 2.", E.padrao],
  ["6. Salve e devolva este mesmo arquivo (Excel .xlsx ou CSV). Não mude os títulos em cinza nem os títulos da tabela.", E.padrao],
  ["", E.padrao],
  ["Categorias: " + CATEGORIAS.join(" · "), E.dica],
  ["Unidades: " + UNIDADES.join(" · ") + "  (sc = saco · bag = big bag · t = tonelada · un = unidade)", E.dica],
];
const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<cols><col min="1" max="1" width="130" customWidth="1"/></cols>
<sheetData>${ajuda.map(([tx, s], i) => `<row r="${i + 1}" ht="${i === 0 ? 30 : 20}" customHeight="1">${cel("A", i + 1, tx, s)}</row>`).join("")}</sheetData>
</worksheet>`;

const arquivos = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pedido" sheetId="1" r:id="rId1"/><sheet name="Como preencher" sheetId="2" r:id="rId2"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  "xl/styles.xml": styles,
  "xl/worksheets/sheet1.xml": sheet1,
  "xl/worksheets/sheet2.xml": sheet2,
};
const saida = fs.createWriteStream(SAIDA);
const zip = archiver("zip", { zlib: { level: 9 } });
saida.on("close", () => console.log(`Gerado: ${SAIDA} (${Math.round(zip.pointer() / 1024)} KB)`));
zip.on("error", (e) => { throw e; });
zip.pipe(saida);
for (const [nome, conteudo] of Object.entries(arquivos)) zip.append(conteudo, { name: nome });
zip.finalize();
