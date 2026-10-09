# O mundo: o universo compartilhado, "Aparece em", threads e modelos

Como usar o universo (0.6), o que a 0.7 acrescenta e como configurar tudo. O README lista
cada recurso e cada configuração; este guia percorre os recursos na ordem em que você os
encontra. Outras páginas: [Recursos e configurações](features-and-settings.md) e
[Escrita](writing.md). Os nomes aparecem em português (pt-BR), como na interface.

Tudo aqui é opcional. O universo vem desligado, threads e modelos não fazem nada até você usar,
e nenhum recurso escreve numa nota sem um clique.

## 1. Escolha um modo

Configurações › Escrita › Recursos › **Universo compartilhado**. Desde a 0.7, o modo é o
interruptor do universo na página Recursos, então não há mais uma configuração de modo na
seção Universo:

| Modo | Escolha quando | Onde ficam as entradas |
|---|---|---|
| **Desligado** (padrão) | Você não quer personagens e lugares acompanhados | Em lugar nenhum. O universo não é carregado: sem painel, sem comandos do universo, sem "Aparece em". As threads continuam funcionando. |
| **Por livro** | Cada romance tem o seu elenco | Dentro de cada livro: `<Livro>/Personagens/`, `<Livro>/Lugares/`… |
| **Universo** | Histórias compartilham personagens e lugares | Numa pasta compartilhada, ao lado da nota do universo |

Trocar de modo nunca move nem edita notas. Voltar para Desligado só descarrega o recurso e
esconde as coisas; suas entradas continuam no cofre.

## 2. Monte um universo (modo Universo)

1. **Nota do universo**: uma nota que dá nome ao universo, por exemplo `Universo.md`. A pasta
   ao lado dela, com o mesmo nome (`Universo/`), guarda as entradas. Não há uma configuração
   de pasta separada. Clique em **Criar** se a nota ainda não existir; o painel do universo
   oferece o mesmo botão.
2. **Pastas no universo**: pastas cujas obras entram no universo sem nenhuma propriedade.
   Uma por linha.
3. **Tipos de entrada**: cinco tipos fixos (personagem, lugar, objeto, grupo, evento). Para
   cada um, defina a palavra que você escreve na propriedade de tipo, a pasta onde nascem as
   entradas novas, uma nota modelo opcional e o nome mostrado nos menus. Você pode renomear os
   tipos, mas não acrescentar nem remover.
4. **Propriedade de forma e Forma por pasta**: que tipo de obra uma nota é (conto, ensaio,
   novela, romance, poema, fragmento), usado para agrupar a aba Obras. Veja a seção 6.
5. **Palavra das threads** e a palavra de fechada: as palavras nos marcadores de thread. Veja
   a seção 7.

### Escolhendo as pastas no universo: só a ficção que se passa no seu mundo

Uma pasta nesta lista puxa **todas as obras dela** para o universo: qualquer nota com um
`status` (um estágio conhecido) conta como obra ali. Coloque só as pastas cujas histórias
acontecem no seu mundo. Ensaios, crônicas e diários geralmente não pertencem.

Exemplo: com `Contos`, `Textos` e `Romances` na lista, um ensaio em `Textos/Noite.md` com
`status: rascunho` aparece na aba Obras, mesmo sem propriedade `universe` nem de tipo. A
solução é listar só as pastas de ficção:

```
Contos
Romances
```

"Forma por pasta" é outra configuração: `Textos: ensaio` ali só rotula os ensaios como
ensaios. Ela nunca puxa uma pasta para o universo.

### O que pertence a um universo

Uma nota pertence a um universo quando vale a primeira destas regras:

0. Ela tem `universe: false`. Fica de fora, aconteça o que acontecer (veja abaixo).
1. Ela tem a sua própria propriedade `universe` com um link para a nota do universo
   (`universe: "[[Universo]]"`).
2. Ela é um capítulo, ou outro arquivo de um livro, e a nota do livro tem essa propriedade.
3. Ela está dentro da pasta do universo (`Universo/`), ou é a nota do universo.
4. Ela está dentro de uma das pastas no universo.

