# Recursos e configurações

O Escrita tem muitos recursos, e a maioria das pessoas usa poucos. Desde a 0.7 você pode
desligar os que não usa. Um recurso desligado não é carregado: não acrescenta comandos,
painéis, itens de menu nem trabalho em segundo plano. Os seus dados ficam, e voltam quando
você liga o recurso de novo.

Outras páginas: [Primeiros passos](getting-started.md), [Escrita](writing.md), [Publicação](publishing.md), [Roteiros](screenplays.md) e [O mundo](the-world.md).

## Achar uma configuração

As configurações do Escrita aparecem na busca de configurações do Obsidian (Obsidian 1.13 ou
mais novo). Abra as Configurações, digite na caixa de busca no topo e toda linha do Escrita que
combinar aparece. Por exemplo, digite "pasta de capítulos" para achar essa linha. Clique num
resultado e o Obsidian leva você até ela. As linhas de um recurso desligado não aparecem,
porque o recurso não está carregado.

Cada seção da aba do Escrita é um cartão sob o próprio título: Recursos, Propriedades e pastas,
Livros, Formas, Novas obras, Metas, Publicação · a checagem, Exportação, Envios, Esboço, Marcadores, Darlings, Editor, Editor de roteiro,
Revisão · a lente, Estágios, Nota inicial, Versões e Universo. A seção de um recurso desligado
some até você ligar o recurso de novo.

## A página Recursos

Abra Configurações › Escrita. A seção **Recursos** fica no topo. Ela tem:

- **Ponto de partida**: quatro botões de predefinição e uma etiqueta. Veja "Pontos de partida"
  abaixo.
- **Idioma da escrita**. Automático segue o idioma do Obsidian: qualquer português dá pt-BR e
  qualquer inglês dá inglês. Outro idioma dá nenhum. A lente de revisão e o reconhecimento de
  nomes leem esse idioma. (Antes ele ficava na seção Revisão.)
- **Vinte interruptores em cinco grupos**, cada um com uma linha sobre o que faz. Os
  estágios ficam sempre ligados, porque o esboço, a aba Obras e a checagem de publicação leem
  os estágios.

| Grupo | Interruptores |
|---|---|
| Escrita | Metas e sprints · Esboço e beats fantasmas · Marcadores · Enter e tipografia · Editor de roteiro · Foco no diálogo · Mover parágrafo ou cena · Inserir de um modelo · Ortografia sob demanda · Contagens no explorador |
| Revisão | Lente de revisão · Versões · Darlings |
| Acompanhamento | Versão a cada estágio · Bloco de obras e onde você parou |
| Publicação | Checagem de publicação · Exportar · Envios |
| O mundo | Universo compartilhado · Threads |

Três interruptores eram configurações antes da 0.7, e agora ficam só aqui: **Contagens no
explorador**, **Ortografia sob demanda** e o modo do **Universo compartilhado**. A linha do
universo é uma lista (Desligado, Por livro, Universo) em vez de um interruptor, porque o modo
é o interruptor.

Quando você atualiza de uma versão anterior, todos os recursos continuam ligados, então
nada some até você escolher. A única exceção é o **Editor de roteiro**, novo na 1.2: ele vem
**desligado**, a não ser que todos os outros interruptores estejam ligados (como em **Tudo**),
e então vem ligado, para o conjunto continuar valendo como Tudo. Uma instalação nova começa no
ponto de partida Escritor (abaixo).

## Pontos de partida

Você não precisa acertar vinte interruptores um a um. Acima deles, **Ponto de partida**
tem quatro botões: **Essencial**, **Escritor**, **Roteirista** e **Tudo**. Cada um é uma lista de recursos. Uma
predefinição é só um ponto de partida, nunca um modo: o Escrita não guarda qual botão você
apertou, e depois dela você pode mudar qualquer interruptor.

