# Acompanhamento

Esta página é sobre saber em que pé está cada texto e voltar a ele. Ela cobre os estágios
por onde uma obra passa, a versão que o Escrita guarda quando a obra muda de estágio, a nota
inicial com o seu bloco de obras, como o Escrita lembra onde você parou e o modo escrita, que
esconde tudo menos a nota.

Outras páginas: [Primeiros passos](getting-started.md), [Escrita](writing.md),
[Revisão](revision.md), [Publicação](publishing.md), [O mundo](the-world.md) e
[Recursos e configurações](features-and-settings.md).

## Diga em que pé está uma obra: estágios e palavras de status

Uma obra passa por cinco **estágios**: ideia, rascunho, revisão, pronto e publicado. Você não
precisa aprender palavras novas. Você liga cada estágio às palavras que já usa na propriedade
`status`, e o Escrita descobre o estágio pela palavra.

Uma **obra** é um livro, ou uma nota acompanhada, cujo `status` é uma das suas palavras de
estágio. Capítulos não são obras. Uma nota sem status não é uma obra. Uma nota com um status
que não é palavra de estágio (como `pausado`) também não é uma obra; o bloco da nota inicial
só a conta como "sem estágio".

Em Configurações › Escrita, **Estágios** tem uma linha por estágio: **Palavras para Ideia**,
**Palavras para Rascunho** e assim por diante. Digite as suas palavras separadas por vírgulas.
A primeira palavra é a que o Escrita escreve (quando você publica, ou quando uma nota nova
começa como rascunho); as outras também valem. As palavras são comparadas sem diferenciar
maiúsculas. Os padrões, em inglês, são `idea`, `draft`, `revision`, `ready` e `published`. Quem
escreve contos em português costuma usar `ideia`, `rascunho`, `revisão`, `pronto` e
`publicado`.

- **Uma palavra em dois estágios.** Se você digitar a mesma palavra em dois estágios, vale o
  primeiro, e as configurações avisam.
- **Uma cor para cada estágio.** Cada linha tem **Cor de Rascunho** e assim por diante, e
  **Tirar a cor** apaga a cor. As cores aparecem nos pontos dos capítulos e nos chips de
  estágio do esboço, e como legenda na linha de contagens do bloco da nota inicial.
- **Outras cores de status.** Status que não são estágio, como `pausado` num capítulo, também
  podem ter cor. Em **Outras cores de status**, escreva uma por linha como `palavra: cor`, por
  exemplo `pausado: #6e6b66`.
- **A propriedade.** O nome da propriedade de status (padrão `status`) é uma configuração em
  Propriedades e pastas, **Propriedades de status e resumo**.

### Notas novas começam como rascunho

Com **Notas novas começam como rascunho** ligado (vem ligado), um livro ou capítulo novo, e uma
nota que você cria numa pasta acompanhada (pelo *Nova nota* do Obsidian ou a partir de um modelo),
recebe a sua primeira palavra de rascunho como `status`, a menos que já tenha um. O Escrita espera
um instante depois que a nota é criada, para que o status do modelo valha. Modelos, entradas do
universo e as notas do próprio Escrita (nota inicial, listas de palavras, nota do universo) ficam
como estão. Só as propriedades mudam.

## Guarde uma versão a cada estágio: a versão de estágio

Quando você muda o status de uma obra para outro estágio, o Escrita guarda uma versão com o
nome da mudança, nas suas palavras, por exemplo "rascunho → revisão". Ele espera o status parar de mudar por
alguns segundos, então corrigir rápido um erro de digitação na palavra não gera duas. Num
livro, ele guarda a nota do livro e cada capítulo.

- **As versões de estágio nunca são apagadas para dar lugar a outras.** Elas são o registro de
  como a obra estava em cada virada. Aparecem como **Mudança de estágio** na lista de versões
  (**Abrir versões**).
- **Só com o Obsidian aberto.** Um status que você muda com o Obsidian fechado não gera
  versão.
- **Precisa de Versões.** O interruptor é **Versão a cada estágio**, em Recursos, no grupo
  Acompanhamento. Com Versões desligado, ele fica cinza e não faz nada; volta a funcionar
  quando você liga Versões. Veja [Recursos e configurações](features-and-settings.md).