A propriedade do próprio arquivo vale mais que a do livro. Uma nota que não cumpre nenhuma
dessas regras é avulsa: não está em universo nenhum.

### Deixando uma nota de fora: `universe: false`

Digamos que um ensaio esteja em `Contos/`, uma pasta que você listou em "Pastas no universo",
mas ele não se passa no seu mundo. Acrescente isto às propriedades dele:

```
universe: false
```

A nota passa a ser avulsa. Os nomes dela não contam como menções, o texto dela não alimenta
a lente com nomes, e o botão **Adicionar ao …** do painel não aparece para ela, porque você
escolheu deixá-la de fora. Tire a propriedade e tudo volta, sem reiniciar.

- **Ela vence todo o resto.** Vale mais que a pasta do universo, a nota do universo e as
  pastas no universo.
- **Na nota de um livro, cobre o livro todo**: todos os capítulos e todos os outros arquivos
  do livro ficam de fora. Um capítulo com o seu próprio link `universe` continua dentro,
  porque o link do arquivo vale mais que o `false` do livro. Um capítulo com `false` próprio
  fica de fora mesmo que o livro tenha um link.
- **É um simples verdadeiro ou falso.** O editor de propriedades do Obsidian pode salvar o
  valor como o texto `"false"`; isso também funciona (espaços e maiúsculas não importam). Não
  há palavra para traduzir nem configuração para isso.
- **Entradas.** Uma nota que é uma entrada e tem `universe: false` não é entrada daquele
  universo.

### Juntando uma nota à mão

Abra uma nota que está fora de qualquer universo. O painel do universo mostra **Adicionar ao
…**, que define a propriedade `universe` nessa nota. Ele só escreve quando você clica.

## 3. Entradas: personagens, lugares, objetos, grupos, eventos

Uma **entrada** é uma nota que tem a propriedade de tipo (`type`, ou o nome que você
escolheu, como `tipo`) com um dos cinco valores de tipo, e que pertence a um universo (ou,
no modo por livro, a um livro). A pasta é só o lugar onde as entradas novas nascem; as
entradas podem mudar de lugar livremente.

### Crie uma entrada a partir do texto

1. Selecione um nome na prosa (uma linha, até 60 caracteres).
2. Clique com o botão direito e escolha **Criar entrada do universo**, ou use o comando.
3. Escolha o tipo e, se quiser, acrescente outro apelido. Deixe marcado **Transformar esta
   ocorrência em link** para transformar o texto selecionado em link (um desfazer remove).
4. **Criar** faz a nota na pasta do tipo, a partir do modelo, com as propriedades de tipo e
   `universe` definidas (no modo por livro, sem `universe`). Ela abre numa nova aba, sem tirar você do texto.

Se já existir uma entrada com esse nome ou apelido, a janela oferece **Abrir** ou **Só
linkar aqui**. O Escrita nunca sobrescreve uma nota.

Você também pode criar entradas pelo painel: o **+** ao lado de cada tipo, ou **Nova entrada**
num universo vazio.

### Encontre e use as entradas

A aba **Entradas** do painel agrupa as entradas por tipo. A busca encontra nomes e
`aliases`, ignorando acentos e maiúsculas. Cada entrada tem um menu com **Abrir**, **Abrir ao lado**,
**Inserir link na nota** (no cursor, na última nota que você editou) e **Mostrar no
explorador**. Abra-o com o botão direito, ou com o botão **⋯** (Mais ações) na ponta direita
da linha. O botão aparece quando o ponteiro está sobre a linha ou a linha tem o foco do
teclado, e fica sempre visível no celular e no tablet, onde não há botão direito.

### Remova uma entrada

Não há botão de remover: apagar e renomear ficam com o Obsidian, então o painel nunca apaga
nada. Uma nota deixa de ser entrada quando uma destas condições some:

- **Tire a propriedade de tipo.** A nota fica onde está e sai do painel. É o jeito mais
  limpo.
