# Publicação

Esta página cobre o que acontece quando uma obra sai da sua mesa: conferir uma nota antes de
publicar, exportar um conto ou um livro como manuscrito e acompanhar para onde você o
enviou. O Escrita nunca envia nada para lugar nenhum. Ele confere, grava um arquivo e
registra o que você disser.

Outras páginas: [Recursos e configurações](features-and-settings.md), [Escrita](writing.md) e
[O mundo](the-world.md). Cada parte tem o seu interruptor em Recursos › Publicação:
**Checagem de publicação**, **Exportar** e **Envios**.

- [Conferir uma nota e marcá-la como publicada](#conferir-uma-nota-e-marcá-la-como-publicada)
- [Enviar um conto a uma revista](#enviar-um-conto-a-uma-revista)
- [Exportar uma nota ou um livro](#exportar-uma-nota-ou-um-livro)
- [Registrar um envio](#registrar-um-envio)
- [Configurações](#configurações)
- [Comandos](#comandos)

## Conferir uma nota e marcá-la como publicada

Abra a nota e rode **Publicar esta nota** (ou escolha **Publicar…** no menu do arquivo). Uma
janela lista o que o Escrita encontrou. Ele lê o texto que você vê no editor, salvo ou não.

**Bloqueios** são coisas que o leitor notaria:

- Um comentário `%%` sem fechamento, que esconde tudo o que vem depois. Um número ímpar de
  `%%` dentro de um comentário `<!-- -->` fechado também conta. Um `%%` dentro de um bloco de
  matemática `$$` faz parte da fórmula, não é comentário.
- Um comentário `<!--` sem fechamento, no começo de uma linha (novo na 0.8). Um `<!--` no meio da linha é texto comum. O modo de leitura esconde o resto da
  nota, mas as palavras continuam contando.
- Um marcador esquecido no texto (a palavra do marcador é uma configuração, `XXX` por
  padrão).
- Uma nota sem texto.

**Avisos** não impedem nada:

- Um beat sem texto depois dele.
- Uma propriedade recomendada vazia (a lista é uma configuração).
- Uma peça acima do seu `limit`.

Cada linha diz o que está errado, e a linha que tem um lugar na nota traz o link **Ir para a
linha**. Sem bloqueios, basta apertar **Publicar**. Com bloqueios, marque **Publicar mesmo
assim**: o Escrita não conhece todos os casos, então a escolha é sua. Avisos nunca exigem
essa marca.

Publicar põe a propriedade de status na sua palavra para o estágio publicado, e a propriedade
de data em hoje. Você pode escolher outro dia, até um dia futuro. Se a nota já tem uma data,
o Escrita a mantém, a menos que você escolha uma aqui. Se Versões está ligado, ele guarda uma
versão antes (**Antes de publicar**). É preciso que a propriedade de status esteja definida
nas configurações.

**Despublicar esta nota** aparece para uma nota publicada. Ela devolve o status anterior, ou
a sua palavra para o estágio pronto, se o Escrita não souber qual era o anterior.

## Enviar um conto a uma revista

O caminho de sempre, com as três partes juntas:

1. Termine o conto e resolva o que o bloqueia. **Publicar esta nota** é opcional, e
   "publicado" pode não ser a palavra certa antes de a revista responder; você pode pular.
2. Abra o conto e rode **Exportar…**. Escolha **DOCX** e o modelo da revista: **Shunn** para
   um mercado em inglês, **pt-BR** para um brasileiro. Aperte **Prévia** para dar uma olhada,
   depois **Exportar**.
3. Mande o arquivo que está na pasta das exportações.
4. Rode **Registrar envio**. Diga para onde mandou. O Escrita cria uma nota para o envio, com
   o resultado ainda pendente.
5. Quando a resposta chegar, troque o `result` dessa nota por `accepted`, `rejected` ou outro
   dos seus valores, e preencha `responded`.

## Exportar uma nota ou um livro

Abra uma nota (ou um capítulo, ou a nota de um livro) e rode **Exportar…**, ou escolha
**Exportar…** no menu do arquivo. Dá para exportar qualquer nota Markdown, menos uma versão,
uma nota de envio ou um arquivo que já está na pasta das exportações.

A janela se chama **Exportar “Título”**. O que ela exporta depende de onde você a abriu:

- De uma nota fora de um livro (um conto, um ensaio): essa nota.
- Da nota de um livro: o livro inteiro.
- De um capítulo: uma linha **O quê** oferece **Este capítulo** ou **O livro inteiro**. Na
  primeira vez, ela vem em **O livro inteiro**.

**Capítulos** (num livro):
- **Todos (n)**: todos os capítulos.
- **Do … ao …**: um intervalo, por posição. De 1 ao 3 são os três primeiros capítulos.
- **Escolher…**: uma lista com uma marca para cada capítulo e os botões **Todos** e
  **Nenhum**. A linha embaixo diz, por exemplo, "3 de 12 escolhidos". Se não escolher
  nenhum, o Escrita diz "Nenhum capítulo escolhido", e **Exportar** espera.

Um capítulo cuja propriedade é `false` fica sempre de fora. A propriedade é uma configuração
(**Propriedade que deixa de fora**, `compile` por padrão), então `compile: false` nas
propriedades de um capítulo o deixa fora. A janela diz quantos ficam de fora e quais.

**Títulos dos capítulos.** Um capítulo com número recebe o título do modelo: "Capítulo 1 — A
chegada" (pt-BR) ou "Chapter 1: A chegada" (Shunn). Um capítulo sem número no nome, como um
"Prólogo" ou um "Epílogo", recebe só o seu título e não leva número. A numeração conta só os
capítulos numerados, então um Prólogo não desloca os números e um capítulo deixado de fora
não abre buraco. Os números são contados antes de o intervalo ou as marcas reduzirem a lista:
exportar os capítulos 5 a 7 mantém "Capítulo 5", "6" e "7". Se um capítulo não tem título
além do número, o título fica só "Capítulo 1". Um título no começo do capítulo que repete o
título do próprio capítulo é descartado, para não aparecer duas vezes (numa nota avulsa, um
título que repete o título da nota). Dá para mudar o
formato em **Título do capítulo** (veja Configurações).

**Dedicatória e epígrafe.** Na nota do livro, acrescente uma propriedade que aponta para uma
nota:

```
dedication: "[[Dedicatória]]"
epigraph: "[[Epígrafe]]"
```

O texto de cada nota ligada vira uma página própria, sem título, antes do primeiro capítulo.
A janela as cita na linha "Folha de rosto com…". Só um livro as tem. Uma nota avulsa tem só
a folha de rosto. Os nomes das propriedades são configurações.

**Formato.** **DOCX** (o padrão) ou **Markdown**.

**Modelo.** **Shunn** (Carta, inglês) ou **pt-BR** (A4, travessão). O que combina com o idioma
do Obsidian aparece primeiro e vem escolhido na primeira vez. Os dois têm o mesmo layout:

- Times New Roman, 12 pt, espaço duplo, margens de uma polegada, recuo de meia polegada na
  primeira linha.
- Uma folha de rosto, depois o texto. Uma nota avulsa começa abaixo do título, na primeira
  página.
- Um cabeçalho corrido a partir da página 2: Sobrenome / Título / número da página.
- `#` como quebra de cena, e uma marca de fim depois da última linha.
- Itálico e negrito mantidos, e travessões de diálogo mantidos como você os digitou.

Eles diferem nisto:

| | Shunn | pt-BR |
|---|---|---|
| Página | Carta (US Letter) | A4 |
| Título do capítulo | Chapter 1: Título | Capítulo 1 — Título |
| Assinatura | by Nome | por Nome |
| Contagem na folha de rosto | about 4,200 words | cerca de 4.200 palavras |
| Marca de fim | END | FIM |

O modelo não depende do idioma do Obsidian, então quem escreve em português pode mandar um
manuscrito Shunn para uma revista em inglês.

O Markdown usa só a assinatura, a quebra de cena e os títulos de capítulo do modelo. O layout
da página, o cabeçalho, a contagem e a marca de fim são do DOCX.

**A folha de rosto.** No DOCX, o alto à esquerda traz o seu nome e as suas linhas de contato,
e a **contagem arredondada** fica na margem direita, na primeira linha. O título e a
assinatura vêm abaixo. Num livro, é uma página só dela. A contagem é o tamanho medido da obra,
arredondado como se faz em manuscritos: para o múltiplo de 100 mais próximo abaixo de 10.000,
e para o de 500 mais próximo de 10.000 em diante (nunca menos de 100). É em palavras, ou em
caracteres para uma peça que conta caracteres.

**O que o manuscrito deixa de fora.** Comentários, beats e marcadores não vão para o arquivo,
e os links viram o texto deles. Itens incorporados (`![[…]]`) ficam de fora. Notas de rodapé
ficam como texto.

### Os avisos e "Exportar assim mesmo"

No alto da janela, uma caixa **Antes de enviar** lista o que o Escrita achou no texto que vai
exportar: marcadores esquecidos, um comentário sem fechamento (`%%` ou `<!--`: o resto da
nota some), beats sem texto depois e uma nota vazia. Ele confere todos os capítulos que você
escolheu, e cada item tem um link **Ir para a linha** que abre a nota ali. Um capítulo vazio
num livro não é problema. Uma nota avulsa vazia é.

Se houver qualquer coisa nessa lista, o botão principal diz **Exportar assim mesmo** em vez
de **Exportar**. Itens incorporados também aparecem, só para avisar que ficam de fora; eles
não mudam o botão.

### A prévia

**Prévia** mostra o documento como o arquivo vai ficar. Clique num parágrafo para abrir a nota
naquela linha (a dica diz "Abrir Título, linha 12"). **Voltar** retorna às opções. A
dedicatória, a epígrafe e o texto aparecem distintos. A prévia é só para olhar: nada é gravado
até você apertar **Exportar**.

### Para onde vai o arquivo

Para a **Pasta das exportações** (`Escrita/Exports` por padrão). Uma nota se chama `Título.md`
ou `Título (Shunn).docx` (`Título (pt-BR).docx`). O Escrita grava o arquivo e diz "Exportado:
nome", com o link **Abrir a pasta**.

Se já existe um arquivo com esse nome, o Escrita pergunta. **O arquivo já existe** oferece:

- **Cancelar**: nada é gravado.
- **Manter os dois**: o arquivo novo leva a data e a hora no nome, como
  `Título (Shunn) 2026-10-05 14h32.docx`.
- **Substituir**: só aparece quando o arquivo antigo está na pasta das exportações e é uma
  exportação do Escrita. Se o Escrita o registrou como a última exportação de uma obra, ele é
  sobrescrito. Se não, o arquivo antigo vai para a lixeira antes, para que um arquivo feito
  por você nunca se perca.

O Escrita nunca grava por cima de uma nota sua, e os arquivos da pasta das exportações nunca
entram nas suas metas nem viram obras.

### Exportar de novo

A janela lembra, para cada obra, o formato, o modelo e os capítulos, e mostra "Última
exportação: DOCX · Shunn · 12 capítulos · 3 out, 14:32" com o nome do arquivo (um link para
abri-lo; "(arquivo movido ou apagado)" quando ele não está lá). Ela tem um botão **Exportar de
novo**, e existe o comando **Exportar de novo**.

**Exportar de novo** repete a última exportação com as mesmas escolhas. Ele grava na hora, sem
janela, quando não há nada a confirmar e é o mesmo tipo de exportação: o livro inteiro, ou o
mesmo capítulo. Um capítulo exportado sozinho é repetido a partir desse capítulo. Fora isso,
abre a janela com essas escolhas, e o botão diz **Exportar assim mesmo** quando há avisos.

Ele só grava por cima do último arquivo se ele ainda estiver onde o Escrita o gravou, com o
mesmo nome. Se você o moveu ou renomeou, ou ele sumiu, o Escrita pergunta **Onde gravar**: "A
última exportação não está onde foi gravada. Gravar …?", com **Gravar** e **Cancelar**. Se
outro arquivo já tem o nome de sempre, aparece **O arquivo já existe** no lugar. A memória
acompanha se você renomeia ou move a obra ou um capítulo. Renomear a pasta das exportações no
Obsidian não conta como mover o arquivo: a configuração e a memória acompanham a pasta, e
Exportar de novo grava por cima do arquivo sem perguntar.

### Nome do autor, sobrenome e contato

Em Configurações › Escrita › Exportação:

- **Nome do autor** vai na folha de rosto e na assinatura.
- **Sobrenome do cabeçalho** é o "Sobrenome" do cabeçalho. Vazio usa a última palavra do
  nome.
- **Linhas de contato**: endereço, e-mail, telefone, uma por linha, no topo da folha de rosto.
- **Propriedade do autor** (`author` por padrão): uma propriedade de uma nota, ou da nota de
  um livro, que dá o autor daquela obra. Ela tem preferência sobre o nome acima. Para essa
  obra, o sobrenome é a última palavra desse nome.

## Registrar um envio

Rode **Registrar envio** (ou **Registrar envio…** no menu do arquivo) a partir de uma obra. Ele
pergunta:

- **Obra**: mostrada para você (o estágio e o tamanho). Você não a escolhe.
- **Para onde**: uma revista, um concurso, um editor. Os três lugares mais recentes aparecem em
  **Lugares recentes**: clique num para preencher.
- **Enviado em**: hoje, no formato `AAAA-MM-DD`. Mude se enviou antes.

Uma linha diz o que vai criar: "Cria … com …, …". **Registrar** precisa de um lugar e de uma
data de verdade.

**Qual obra ele escolhe.** A partir de um capítulo ou da nota de um livro, a obra é o livro. A
partir de uma nota fora de um livro, é a própria nota, quando ela é acompanhada e tem um
estágio (um conto marcado `rascunho`, por exemplo). Uma nota sem estágio diz "… não é uma
obra: dê a ela um estágio para registrar um envio." Uma nota de envio, uma exportação, uma
versão ou uma nota que não é Markdown diz "Abra um conto ou um livro para registrar um envio."

**A nota que ele cria.** Uma nota nova na **Pasta dos envios** (`Escrita/Submissions` por padrão), com
um nome como `2026-10-05 Cartas de Lisboa – Revista Pessoa.md`. Se o nome já existe, acrescenta
um número. Ela só tem propriedades, e o corpo fica vazio para você:

```
---
work: "[[Cartas de Lisboa]]"
market: "Revista Pessoa"
sent: 2026-10-05
result: pending
responded:
---
```

Os cinco nomes de propriedade são configurações. O `result` começa com o primeiro dos seus
**Valores do resultado**: `pending, accepted, rejected, withdrawn` por padrão, separados por
vírgula. Troque o resultado na nota por um dos outros quando receber a resposta, e preencha a
data em `responded`. Os resultados são comparados sem diferenciar maiúsculas.

Se você renomeia a obra, o Obsidian atualiza o link `work` e o envio continua apontando para
ela. Se você renomeia a pasta dos envios no Obsidian, a configuração acompanha.

**A contagem de pendentes.** Com Envios ligado, o bloco de obras mostra, ao lado da contagem de
prontos, quantos envios ainda têm o primeiro valor do resultado: "2 pendentes". Clique para
listá-los, do mais novo ao mais antigo, cada um com o lugar e a data, e clique num para abrir a
nota. Se o bloco de obras mostra só algumas pastas, ele conta só os envios das obras dessas
pastas. Desligue Envios e a contagem some.

**Tabelas.** O Escrita não tem uma tabela de envios. São notas comuns com propriedades, então
o Bases, o Dataview ou qualquer plugin que leia propriedades pode listá-las, por obra, por
lugar ou por resultado.

As notas da pasta dos envios, e os arquivos da pasta das exportações, nunca entram nas suas
metas e nunca viram obras. Se você já usa uma pasta com um desses nomes para outra coisa, mude
a pasta nas configurações. Uma pasta que já tem arquivos seus é recusada.

## Configurações

**Publicação** (Configurações › Escrita):

| Configuração | O que faz |
|---|---|
| Propriedade de data | A propriedade que recebe a data de publicação. `date` por padrão. |
| Propriedades recomendadas | Uma por linha. A checagem avisa quando alguma está vazia. `description` por padrão. Vazio não verifica. |

As palavras de status ficam em Estágios, e a propriedade de status em Livros.

**Exportação:**

| Configuração | O que faz |
|---|---|
| Pasta das exportações | Onde os manuscritos são gravados. `Escrita/Exports`. Fica em Propriedades e pastas e aparece mesmo com Exportar desligado. |
| Propriedade que deixa de fora | Um capítulo cuja propriedade é `false` fica de fora. `compile` por padrão. |
| Propriedade da dedicatória | Na nota do livro: um link para a nota que vira a página de dedicatória. `dedication`. |
| Propriedade da epígrafe | O mesmo, para a página da epígrafe. `epigraph`. |
| Propriedade do autor | Uma propriedade da obra que dá o autor dela. `author`. |
| Nome do autor | Na folha de rosto. |
| Sobrenome do cabeçalho | O "Sobrenome" do cabeçalho. Vazio usa a última palavra do nome. |
| Linhas de contato | Endereço, e-mail, telefone, uma por linha, no topo da folha de rosto. |
| Título do capítulo | Use `{n}` para o número e `{title}` para o título. Vazio usa o do modelo. |

**Envios:**

| Configuração | O que faz |
|---|---|
| Pasta dos envios | Uma nota por envio. `Escrita/Submissions`. Mudar não move as notas existentes. Fica em Propriedades e pastas e aparece mesmo com Envios desligado. |
| Valores do resultado | Separados por vírgula. O primeiro é "pendente". |
| Propriedade da obra | A propriedade da nota de envio que liga à obra. `work`. |
| Propriedade do destino | Para onde foi enviada. `market`. |
| Propriedade da data de envio | O dia do envio. `sent`. |
| Propriedade do resultado | O resultado. `result`. |
| Propriedade da data da resposta | O dia da resposta. `responded`. Vazia numa nota nova. |

Os cinco nomes de propriedade de envio têm de ser diferentes entre si. Se você digita um que
outra já usa, o campo volta ao valor antigo.

Uma linha de pasta recusa uma pasta que não é segura (veja
[Recursos e configurações](features-and-settings.md#linhas-de-pasta-e-como-os-campos-salvam)).
Os campos de texto salvam quando você sai deles.

## Comandos

| Comando | O que faz |
|---|---|
| Publicar esta nota | Confere a nota, depois define status e data. |
| Despublicar esta nota | Devolve o status anterior. Aparece para uma nota publicada. |
| Exportar… | Abre a janela de exportação da nota ativa ou do livro dela. |
| Exportar de novo | Repete a última exportação da obra. Aparece quando a obra tem uma. |
| Registrar envio | Cria uma nota de envio para a obra ativa. |

As mesmas ações estão no menu do arquivo: **Publicar…**, **Despublicar**, **Exportar…** e
**Registrar envio…**. O Escrita não define atalhos; associe os que você usa em Configurações ›
Atalhos.