## Comece por uma nota: a nota inicial

A nota inicial é uma nota sua, com um bloco que o Escrita desenha. Ela responde "o que eu
escrevo hoje?". Coloque isto em qualquer nota:

````
```escrita-works
```
````

Depois defina essa nota como a **Nota inicial** em Configurações › Escrita (seção Nota
inicial), ou rode **Abrir a nota inicial**, que se oferece para criá-la.

O Escrita desenha o bloco e nunca escreve nele. O bloco mostra:

- **Escrevendo**: as suas obras no estágio de rascunho.
- **Revisando**: as suas obras no estágio de revisão.
- **Uma linha de contagens** para o resto, com um ponto colorido por estágio: ideias, prontos,
  pendentes (com Envios ligado) e publicados, e as notas sem estágio. Clique numa contagem
  para abrir as obras dela; clique de novo para fechar.

Cada obra é uma linha com o título e um dado: o tamanho contra a meta ou o limite, o prazo ou,
num livro, quantos capítulos estão prontos. As obras que você editou por último vêm primeiro.

Para ver só algumas das suas obras, acrescente linhas `folder:` dentro do bloco:

````
```escrita-works
folder: Contos
folder: Textos
```
````

Qualquer outra linha é ignorada. Uma pasta que não existe é avisada no bloco.

### Abra a nota inicial

**Abrir a nota inicial** abre a nota. Se você não definiu nenhuma, o Escrita adota um
`Home.md` ou `Inicio.md` que já exista, e nunca o sobrescreve. Se não houver nenhum, ele
pergunta antes e então cria a nota com um bloco de obras vazio (`Inicio.md` em português,
`Home.md` em inglês). Se a nota que você definiu não existe, ele pergunta antes de criá-la.
Renomear ou mover a nota inicial atualiza a configuração.

O comando não tem atalho padrão. Você pode dar um em Configurações › Atalhos.

### Abrir ao iniciar

**Abrir ao iniciar**, ao lado da configuração da nota inicial, abre a nota inicial na aba
ativa quando o Obsidian abre, no lugar da aba restaurada. Vem desligado. Só age quando o
Obsidian abre: ligar o Escrita no meio de uma sessão nunca troca a aba em que você está.

## Volte aonde parou: onde você parou

Clique numa obra no bloco da nota inicial e ela abre onde você parou:

- **Uma nota** abre no ponto que você editou por último. Sem esse ponto, abre no primeiro beat
  ainda não escrito, e sem beat, no fim.
- **Um livro** abre o capítulo que você editou por último, no ponto em que parou. Sem esse
  capítulo, abre o primeiro capítulo com um beat ainda não escrito, ou então o último capítulo,
  no fim.

O Escrita lembra o ponto só para obras e para os capítulos de um livro que é obra. Ele guarda
o texto em volta do cursor junto com a posição; então, se você mudou a nota em outro
dispositivo ou editor, ele reencontra o lugar pelas palavras. Ele acompanha a nota se você a
renomear ou mover. Não há nada a configurar nem a limpar: o registro fica nos dados do plugin,
nunca nas suas notas.

Ctrl+clique (Cmd+clique no Mac) ou clique com o botão do meio numa obra para abri-la numa
aba nova. No modo escrita, o clique abre a obra na mesma aba.

Se você desligar o bloco em Recursos (**Bloco de obras e onde você parou**), o Escrita deixa
de registrar onde você parou e o bloco aparece como código simples. Os registros ficam e
voltam quando você liga de novo.

## Escreva só com a nota: o modo escrita

O modo escrita esconde tudo em volta da nota, e sobra a página.

**O que ele esconde.** As barras laterais da esquerda e da direita, a barra de abas, a faixa
de ícones e a barra de status. No celular, esconde também o título da nota e a barra
inferior. Nada é escrito no seu cofre, e nenhum arquivo muda.

**O que fica.**