- **Apague a nota.** Use **Mostrar no explorador** e apague no Obsidian (ela vai para a
  lixeira).
- **Tire-a do universo.** Mova-a para fora da pasta do universo e das pastas no universo, e
  remova a propriedade `universe`. Remover só a propriedade não basta enquanto a nota ainda
  estiver dentro de `Universo/`.

Uma nota com a propriedade de tipo dentro de uma das pastas no universo (digamos `Contos/`)
também conta como entrada, então guarde as entradas na pasta do universo.

## 4. Leve as entradas de um livro para o universo

Se um livro tem as suas próprias pastas `Personagens/` e `Lugares/` (do modo por livro, ou de
antes da 0.6), mude para o modo Universo, abra a nota do livro ou um capítulo e rode
**Mover as entradas deste livro para o universo**. O comando também está no menu de contexto
da pasta do livro.

A prévia lista cada nota que vai ser movida e cada nome que já existe no universo (essas
ficam onde estão; nada é sobrescrito). Duas caixas acrescentam a propriedade de tipo onde ela
falta e a propriedade `universe` à nota do livro. As notas são movidas uma a uma, com a
renomeação do Obsidian, então os links são atualizados em todo lugar. Capítulos nunca são
movidos.

## 5. O painel do universo

Abra com **Abrir o painel do universo**. Ele acompanha o universo da nota em que você está;
sem nenhuma nota aberta, mantém o último. Com mais de um universo, um seletor aparece no
título.

- **Entradas**: seção 3. Cada entrada com menções mostra "N obras" ao lado; a seção 9 explica
  a contagem e a lista embaixo dela.
- **Threads**: seção 7.
- **Obras**: seção 6.

## 6. Obras e a forma delas

A aba **Obras** lista as obras do universo: livros e notas com um estágio conhecido no
`status`. Elas são agrupadas por forma, ordenadas por estágio (publicado primeiro) e nome,
com uma bolinha na cor do estágio e a contagem de palavras. Clique em uma para abri-la onde
você parou.

A forma de uma obra vem de:

1. a própria propriedade de forma (`form: novela`), se houver; senão
2. **Forma por pasta**: linhas como `Contos: conto`, uma por pasta. Vale a pasta mais
   profunda que combinar.

Obras sem nenhuma das duas ficam em **Sem forma**. Nada é escrito nas suas notas.

As palavras de forma são um campo separado por vírgulas, nesta ordem: conto, ensaio, novela,
romance, poema, fragmento. Exemplo: `conto, ensaio, novela, romance, poema, fragmento`.

## 7. Threads abertas

Uma **thread** é uma ponta solta plantada numa história para uma história futura. É um
comentário, então nunca aparece no modo de leitura nem numa exportação:

```
%% thread: quem escreveu as cartas? %%
```

- **Plantar uma thread**: comando ou menu do editor. Insere o marcador no cursor; o texto
  selecionado é copiado para dentro dele e continua na sua prosa.
- **Veja as threads**: aba **Threads** do painel, agrupadas por obra, com a data em que cada
  thread foi vista pela primeira vez (guardada nos dados do plugin, nunca na nota). Com o
  universo desligado, use **Mostrar threads abertas**, que lista as threads das suas obras
  acompanhadas. No modo por livro, o painel mostra as threads do livro.
- **Feche uma**: o círculo no painel, ou clique com o botão direito no marcador no editor e
  escolha **Fechar a thread…**. Se quiser, diga qual obra responde. O marcador vira
  `%% thread fechada: … → [[A Casa]] %%`. **Reabrir a thread** desfaz. Escrever a forma fechada à
  mão também funciona.

Fechar só escreve se o marcador ainda estiver exatamente como o painel leu. Se você o editou
nesse meio-tempo, nada muda e a lista é atualizada.

**As palavras são configurações.** A palavra da thread (padrão `thread`) e a palavra de
fechada (padrão `fechada` numa instalação em português, `closed` em inglês) podem ser
qualquer uma, por exemplo `fio` e `fechado`, dando `%% fio: … %%` e `%% fio fechado: … %%`.