| Ponto de partida | Interruptores que liga |
|---|---|
| Essencial (9) | Metas e sprints · Esboço e beats fantasmas · Marcadores · Enter e tipografia · Lente de revisão · Darlings · Versões · Exportar · Bloco de obras e onde você parou |
| Escritor (16) | Tudo do Essencial, mais Foco no diálogo · Mover parágrafo ou cena · Inserir de um modelo · Contagens no explorador · Versão a cada estágio · Checagem de publicação · Envios |
| Roteirista (11) | Só o que serve a um roteiro: Metas e sprints · Esboço e beats fantasmas · Marcadores · Editor de roteiro · Lente de revisão · Versões · Darlings · Versão a cada estágio · Bloco de obras e onde você parou · Exportar · Envios |
| Tudo (19) | Todos os interruptores menos o universo: acrescenta ao Escritor a Ortografia sob demanda, as Threads e o Editor de roteiro |

O Roteirista não é o Escritor mais alguma coisa: deixa de fora o que atrapalha num roteiro. O **Enter e tipografia** fica desligado porque o Enter tem fluxo próprio num roteiro e a tipografia inteligente trocaria o `--` que os roteiros mantêm por travessões. O **Foco no diálogo**, **Mover parágrafo ou cena** e **Inserir de um modelo** são da prosa. As **Contagens no explorador** contam palavras, e um roteiro se conta em páginas. A **Ortografia sob demanda**, a **Checagem de publicação** e as **Threads** são da prosa e do universo. O universo não muda, como em toda predefinição.

Uma predefinição desliga todo interruptor que não está na lista dela. Apertar um botão ainda
não muda nada. Abre uma etapa de confirmação, **Aplicar "Escritor"?**, com duas linhas:
**Desliga** e **Liga**, cada uma com os interruptores que mudariam. Aperte **Aplicar** para
salvar, ou **Cancelar** para deixar tudo como está. Se os interruptores já combinam, a página
diz: Já está em "Escritor". Nada muda. E não há o que confirmar. A nota abaixo das listas
lembra que os dados de quem desliga ficam guardados (veja "Que dados ficam", abaixo).

**A etiqueta.** Ao lado do título, uma etiqueta pequena diz com qual ponto de partida os seus
interruptores combinam agora: Essencial, Escritor, Roteirista ou Tudo. Se não combinam com nenhum, porque
você mudou um interruptor ou veio de uma versão antiga, a etiqueta diz **Personalizado**.
Personalizado não é problema e nada muda sozinho. Só diz que o conjunto é seu. A etiqueta é
calculada toda vez que a página é desenhada, a partir dos interruptores.

**Uma predefinição nunca muda o universo.** A linha do Universo compartilhado é um modo
(Desligado, Por livro, Universo), e um modo move pastas, então é sempre escolha sua, na seção
Universo. A predefinição deixa o modo como está, nunca o lista na confirmação e o ignora ao
calcular a etiqueta. Por isso Tudo diz "19" aqui: o universo é o vigésimo interruptor, e a
preparação o conta como "20 de 20" porque o oferece como escolha separada (**Mundo
compartilhado**). Ao escolher Tudo, uma lembrança abaixo das listas diz que o modo do universo
continua o que está.

**Instalação nova e atualização.** Uma instalação nova começa no Escritor. Uma instalação que
já tem configurações do Escrita mantém cada interruptor como estava: atualizar não desliga
nada. Uma instalação 0.9 com todos os interruptores ligados aparece como **Tudo**, e ganha o Editor de roteiro ligado junto. Uma com os
padrões antigos aparece como **Personalizado**, porque a ortografia sob demanda vem desligada
por padrão.

**O link da preparação.** Abaixo dos quatro botões, um link discreto, **Preparar o cofre para
escrever**, abre a preparação, que também pode escolher um ponto de partida, criar pastas e
notas de exemplo e definir o layout. Ele só aparece enquanto você não tem nota inicial. Depois
que tiver uma, use o comando de mesmo nome. A preparação é explicada em
[Primeiros passos](getting-started.md).

## O idioma dos padrões

O Escrita escreve algumas palavras nas suas notas e lê outras como nomes de pastas e notas: as
palavras dos estágios, a pasta dos capítulos, os títulos que não levam número de capítulo, os
resultados de um envio, as pastas de exportações, envios e versões, a nota do universo e as
palavras dos tipos, os valores de forma, as palavras de roteiro e as palavras das threads. Tudo isso são configurações, e
elas partem de um conjunto de padrões num idioma. Desde a 1.0 há dois conjuntos, **English** e
**Português (Brasil)**. A preparação mostra a escolha como **Idioma dos padrões**.