- **A nota.** A coluna de leitura é a do seu tema.
- **Um botão discreto "Sair do modo escrita"** no canto superior direito. Ele fica sempre
  visível, porque no celular não existe passar o mouse.
- **Um contador pequeno da meta**, como "hoje 312 / 500", embaixo da tela, quando Metas está
  ligado e você tem uma meta diária. É a única coisa que o Escrita acrescenta. Ele acompanha
  Metas sendo ligado ou desligado, e some junto.

**Os comandos.** São dois comandos, e a paleta mostra o que serve naquele momento: **Entrar no
modo escrita** quando ele está desligado, **Sair do modo escrita** quando está ligado. Na
primeira vez da sessão em que você entra, um aviso diz como sair. Eles não têm atalho padrão.
Defina o seu em Configurações › Atalhos.

**Sair.** Pelo botão ou pelo comando. O Escrita reabre só as barras laterais que ele fechou;
uma barra que você já tinha fechado continua fechada.

**Abrir no modo escrita.** A configuração **Abrir no modo escrita**, ao lado de **Abrir ao
iniciar**, abre o Obsidian já no modo escrita. Se **Abrir ao iniciar** também estiver ligado,
a nota inicial abre primeiro e depois o modo começa. O layout "Modo escrita" da preparação do
cofre liga essa configuração para você (veja
[Primeiros passos](getting-started.md#dois-layouts-a-mesa-de-escrita-e-o-modo-escrita)).

**Abrir uma obra pela nota inicial.** Clique numa obra: ela abre na mesma aba, onde você
parou, e você continua no modo escrita.

O modo escrita faz parte do recurso do bloco de obras e não tem interruptor próprio. Desligar
esse recurso com o modo ligado faz o modo sair antes, então nada fica escondido.

### Ao lado de um plugin zen ou de um tema

O Obsidian não tem modo zen próprio, e plugins da comunidade têm: **Zen Mode**, **Ultra Zen
Mode** e **Easy View** são três. Se você quer mais do que isso (rolagem de máquina de
escrever, esmaecer as outras linhas, esconder mais da interface), experimente um deles. O modo
do Escrita fica pequeno de propósito: dá para entrar nele sem um segundo plugin, e só o
Escrita tem o contador da meta e o "onde você parou".

Os dois podem coexistir. O Escrita reabre só o que ele mesmo escondeu, então o que um plugin
zen escondeu fica como está quando você sai do modo escrita. Se os dois esconderam a mesma
barra lateral, sair do modo do Escrita pode trazê-la de volta; saia do modo do plugin zen
depois.

## Configurações e comandos desta página

| Onde | Nome | O que faz |
|---|---|---|
| Configurações › Estágios | Palavras para cada estágio, Cor de cada estágio, Outras cores de status, Notas novas começam como rascunho | Ligam as suas palavras de status aos estágios |
| Configurações › Nota inicial | Nota inicial, Abrir ao iniciar, Abrir no modo escrita | A nota que guarda o bloco, e o que acontece quando o Obsidian abre |
| Recursos › Acompanhamento | Bloco de obras e onde você parou, Versão a cada estágio | O bloco da nota inicial e a versão de estágio |
| Comandos | Abrir a nota inicial, Entrar no modo escrita, Sair do modo escrita | |

## Quando algo parece errado

| O que você vê | Por quê | O que fazer |
|---|---|---|
| O bloco diz "Nenhuma obra ainda" | Nenhuma nota ou livro tem um status que seja uma das suas palavras de estágio | Defina um status, ou mude as palavras em Estágios |
| Uma nota falta no bloco | Ela não é acompanhada, não tem status, ou uma linha `folder:` a deixa de fora | Confira a pasta, o status e o bloco |
| Uma nota é contada "sem estágio" | O status dela não é uma das suas palavras de estágio | Acrescente a palavra a um estágio |
| Nenhuma versão depois de mudar o status | Versões está desligado, ou o status mudou com o Obsidian fechado | Ligue Versões |
| O bloco aparece como código | Bloco de obras e onde você parou está desligado | Ligue em Recursos |
| Sem contador da meta no modo escrita | Metas está desligado, ou não há meta diária | Ligue Metas e defina uma meta |