## 8. Inserir de um modelo

Defina a **Pasta de modelos** nas configurações de capítulo. Então **Inserir de um modelo**
lista as notas dessa pasta. O corpo do modelo escolhido entra no cursor, com `{{title}}` (o
nome desta nota), `{{date}}` e `{{time}}` preenchidos. As propriedades dele só são acrescentadas
onde a sua nota não as tem; nada é sobrescrito. Um desfazer remove a inserção inteira.

Os modelos de entrada (seção 2) usam o mesmo preenchimento.

## 9. Aparece em: onde um personagem ou lugar é mencionado

Para cada entrada, o Escrita mostra quais obras a mencionam, quantas vezes e onde. Ele acha as
menções no seu texto sozinho. Você não marca nada e nada é escrito nas suas notas.

### Onde você vê

- **No painel.** Na aba Entradas, uma entrada com menções mostra "N obras" ao lado do nome.
  Clique em "N obras" para abrir a lista (clicar na linha abre a nota da entrada): cada obra com a contagem de menções e a forma, e, num
  livro, o primeiro e o último capítulo que a mencionam ("primeira no cap. 2, última no cap.
  9"). Um grupo chamado **Outras notas** vem depois das obras: outras entradas, a nota do
  universo e notas avulsas que estão no universo. Ele começa fechado.
- **Na nota da entrada.** Abra a entrada (por exemplo `Universo/Personagens/Maria.md`) e uma
  seção **Aparece em** surge no fim, no Live Preview e no modo Source. Ela é desenhada pelo
  Escrita sobre a nota. Não faz parte do arquivo: não dá para selecioná-la, ela não é
  exportada, não é contada, e o texto e a data de modificação do arquivo não mudam. No modo
  de leitura ela ainda não aparece; use o painel ali.
- **Clique numa obra.** A nota abre com a primeira menção selecionada. Se você editou a nota
  e a menção mudou de lugar, o Escrita acha o lugar certo de novo. Se a menção sumiu, a nota
  abre no topo.

Enquanto o Escrita monta a primeira contagem depois que você abre o Obsidian, o painel diz
"contando…". Ele trabalha em segundo plano, em passos pequenos, então a digitação continua
fluida. Depois disso, as contagens acompanham as suas edições e se acertam cerca de um segundo
depois que você para de digitar. Se você acrescenta um apelido a uma entrada, as contagens se
atualizam em poucos segundos.

### O que conta como menção

- O Escrita lê o que o leitor vê: o texto das suas notas, títulos inclusos. Ele pula
  propriedades, `%% comentários %%`, código, endereços de links e embeds.
- Um link conta. `[[Maria]]` é uma menção. `[[Maria|ela]]` conta uma vez, não duas.
- Uma menção só conta para uma entrada em notas do escopo dela: as obras do universo, no modo
  Universo; os capítulos do livro, no modo por livro. Uma nota com `universe: false` fica de
  fora.

### Como os nomes são reconhecidos

Uma entrada é reconhecida pelo nome da nota e pelos `aliases`. Estas regras decidem o resto.

1. **Nomes com inicial maiúscula pedem inicial maiúscula.** Uma entrada chamada *Rosa* conta
   *Rosa* e *ROSA*, mas não *rosa* em "a blusa rosa". Num nome de várias palavras, cada
   palavra maiúscula do nome precisa da sua maiúscula: *Rosa dos ventos* pede maiúscula em
   *Rosa*, não em *dos*. Um título em caixa alta (`## PORTO`) ainda conta. Uma palavra comum
   no começo da frase ainda combina, então uma frase que começa com *rosa* (a cor) conta para
   a entrada *Rosa*. Se isso for um problema, use a lista de ignorar da entrada.
2. **Apelidos em minúsculas combinam com qualquer caixa.** Um apelido como *o menino* combina
   com *o menino* e com *O menino*.
3. **Artigos precisam combinar como escritos.** *o menino* nunca combina com *os meninos*, e
   *a casa* nunca combina com *as casas*. Se quiser os dois, dê os dois como apelidos.
4. **Plurais e diminutivos seguem o idioma.** Em português, *Maria* também combina com
   *Mariazinha* e *Marias*, e *Mariano* não combina com *Mariana*: são pessoas diferentes. O
   inglês trata plurais e possessivos (*Teo's*). O idioma é o **Idioma da escrita**, no topo da
   página Recursos. Sem idioma (um idioma do Obsidian que o Escrita não conhece), os nomes só
   combinam como escritos.
5. **Acentos não importam.** *Inês* e *Ines*, *Tomás* e *Tomas*, *Mário* e *Mario* são o
   mesmo nome, porque quem escreve nem sempre é coerente com os acentos.
6. **Hífens separam palavras.** *Maria-José* combina com a entrada *Maria José*, e a entrada
   *Santa-Rita* combina com *Santa Rita*.
7. **Nomes de várias palavras** combinam através de espaços, quebras de linha e marcas de
   `*ênfase*`. Qualquer outra pontuação os quebra.
8. **Primeiro nome como apelido.** Num personagem com nome completo, o primeiro nome também
   conta: *Dona Benta Encerrabodes* também é achada como *Benta*. Veja "Títulos" abaixo.
9. **Empate não conta para ninguém.** Se duas entradas podem ser donas de uma palavra
   (*Marcos* e *Marco*), um nome ou apelido exato vence um primeiro nome derivado. Se ainda
   assim não ficar claro, a palavra não conta para ninguém.
10. **Nomes muito curtos não combinam.** Um nome de uma letra, ou um nome que é uma palavrinha
    comum (como *a* ou *de*), nunca combina.

### Títulos

Para um personagem cujo nome de nota começa com um título, o Escrita pula o título e usa a
palavra seguinte como primeiro nome: *Dona Benta Encerrabodes* dá o apelido *Benta*. O nome
sem os títulos também é um apelido, mesmo que sobre uma palavra só: *Mr Brown* dá *Brown*. Um
sobrenome sozinho nunca vira apelido quando não há título: *Maria Souza* dá *Maria*, não
*Souza*.

O Escrita conhece títulos comuns em português (*dona, dom, seu, sr, sra, srta, dr, dra,
padre, frei, irmã, irmão, senhor, senhora, doutor, doutora, tia, tio, vó, vô, coronel,
capitão, professor, professora*) e em inglês (*mr, mrs, ms, miss, dr, sir, lady, lord, aunt,
uncle*). Os títulos mantêm os acentos, então *Irma*, um prenome, não é o título *Irmã*. Para
acrescentar os seus, use **Títulos extras** nas configurações do Universo, um por linha.

### Propriedades da entrada

Quatro propriedades na nota de uma entrada ajustam como ela é reconhecida. Todas são
opcionais, e os nomes delas são configurações (Universo › Propriedades da entrada).

| Propriedade | Valores | O que faz |
|---|---|---|
| `aliases` | uma lista | Outros nomes que contam, como `Mari`. É a propriedade do próprio Obsidian. |
| `caseSensitive` | `true` | Reconhece só com as maiúsculas exatas (acentos continuam ignorados). Para um nome que também é uma palavra comum. |
| `ignore` | uma lista de expressões | Expressões em que o nome não deve contar. `Rosa` com `ignore: ["rosa dos ventos"]` continua contando nos outros lugares. |
| `firstName` | `false` | Não transforma o primeiro nome em apelido deste personagem. |

Exemplo, uma personagem chamada *Rosa* num mundo que também tem uma *rosa dos ventos*:

```
---
tipo: personagem
aliases: [Rosinha]
ignore: ["rosa dos ventos"]
---
```

### O que ele nunca faz

- Nunca escreve nas suas notas, nem na da entrada.
- Nunca contata um servidor. Tudo roda no seu dispositivo.
- Nunca decide por você. Um reconhecimento errado não muda nenhuma nota: acrescente uma
  expressão em `ignore` ou um apelido, e as contagens acompanham.

## 10. Nomes no editor e na lente de revisão

Quando uma entrada existe, os nomes dela deixam de ser tratados como erros de digitação.

- **Ortografia.** Nomes e apelidos nas notas do universo deles não são marcados como erro de
  ortografia no Live Preview. A mesma palavra numa nota fora do universo continua marcada. Só
  nomes que começam com maiúscula são marcados assim. Isso funciona marcando a palavra como
  "não corrigir", então o seu dicionário nunca é alterado. No celular, se o sublinhado some ou
  não depende do teclado do aparelho; a autocorreção de lá não é afetada.
- **Sublinhado.** Ligue **Sublinhar nomes no editor** nas configurações do Universo para ver
  um traço fino sob cada nome reconhecido. Vem desligado. Os nomes ficam sem marca de erro de
  qualquer jeito. **Ctrl-clique** (**Cmd-clique** no Mac) num nome sublinhado abre a entrada.
- **Nomes sem entrada.** Uma regra opcional da lente que acha nomes recorrentes sem entrada. Veja a seção 11.
- **Lente de revisão.** Com a lente ligada, uma variação de grafia do nome de uma entrada
  (*Marianna* quando a entrada é *Mariana*) é apontada como variação de nome, e repetir um nome
  não conta como eco. A sua nota de listas de palavras continua acrescentando nomes.

As marcas só desenham sobre o texto. Elas nunca o alteram.

## 11. Menções sem link

Uma menção sem link é um lugar onde uma nota diz o nome de uma entrada e não a liga. O Escrita
lista essas menções da nota que você tem aberta e transforma uma em link quando você aperta um
botão.

Abra o painel do universo. Na aba **Obras**, sob a obra, a seção **Menções sem link** mostra o
nome da nota aberta e uma linha para cada menção. No modo por livro, a seção fica no fim da aba
**Entradas**. Uma linha mostra:

- o nome da entrada e o número da linha ("linha 12");
- a frase em volta da menção, com o nome destacado;
- um botão **Criar link**.

Clique na frase para ir àquela linha da nota (nada fica selecionado). Aperte **Criar link** e só
aquela menção vira link: `[[Maria|Mari]]`, ou `[[Maria]]` quando o texto é igual ao link. Se o seu cofre usa links Markdown (Configurações › Arquivos e
links, "Usar [[Wikilinks]]" desligado), o link sai nesse formato: `[Mari](Maria.md)`. O
Escrita confere antes se a linha continua a mesma. Se você a editou depois que a lista foi feita,
nada é gravado, um aviso diz "A linha mudou desde que a lista foi feita. Nada foi escrito; a
lista foi atualizada.", e a lista se atualiza. Não existe "ligar tudo": cada link é um clique seu. Texto que não cabe dentro de um link (colchetes, ou uma barra vertical num wikilink) tem aviso próprio: "Este texto não pode ser vinculado aqui. Nada foi escrito."

O que entra na lista:

- As mesmas menções de "Aparece em" (seção 9), com as mesmas regras de nomes, apelidos e
  alcance.
- **Um link basta.** Se a nota já liga uma entrada em algum lugar, as outras menções dela não
  são listadas. Você liga a primeira, e as demais podem ficar como texto.
- Texto dentro de um link, de uma incorporação ou de um link Markdown para um endereço da web
  nunca é listado.
- A lista é só da nota aberta, e diz "Nenhuma menção sem link nesta nota." quando não há nada.

Enquanto a primeira contagem depois de abrir o Obsidian roda, a seção diz "contando…".

### Nomes sem entrada

A lente de revisão também pode apontar nomes para os quais você ainda não fez uma entrada. Esta
regra vem **desligada até você ligá-la**: Configurações › Escrita › Revisão, nas regras, **Nomes
sem entrada**. Ela precisa do universo ligado (um modo que não seja Desligado) e da lente ligada
na nota. Com o universo desligado, o painel da lente diz "Precisa do universo ligado." e tem um
botão **Abrir recursos**.

A regra marca um nome com inicial maiúscula, ou uma sequência de palavras com maiúscula
("Capitão Ramos"), quando:

- ele ainda não é um nome conhecido: não é nome nem apelido de uma entrada, não está na sua lista
  de nomes da lente e não está em **Não são nomes** (abaixo);
- não está no começo de uma frase;
- ele volta: pelo menos 5 vezes na nota, ou em pelo menos 2 das suas obras.

No painel da lente, a regra mostra uma lista com uma linha por nome: quantas vezes ele aparece
na nota, em quantas obras ele está ("3 na nota · 2 obras") e duas ações.

- **Criar entrada** abre a janela de nova entrada com o nome já preenchido. A nota que você está
  escrevendo não é tocada. Quando a entrada existe, a marca some.
- **Dispensar** diz "isto não é um nome" e põe a palavra em **Não são nomes**, para todas as
  notas. Um aviso diz "“Palavra” foi para “Não são nomes” e não será mais marcado."

Clique num nome da lista para ir à próxima ocorrência dele. Os botões de percorrer da lente
(**Nome sem entrada anterior**, **Próximo nome sem entrada**) passam por eles.

**Não são nomes** é uma configuração da mesma seção: uma palavra ou sequência por linha,
comparadas sem diferenciar maiúsculas nem acentos. Acrescente palavras à mão, ou apague uma linha
para a palavra voltar a ser marcada.

## Exemplo: uma escritora de contos em português

```
Modo do universo:       Universo
Nota do universo:       Universo.md           (entradas em Universo/)
Pastas no universo:     Contos
                        Romances
Propriedade de tipo:    tipo                  (personagem, lugar, objeto, grupo, evento)
Modelos por tipo:       Modelos/Personagem.md, Modelos/Lugar.md
Propriedade de forma:   forma                 (conto, ensaio, novela, romance, poema, fragmento)
Forma por pasta:        Contos: conto
                        Textos: ensaio
                        Romances: romance
Palavra da thread:      fio
Palavra de fechada:     fechado
Pasta de modelos:       Modelos
Títulos extras:         (nenhum: os títulos em português já vêm inclusos)
Sublinhar nomes:        ligado
```

Os ensaios em `Textos/` ficam fora do universo, mas ainda recebem a forma, e as threads deles
continuam aparecendo em **Mostrar threads abertas**. Um ensaio em `Contos/` que não se passa no
seu mundo ganha `universe: false`.

## Quando algo parece errado

| Você vê | Por quê | O que fazer |
|---|---|---|
| Uma nota que não é ficção na aba Obras | A pasta dela está em "Pastas no universo" | Tire a pasta dessa lista |
| Uma nota em Entradas que você não queria como entrada | Ela tem a propriedade de tipo e pertence ao universo | Tire a propriedade (seção 3) |
| O painel diz que a nota do universo não existe | A nota das configurações não existe | Clique em **Criar**, ou corrija o caminho |
| "Criar entrada do universo" diz que a nota não está num universo | A nota não cumpre nenhuma regra da seção 2 | Use **Adicionar ao …** no painel, ou acrescente a pasta dela |
| Faltam comandos do universo | O modo está Desligado (o recurso não está carregado) | Escolha Por livro ou Universo na página Recursos |
| Uma obra está em "Sem forma" | Sem propriedade de forma e sem linha de "Forma por pasta" que combine | Acrescente a linha da pasta, ou a propriedade |
| Fechar uma thread diz que mudou | O marcador foi editado depois que a lista foi lida | Nada foi alterado; tente de novo a partir da lista atualizada |
| Uma nota que você esperava não aparece em "Aparece em", na aba Obras nem nos nomes | Ela tem `universe: false`, ou está fora do universo da entrada | Tire `universe: false`, ou confira as regras da seção 2 |
| Um nome não é contado | Está em minúsculas no texto, a entrada diferencia maiúsculas, ou a palavra está na lista de ignorar da entrada | Veja a seção 9 |
| As contagens dizem "contando…" | A primeira contagem depois de abrir o Obsidian ainda está rodando | Espere alguns segundos; ela roda em segundo plano |