- **Uma instalação nova usa o idioma do Obsidian**, uma vez: qualquer português escolhe o
  conjunto brasileiro, qualquer outro idioma escolhe o inglês. A escolha é salva, então mudar
  o idioma do Obsidian depois não mexe nas suas palavras.
- **Uma instalação que já tem configurações continua em inglês.** Atualizar da 0.9 não muda
  nenhuma palavra, porque o seu cofre já depende delas.
- **Depois, só a preparação muda o idioma**, e só quando você marca essa opção.

O que o conjunto brasileiro contém:

| Configuração | English | Português (Brasil) |
|---|---|---|
| Palavras dos estágios | idea, draft, revision, ready, published | ideia, rascunho, revisão, pronto, publicado |
| Pasta dos capítulos | Chapters | Capítulos |
| Capítulos sem número | Prologue, Preface, Foreword, Introduction, Interlude, Epilogue, Afterword | Prólogo, Prefácio, Apresentação, Introdução, Nota do autor, Interlúdio, Epílogo, Posfácio |
| Resultados de envio | pending, accepted, rejected, withdrawn | pendente, aceito, recusado, retirado |
| Pasta das exportações | Escrita/Exports | Escrita/Exportações |
| Pasta dos envios | Escrita/Submissions | Escrita/Envios |
| Pasta das versões | Escrita/Snapshots | Escrita/Versões |
| Pastas ignoradas | Templates | Modelos |
| Nota do universo | Universe.md | Universo.md |
| Tipos de entrada e pastas | character (Characters), place (Places), object (Objects), group (Groups), event (Events) | personagem (Personagens), lugar (Lugares), objeto (Objetos), grupo (Grupos), evento (Eventos) |
| Valores de forma | short story, essay, novella, novel, poem, fragment, screenplay | conto, ensaio, novela, romance, poema, fragmento, roteiro |
| Palavras de roteiro (Finais de transição, Rótulo de continua, Rótulo de continuação, Linha de crédito) | TO:, (MORE), (CONT'D), Written by | TO:, PARA:, (MAIS), (CONT.), Roteiro de |
| Palavras das threads | thread, closed | thread, fechada |

As notas de darlings mantêm o nome `Darlings.md` nos dois. Os **nomes das propriedades**
(`status`, `target`, `type` e as demais) não estão em nenhum conjunto: são chaves nas suas
notas e continuam em inglês. Todo valor continua sendo uma configuração que você pode mudar, e
números e interruptores são iguais nos dois conjuntos. A pasta das versões e a pasta ignorada
só são definidas numa instalação nova. A preparação nunca as muda, porque apontam para lugares
que já existem.

Esta é uma configuração diferente do **Idioma da escrita**. O idioma da escrita decide quais listas
de palavras a lente de revisão e o reconhecimento de nomes leem. O idioma dos padrões decide
as palavras que o Escrita escreve no seu cofre.

## O que cada interruptor desliga

| Interruptor | Desligado significa |
|---|---|
| Metas e sprints | Sem contagem de palavras escritas, meta diária, janela de progresso, sprints nem barra de status. As configurações dele se escondem. |
| Esboço e beats fantasmas | Sem painel do esboço, sem beats fantasmas no editor, sem comandos de beat, sem **Ler o livro** nem **Ler esta nota**. Também somem o comando **Novo livro**, a escolha Livro em **Nova obra…**, o botão **+ Novo livro** do bloco de obras e as linhas Pasta dos livros e Modelo da nota do livro. |
| Marcadores | Sem pílulas de marcador, pontos no explorador, painel nem selo no esboço. (A checagem de publicação continua parando num marcador esquecido numa nota, enquanto a Publicação estiver ligada.) |
| Enter e tipografia | O Enter não faz quebras de cena nem capítulos; sem travessões e aspas automáticos. |
| Editor de roteiro | As notas de roteiro voltam a ser texto Fountain puro: sem colunas, sem os passos de Tab e Enter, sem maiúsculas ao digitar, sem sugestões, sem marcas forçadas, e os dois comandos de elemento somem. Exportar um roteiro continua funcionando. |
| Foco no diálogo | O comando e o esmaecimento somem. |
| Mover parágrafo ou cena | Os quatro comandos de mover somem. |
| Inserir de um modelo | O comando some. (O universo continua usando a pasta de modelos.) |
| Ortografia sob demanda | O comando que liga e desliga some. |
| Contagens no explorador | Sem contagens, totais de pasta nem metas ao lado dos nomes. |
| Lente de revisão | Sem lente, painel, comandos de percorrer nem itens de menu. A regra de nomes e "Não são nomes" também se escondem. |
| Versões | Sem comandos de versão, tela de comparar, versões automáticas nem "versão antes de publicar". |
| Darlings | Sem "Mover seleção para os darlings", painel nem restaurar. |
| Versão a cada estágio | Uma mudança de estágio não guarda versão. |
| Bloco de obras e onde você parou | O bloco `escrita-works` aparece como código simples; o Escrita para de registrar onde você parou; sem comando da nota inicial nem abrir ao iniciar. |
| Checagem de publicação | Sem os comandos de publicar, despublicar e **Publicar o próximo capítulo**. |
| Exportar | Sem os comandos **Exportar…** e **Exportar de novo**, sem item no menu do arquivo (nem **Criar uma coleção…**) e sem a seção Exportação nas configurações, grupo **Roteiros** incluído. A linha da pasta das exportações continua, e as linhas de **Formas** também. |
| Envios | Sem o comando nem o item de menu **Registrar envio**, sem a contagem de pendentes no bloco de obras e sem a seção Envios nas configurações. A linha da pasta dos envios continua. |
| Universo compartilhado | Sem painel, sem comandos do universo, sem "Aparece em", sem marcas de nomes nem nomes na lente. |
| Threads | Sem comandos de thread, sinal na margem nem aba no painel. |

Os contos nunca se desligam. **Nova obra…**, **Novo conto** e **Novo roteiro** são comandos do núcleo, como a preparação, então ficam mesmo com todos os recursos desligados.

Ao desligar um recurso, um aviso curto diz o que fica e onde.

## Que dados ficam

Nada é apagado quando você desliga um recurso.

- **Versões**: os arquivos ficam na sua pasta de versões. O aviso diz o nome dela e quantas
  são.
- **Darlings**: os trechos cortados ficam nas suas notas. Ligue de novo para restaurá-los.
- **Metas**: o seu histórico de escrita fica nos dados do Escrita (o aviso diz quantos dias).
- **Lente**: as suas listas de palavras ficam na nota delas.
- **Acompanhamento**: o ponto onde você parou fica nos dados do Escrita.
- **Esboço**: o ponto onde você parou em "Ler o livro" fica nos dados do Escrita e acompanha renomeações.
- **Lente de revisão**: a lista "Não são nomes" fica nas configurações.
- **Exportar**: as notas de coleção são notas comuns e ficam. Os arquivos já gravados (EPUB também) ficam na pasta das exportações. As suas escolhas para cada obra (formato, modelo, capítulos) e a última exportação ficam nos dados do Escrita, e acompanham renomeações e mudanças de lugar com o recurso desligado. Ligue de novo e "Exportar de novo" ainda conhece o último arquivo.
- **Envios**: as notas de envio ficam onde estão, na pasta dos envios. O aviso diz o nome da pasta e quantas notas há. São notas comuns: com o recurso desligado elas continuam sem entrar nas metas e sem virar obras. Se você já usa esse nome de pasta para outra coisa, mude a pasta nas configurações.
- **Threads**: os marcadores ficam nas suas notas; as datas em que cada um foi visto pela
  primeira vez ficam nos dados.
- **Universo**: as entradas são notas comuns, então nunca são tocadas. As cores escolhidas
  para os pontos de vista ficam nos dados.

Dados ligados a um caminho acompanham renomeações enquanto o recurso está desligado. Se você
renomeia uma nota ou uma pasta com o recurso de acompanhamento desligado, o registro de "onde
você parou" e as versões continuam seguindo, então ligar o recurso depois os encontra. Para as
versões, isso inclui mover os arquivos de versão no disco.

## Dependências

- **Versão a cada estágio precisa de Versões.** Enquanto Versões está desligado, o
  interruptor da versão a cada estágio fica acinzentado, com um botão **Ligar Versões**. A sua
  escolha para ele é guardada e volta quando Versões volta.
- **O bloco de obras só mostra pendentes enquanto Envios está ligado.** É o número de envios que ainda esperam resposta, ao lado da contagem de prontos. Desligue Envios e a contagem some.
- **Exportar funciona sem a Publicação, e a Publicação sem Exportar.** Exportar avisa dos mesmos problemas da checagem de publicação (marcador esquecido, comentário que nunca fecha, beats sem texto, nota vazia), por conta própria.
- **A publicação funciona sem versões.** Ela só não guarda versão antes de publicar.
- **O esboço funciona sem marcadores.** Ele não mostra a contagem de marcadores.
- **As configurações seguem os interruptores.** Uma configuração se esconde quando todos os
  recursos que a leem estão desligados. Uma configuração que outro recurso lê continua à
  vista: o marcador de pendência fica enquanto a Publicação está ligada, e a pasta de modelos
  fica enquanto Inserir de um modelo ou o universo está ligado.
- **Nomes compartilhados ficam à vista.** Os nomes das propriedades (meta, limite, unidade,
  prazo, meta do livro, ponto de vista, meta dos capítulos), as pastas acompanhadas e
  ignoradas e a pasta de capítulos ficam numa seção sempre visível, **Propriedades e pastas**,
  porque vários recursos as leem. Desde a 0.8, as linhas **Pasta das exportações** e **Pasta dos
  envios** também ficam ali, e aparecem mesmo com Exportar ou Envios desligado, porque as
  pastas continuam valendo: as notas dentro delas nunca entram nas metas e nunca viram obras.
  Uma linha de pasta só salva uma pasta segura (veja abaixo).
- **Capítulos sem número** (Configurações, Livros) é lida por Exportar e pelo esboço: uma lista
  de títulos (Prólogo, Interlúdio, Epílogo…) que saem na exportação só com o título e não
  mostram número no esboço. Os demais são contados a partir de 1.

## Configurações da 0.9

Estas configurações pertencem a um recurso. Elas se escondem quando o recurso está desligado.

| Configuração | Recurso | O que faz |
|---|---|---|
| Nomes sem entrada (uma regra, na seção Revisão · a lente) | Lente de revisão | Desligada por padrão. Marca nomes recorrentes com inicial maiúscula que não têm entrada. Precisa de um modo de universo. |
| Não são nomes | Lente de revisão | Palavras que a regra nunca marca, uma por linha. **Dispensar** no painel da lente acrescenta uma palavra. |
| Propriedade da capa | Exportar | A propriedade da nota do livro que liga a capa do EPUB (JPEG ou PNG). `cover`. |
| Separador de cena no EPUB | Exportar | A linha que o EPUB mostra entre cenas. `* * *`. |
| Propriedade da coleção | Exportar | A propriedade de uma nota que lista contos na ordem de leitura. `contents`. |

Dois comandos chegam com a 0.9 e não têm configuração. **Ler o livro** pertence a Esboço e beats
fantasmas. **Publicar o próximo capítulo** pertence a Checagem de publicação. O botão **Publicar o
próximo** no cabeçalho do esboço só aparece com os dois ligados. As menções sem link não têm
interruptor próprio: fazem parte do Universo compartilhado, então somem quando o universo está
desligado.

## Configurações da 1.0.4

A seção **Novas obras** vem depois de Livros. Ela define onde **Nova obra…**, **Novo conto**, **Novo roteiro** e **Novo livro** criam notas, e qual modelo seu eles usam. Fica sempre à vista, exceto as duas linhas do livro, que se escondem quando Esboço e beats fantasmas está desligado. Nada aqui é sobrescrito: uma nota que já existe fica como está.

| Configuração | Precisa de | O que faz |
|---|---|---|
| Pasta dos contos | | Onde **Novo conto** cria a nota. Vazia por padrão: a pasta ao lado do livro aberto quando um capítulo ou a nota do livro está aberto, senão a pasta da nota aberta (a raiz do cofre sem nenhuma nota aberta). |
| Modelo de conto | | Uma nota sua no lugar do modelo embutido. `{{title}}`, `{{date}}` e `{{time}}` são preenchidos, e um status de rascunho é acrescentado quando não há. Vazio por padrão (embutido). Se a nota não for encontrada, vale o modelo embutido, com um aviso. |
| Pasta dos roteiros | | Onde **Novo roteiro** cria a nota. Vazia por padrão, com a mesma regra da linha acima. |
| Modelo de roteiro | | Uma nota sua no lugar da nota de roteiro embutida (status de rascunho, a forma roteiro, um beat). `{{title}}`, `{{date}}` e `{{time}}` são preenchidos, e um status de rascunho é acrescentado quando não há. Vazio por padrão (embutido). |
| Pasta dos livros | Esboço | Onde **Novo livro** cria a pasta do livro. Vazia por padrão, com a mesma regra da linha acima. |
| Modelo da nota do livro | Esboço | Uma nota sua no lugar da nota de livro embutida. Vazio por padrão (embutido). O primeiro capítulo segue o modelo de capítulo. |

A preparação preenche as duas linhas de pasta com as pastas que ela cria, mas só enquanto estiverem vazias. Os comandos são explicados em [Escrita](writing.md).

## Configurações acrescentadas na 1.1

**Formas** é um grupo novo depois de Livros. Ele tem **Propriedade de forma**, **Valores de forma**
e **Forma por pasta**, que ficavam na seção Universo. Fica sempre à vista, e as linhas agora valem
com o universo desligado. Nada do que você salvou muda. Roteiro é o sétimo valor de forma
(`screenplay`, ou `roteiro` numa instalação em português), e uma lista de seis palavras salva
antes da 1.1 ganha esse valor sozinha.

**Roteiros** é um grupo novo na seção Exportação, que aparece enquanto a Exportação está ligada.
Tem nove linhas: começos de cabeçalho de cena, finais de transição, tamanho da página, números de
cena, os dois rótulos de quebra de página, a linha de crédito e duas propriedades da folha de
rosto. O autor e o contato da folha de rosto são as linhas de Exportação que já existem. Tudo está
em [Roteiros](screenplays.md#configurações).

## Configurações acrescentadas na 1.2

O **Editor de roteiro** é um interruptor novo no grupo Escrita, e com ele vem uma seção nova
depois do Editor. Ela aparece enquanto o interruptor está ligado. O interruptor vem ligado só em
**Roteirista** e **Tudo**.

| Configuração | Recurso | O que faz |
|---|---|---|
| Fonte | Editor de roteiro | **Courier** (Courier Prime, se estiver instalada) ou **Fonte do tema**. Courier. |
| Horas do dia | Editor de roteiro | As palavras oferecidas depois de ` - ` num cabeçalho de cena. `DAY, NIGHT, CONTINUOUS, LATER` (`DIA, NOITE, CONTÍNUO, MAIS TARDE` numa instalação em português). |
| Mostrar o ritmo | Lente de revisão | Mostra a seção Ritmo no painel da lente. Ligada. |

### O editor de roteiro

O editor monta uma nota de roteiro na Visualização ao vivo e dá a Tab e Enter os significados de
roteiro. Ele age só numa nota cuja forma é `screenplay` (`roteiro`). Como escrever com ele está
em [Roteiros](screenplays.md#escrever-no-editor), e a seção Ritmo em
[Revisão](revision.md#ritmo).

Ele não precisa de nenhum outro interruptor. Com o universo ligado, também oferece os nomes do
universo para um nome de personagem. O **fluxo do Enter** da prosa e o **foco no diálogo** não
fazem nada numa nota de roteiro, com este interruptor ligado ou não.

**Ler esta nota** é um segundo comando de leitura, ao lado de **Ler o livro**. Pertence ao mesmo
interruptor, Esboço e beats fantasmas. Veja [Escrita](writing.md#ler-esta-nota).

## Linhas de pasta e como os campos salvam

A pasta das exportações (padrão `Escrita/Exports`), a pasta dos envios (padrão `Escrita/Submissions`)
e a pasta das versões são lugares do próprio Escrita. Elas não podem conter umas às outras
nem ficar uma dentro da outra. O campo de pasta ganha um contorno e um aviso aparece embaixo da
descrição da configuração, e o valor salvo continua, quando o novo é:

- uma pasta que não é simples dentro do cofre (sem `..` nem `.` no caminho);
- dentro da pasta de configurações do Obsidian, dentro ou em volta de uma pasta acompanhada,
  ou dentro de um livro;
- uma pasta que tem um livro dentro;
- outra pasta do Escrita, ou uma que contém uma delas;
- uma pasta que já tem arquivos seus (a pasta que o Escrita já usa para essa configuração
  não conta, porque só tem os arquivos dele).

Mudar a pasta não move os arquivos que já estão lá. Se você renomeia a pasta no Obsidian, a
configuração acompanha.

Os campos de texto das configurações agora salvam quando você sai do campo (ou aperta Enter),
e não a cada tecla. Um campo de nome de propriedade ou de pasta deixado vazio volta ao padrão.

## A seção Editor

Desde a 0.8, a seção Editor lista primeiro as linhas de digitação (Enter, Enter, Enter,
tipografia inteligente, onde ela vale, travessão de diálogo) e depois **Parágrafos são
separados por** (estilo de parágrafo) e **Aspas** (estilo de aspas). Essas duas linhas são
compartilhadas com o foco no diálogo, o mover blocos e a lente de revisão, então aparecem
enquanto qualquer um deles está ligado.

## Ligar e desligar um recurso enquanto você escreve

Não precisa reiniciar o Obsidian. Ligue um recurso e ele volta uma vez só, com os comandos,
painéis e itens de menu, e a sua aba não se mexe. Algumas sobras são coisa do Obsidian e
somem quando você reinicia:

- **O ícone da barra lateral fica.** Um recurso desligado mantém o ícone na faixa da
  esquerda até a próxima reinicialização. Clicar nele mostra "Este recurso está desligado.
  Ligue-o nas configurações do Escrita." Se o Obsidian abre com o recurso desligado, o ícone
  nem é acrescentado.
- **Os painéis fecham.** Os painéis do recurso fecham quando você o desliga. Se você reinicia
  com um recurso desligado e o painel dele estava aberto, o painel fecha na abertura.
- **Os comandos saem da paleta.** Eles também saem da lista de atalhos. Os atalhos que você
  mesmo definiu são mantidos e voltam a funcionar quando o recurso volta.
- **No celular, a barra de ferramentas móvel guarda um botão morto.** Se você fixou um
  comando do recurso na barra de ferramentas móvel, o botão fica, sem fazer nada, até você
  reiniciar o Obsidian. Se você edita a barra de ferramentas enquanto o recurso está
  desligado, o item fixado é descartado de vez; fixe-o de novo depois de ligar o recurso.

## Versão mínima do Obsidian

A partir da 1.0.3, o Escrita exige o Obsidian **1.13** ou mais novo, por causa da busca de
configurações. Um Obsidian mais antigo continua com a última versão que ele consegue rodar
(1.0.2). Antes disso, remover comandos durante o uso exigia a 1.7.2, que a 0.7 do Escrita pedia.

## Quando algo parece errado

| Você vê | Por quê | O que fazer |
|---|---|---|
| Falta um comando | O recurso dele está desligado | Ligue na seção Recursos |
| O bloco de obras não mostra pendentes | Envios está desligado, ou nada espera resposta | Ligue Envios |
| Falta uma configuração | Todos os recursos que a leem estão desligados | Ligue um; a configuração volta |
| Um ícone da lateral diz que o recurso está desligado | Você o desligou nesta sessão | Ligue o recurso, ou reinicie para tirar o ícone |
| O interruptor da versão a cada estágio está cinza | Versões está desligado | Clique em **Ligar Versões** |
| O bloco inicial aparece como código | O acompanhamento está desligado | Ligue "Bloco de obras e onde você parou" |
