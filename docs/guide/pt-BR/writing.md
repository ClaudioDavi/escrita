# Escrita

Esta página é sobre a escrita em si: planejar um livro no esboço, definir metas, deixar lembretes
para depois, digitar sem atrito, mover texto de lugar e ver as suas contagens. Cada parte começa
pela tarefa e depois nomeia os comandos e as configurações que ela usa.

Outras páginas: [Primeiros passos](getting-started.md), [Revisão](revision.md),
[Acompanhamento](tracking.md), [Publicação](publishing.md), [O mundo](the-world.md) e
[Recursos e configurações](features-and-settings.md). Cada parte abaixo tem um interruptor na
página Recursos, então você pode desligar o que não usa.

## Planeje um livro no esboço

*Recursos › Esboço e beats fantasmas.*

Um **livro** é uma nota com uma pasta de mesmo nome ao lado dela e, dentro dessa pasta, uma pasta
de capítulos:

```
Romances/Meu Livro.md
Romances/Meu Livro/Capítulos/01 Chegada.md
Romances/Meu Livro/Capítulos/02 A porta fechada.md
```

Rode **Criar um livro** (também há um botão num esboço vazio) para fazer um. Ele pergunta o título
e a pasta e cria a nota do livro (no estágio de rascunho, com uma meta de 80.000 palavras e o
prazo vazio), as pastas dele e, se a pasta ainda não tem capítulos, um primeiro capítulo. Rode
**Abrir esboço** para abrir o painel **Esboço** na barra lateral direita. Ele lista os capítulos do
livro atual, cada um com número, título, status, resumo e tamanho, e o total do livro contra a meta
dele. Se você tem vários livros, a lista **Livro** no topo escolhe um.

### Edite pelo teclado

Títulos e resumos se editam ali mesmo. O arquivo do capítulo é renomeado com o próprio renomear
do Obsidian, então os links continuam funcionando.

- **Enter** acrescenta um capítulo, ou um beat quando você está num beat.
- **Tab** transforma um capítulo vazio num beat do capítulo anterior. Um capítulo com texto ou
  beats nunca vira beat.
- **Shift+Tab** transforma um beat ainda não escrito num capítulo novo. Um beat que já tem texto
  fica como está.
- **Backspace** numa linha vazia a remove. Um capítulo que tem texto ou beats só é excluído pelo
  menu dele, depois de uma pergunta, e vai para a lixeira.
- **Arraste** os números para reordenar os capítulos. Os arquivos são renumerados por você.
  **Renumerar os capítulos deste livro** faz a mesma renumeração sem arrastar.

No celular, o botão **⋯** de cada linha tem as mesmas ações: abrir, mover para cima e para baixo,
adicionar um beat, transformar em beat ou em capítulo, excluir.

### Beats

Um beat é uma nota de uma linha sobre uma cena. No capítulo, é um comentário numa linha só dele:

```
%% beat: As cartas na caixa de lata %%
```

Um beat conta como **escrito** quando há texto depois dele, antes do próximo beat, de uma quebra
de cena ou do fim do arquivo. Até lá ele fica apagado no esboço. Depois ganha um sinal de
verificado. O beat continua no arquivo: ele funciona como um título de cena invisível.

Rode **Adicionar um beat a este capítulo** (no editor de um capítulo) para pôr um beat nele. No
esboço, clique na letra de um beat para ir até ele. O menu de um beat tem **Remover beat (mantém o
texto)**.

Fora de um livro, o painel mostra os beats da nota em que você está (um conto, um ensaio), com o
tamanho dela contra a meta ou o limite. Uma nota sem beats oferece **Adicionar o primeiro beat**.

### Beats fantasmas

Na Visualização ao vivo, cada beat aparece dentro do capítulo como um rótulo esmaecido ("Beat b ·
do esboço") acima do lugar onde a cena vai. Ponha o cursor na linha para ver o texto cru. Para
desligar, use **Beats fantasmas** na seção Esboço das configurações.

### Veja o livro como um quadro

**Abrir esboço como quadro** (um comando; no esboço, o botão **Abrir como quadro (Canvas)**) escreve um arquivo Canvas com um
cartão por capítulo, colorido pelo status. Se já existe um arquivo com esse nome que o Escrita não
fez, o Escrita pergunta antes de substituir.

### Configurações dos capítulos

Em Configurações › Escrita › Livros:

- **Nome da pasta de capítulos.** Uma nota é um livro quando uma pasta com o mesmo nome ao lado
  dela contém esta subpasta.
- **Modelo de capítulo.** Uma nota usada como texto inicial dos capítulos novos. `{{title}}`,
  `{{date}}` (AAAA-MM-DD) e `{{time}}` (HH:mm) são preenchidos. Vazio significa capítulo em branco.
- **Dígitos do número do capítulo.** O mínimo de dígitos nos nomes dos capítulos (`01 Chegada.md`).
- **Capítulos sem número.** Títulos que nunca recebem número no esboço e na exportação, como
  Prólogo, Interlúdio, Epílogo. Numere todos os arquivos como de costume; um capítulo com um título
  da lista não é contado.
- **Propriedades de status e resumo.** As propriedades lidas de cada capítulo: o status diz em que
  estágio está uma obra (os estágios estão em [Acompanhamento](tracking.md)), e o resumo aparece no
  esboço.

## Veja de quem é a história de um capítulo: o ponto de vista

Acrescente uma propriedade `pov` a um capítulo. Pode ser um link para um personagem ou texto
simples:

```
pov: "[[Maria]]"
```

ou

```
pov: João
```

O nome da propriedade é uma configuração (**Propriedade do ponto de vista**, em Propriedades e
pastas). Use o nome que preferir, como `narrador`; `pov` é o padrão.

No esboço, cada linha de capítulo tem uma **faixa de cor** na borda. Dois capítulos com o mesmo
ponto de vista ganham a mesma cor. O Escrita escolhe a cor por você entre oito (vermelho,
laranja, amarelo, verde, ciano, azul, roxo, rosa) e lembra dela, então ela continua igual
depois de reiniciar.

- **Link e texto são o mesmo personagem.** Um link `[[Maria]]` e um link para a mesma nota com
  outro nome são um só ponto de vista. Texto simples é comparado sem olhar maiúsculas e
  acentos: *João* e *joao* são um só. Se o texto é um nome ou apelido de uma entrada do seu
  universo, o Escrita o trata como aquela entrada.
- **Mude uma cor.** Clique na etiqueta do ponto de vista no cabeçalho e escolha **Cor de
  Maria**, depois escolha uma. Ela fica.
- **Abra a entrada.** O mesmo menu tem **Abrir a entrada**, quando o ponto de vista é uma
  nota.
- **Renomeie o personagem.** Se você renomeia a nota da Maria, a cor continua com ela.

## Colorir por status ou por ponto de vista

No topo do esboço, **Colorir por** alterna entre **Status** e **POV**. No modo Status, as
faixas seguem as cores dos seus estágios (rascunho, revisão e assim por diante, das
configurações). No modo POV, elas seguem os pontos de vista.

O **resumo** ao lado conta os capítulos por estágio, com as suas próprias palavras para os
estágios: "1 rascunho · 2 revisão". Um capítulo com um status que não é um estágio conta sob
essa palavra. Um capítulo sem status aparece como "sem status".

## Filtre o esboço

Abaixo do alternador há etiquetas para cada estágio e cada ponto de vista. Clique numa para
mostrar só esses capítulos. Clique em mais de uma etiqueta da mesma fileira para ampliar o
filtro: você vê os capítulos que combinam com qualquer uma delas. As etiquetas de estágio e as
de ponto de vista se restringem: você vê os capítulos que combinam com as duas.

Com um filtro ligado, o cabeçalho diz **Mostrando 2 de 5 · Limpar**. Clique em **Limpar** para
mostrar todos os capítulos de novo.

Enquanto há um filtro, **arrastar e soltar e "Renumerar os capítulos" ficam pausados**.
Reordenar uma lista parcial poderia renumerar o livro errado, e o Escrita nunca arrisca os seus
capítulos. Limpe o filtro para reordenar. Se houver muitas etiquetas, a fileira mostra algumas e
um botão **+3**; **menos** dobra de volta.

## Uma meta para cada capítulo

Um capítulo pode ter o seu próprio `target`, `limit`, `unit` e `deadline`, como um conto.
Quando um capítulo tem meta, uma **barra** fina sob o título mostra até onde ele chegou, na
unidade do próprio capítulo. A barra usa as mesmas cores das barras do bloco de progresso.

Você também pode definir um **padrão** para o livro todo. Acrescente `chapterTarget` à nota do
livro:

```
chapterTarget: 3000
```

Todo capítulo sem meta própria passa a ter uma barra contra 3.000. O nome da propriedade é uma
configuração (**Propriedade da meta dos capítulos**, em Propriedades e pastas). Se você esvaziar
essa configuração, não há padrão do livro.

### A regra: uma resposta para todo lugar

O Escrita calcula a meta de cada capítulo uma vez só, e o esboço, o explorador de arquivos e as
metas (a barra de status e as contagens que ela desenha) usam essa mesma resposta. Então um
capítulo nunca mostra 3.000 num lugar e nada em outro. A regra, campo por campo:

- **O capítulo vence.** Um capítulo com `target: 1500` é medido contra 1.500. Um capítulo sem meta
  própria usa o `chapterTarget` do livro. O rótulo da barra diz "meta do capítulo" quando a do
  próprio capítulo vence sobre um padrão do livro.
- **Só a meta é herdada.** O `limit` e o `deadline` de um capítulo continuam sendo dele. O padrão do
  livro nunca dá a um capítulo um limite ou um prazo.
- **A unidade.** O `unit` do próprio capítulo vence. Sem ele (um `unit` vazio conta como nenhum),
  vale o `unit` da nota do livro, e sem esse, palavras. Então `unit: characters` na nota do livro
  conta todos os capítulos em caracteres, e um capítulo ainda pode escolher a sua.
- **Só capítulos herdam.** Um conto ou ensaio fora de um livro não tem livro acima dele, então não
  recebe nada. A própria nota do livro usa a sua meta `goal` (em Metas, abaixo), não o
  `chapterTarget`.
- **Sem meta, sem barra.** Um livro sem `chapterTarget` e com capítulos sem meta não mostra barras,
  nem meta no explorador ou na barra de status.
- **O explorador e a barra de status.** Com **Mostrar a meta ao lado da contagem**, um capítulo que
  usa o padrão do livro mostra `2.100 / 3.000` no explorador, e a barra de status mostra o mesmo
  enquanto você escreve nele.

## Ler o livro

Para ler um livro como o leitor vai ler, abra um capítulo qualquer ou a nota do livro e rode
**Ler o livro**. Você também pode apertar **Ler o livro** no cabeçalho do esboço. Abre-se uma aba
com todos os capítulos em ordem, um depois do outro.

- **Parece a exportação.** Comentários, beats e marcadores ficam escondidos, como num manuscrito.
  Um capítulo deixado de fora com `compile: false` não aparece. Os títulos dos capítulos são os
  que a exportação imprimiria.
- **É só leitura.** Você não muda nada nesta aba. Clique num parágrafo e o capítulo abre numa
  aba nova, naquela linha, pronto para editar.
- **É rápido num livro longo.** Os capítulos são desenhados à medida que você rola até eles.
- **Lembra onde você parou.** Feche a aba e abra de novo: você está no mesmo lugar. Isso acompanha
  o capítulo se você o renomeia ou move. Se o capítulo é apagado, você começa pelo topo.
- **Um livro sem capítulos** diz "Este livro ainda não tem capítulos para ler.", com um botão
  **Criar o primeiro capítulo**. Na aba de leitura, **Abrir o esboço** volta ao esboço.

Ligue ou desligue junto com o esboço (Recursos › Esboço e beats fantasmas).

## Defina uma meta e acompanhe o progresso

*Recursos › Metas e sprints.*

O Escrita conta as palavras que você digita na nota ativa, dentro das pastas que ele acompanha. Ele
não conta o que você cola, importa ou sincroniza: uma única mudança que acrescenta ou remove mais
palavras do que um tamanho que você escolhe é ignorada. As palavras que você apaga na revisão
também não se perdem: a janela de progresso mostra "cortadas na revisão" ao lado do que você
acrescentou.

- **Uma meta diária** para toda a sua escrita: **Meta diária de palavras**.
- **Uma meta e um prazo para cada livro.** Ponha-os nas propriedades da nota do livro, como `goal`
  e `deadline`. Você também pode defini-los na janela de progresso.
- **Um dia que termina tarde.** As palavras escritas depois da meia-noite podem contar para o dia
  anterior, até uma hora que você escolhe: **O dia de escrita termina às**.

```
goal: 80000
deadline: 2027-03-01
```

Escreva as quantidades como `80000`, ou entre aspas se tiverem separadores (`"80.000"`). Sem
aspas, `80.000` é o número decimal 80.

### A janela de progresso

Rode **Abrir progresso**, ou clique no contador da barra de status. A janela mostra:

- **Hoje**: suas palavras contra a meta diária, e quantas você cortou na revisão.
- **Livro**: o total do livro contra a meta dele, com os capítulos contados.
- **Sequência**: os dias seguidos em que você escreveu. Ela sempre conta toda a sua escrita, mesmo com a janela aberta para um livro ou texto.
- **Esta semana**: a sua média por dia.
- **Este texto**: para um conto ou ensaio, o tamanho dele contra a meta ou o limite.

Abaixo dos blocos há um gráfico de 30 dias de palavras por dia, com o total corrido do livro. Aberta para um livro ou texto, as barras são as palavras daquele livro ou texto, e não são coloridas pela meta diária. Sob
ele fica o **ritmo**: as palavras por dia de que você precisa para cumprir o prazo, e a data em que
você termina na sua média de 7 dias. O ritmo conta só os seus dias de escrita. Se o prazo passou,
ou você não acrescentou nada na última semana, ele diz isso em vez de adivinhar.

Aberta a partir de um capítulo ou da nota de um livro, a janela mostra o livro. Aberta a partir de
um conto ou ensaio com meta, limite ou prazo, mostra esse texto.

### A barra de status

A barra de status mostra as palavras do capítulo atual e do livro, as palavras de hoje contra a sua
meta e a sua sequência. Com texto selecionado, mostra a contagem da seleção. Clique nela para abrir
a janela de progresso. Para desligar, use **Mostrar o progresso na barra de status**.

### Sprints

Um sprint é uma arrancada com tempo marcado e uma meta de palavras. Rode **Começar um sprint** para
começar um com a duração e a meta padrão. A barra de status mostra o tempo que falta e as palavras
até agora, com um botão **parar**. **Parar o sprint** o encerra antes da hora. Ao alcançar a meta
você recebe um aviso, e quando o tempo acaba você vê as palavras, os minutos e o seu ritmo por
hora. Um sprint não é guardado se você fecha o Obsidian. Você também pode começar um pela janela de
progresso, com duração e meta próprias.

### Dias de folga

Escolha dias da semana e datas específicas de folga. Uma folga nunca quebra a sua sequência, e o
ritmo conta só os dias em que você escreve. Escrever numa folga conta do mesmo jeito.

### Configurações das metas

Em Configurações › Escrita › Metas: **Meta diária de palavras**, **O dia de escrita termina às**,
**Pastas acompanhadas** (uma por linha; vazio acompanha o cofre inteiro), **Pastas ignoradas**,
**Ignorar saltos acima de**, **Sprint padrão** (minutos e, depois, meta de palavras), **Mostrar o
progresso na barra de status**, **Dias de folga na semana** e **Datas de folga** (uma por linha, no
formato AAAA-MM-DD). **Propriedade da meta do livro** e as quatro propriedades de um texto, abaixo,
ficam em Propriedades e pastas.

## Dê uma meta a um texto: um conto ou um ensaio

Qualquer nota pode ter a sua própria meta de tamanho, não só os livros. Nas propriedades dela,
defina:

```
target: 5000
limit: 6000
unit: words
deadline: 2026-12-01
```

- `target` é o tamanho que você quer alcançar. `limit` é um máximo rígido, como o de um concurso.
- `unit` é `words` (palavras), `characters` (caracteres com espaços) ou `characters-no-spaces`
  (sem espaços). Uma nota com só `unit: characters` continua sendo contada em caracteres.
- `deadline` é uma data, AAAA-MM-DD.

Os caracteres são contados no texto que o leitor vê: sem propriedades, comentários, código nem
marcas de formatação, e uma sequência de espaços conta como um. Uma letra acentuada ou um travessão
conta como um caractere. O tamanho da nota aparece na barra de status e na janela de progresso, e
ao lado do nome dela no explorador de arquivos. Uma nota perto do limite ou acima dele é marcada.

Os nomes das propriedades são configurações em Propriedades e pastas: **Propriedade da meta**,
**Propriedade do limite**, **Propriedade da unidade**, **Propriedade do prazo** e **Propriedade da
meta do livro**. Escreva as quantidades como `15000`, ou entre aspas se tiverem separadores
(`"15.000"`).

## Deixe um lembrete para depois: marcadores

*Recursos › Marcadores.*

Quando você não sabe um detalhe, não pare. Marque o lugar e continue escrevendo:

```
%% XXX: ver se o porão tem janela %%
```

Rode **Inserir marcador** para pôr o marcador onde você está. Você pode associá-lo a um atalho nas
configurações do Obsidian (o Escrita não define nenhum), ou pô-lo na barra de ferramentas do
celular.

- **No editor**, um marcador aparece como uma pequena pílula vermelha. Na Visualização ao vivo, com
  o cursor em outro lugar, o `%% XXX:` e o `%%` ficam escondidos e o marcador aparece como um
  rótulo. Ponha o cursor nele para ver o texto cru.
- **No explorador de arquivos**, uma nota com marcadores ganha um ponto, e no esboço um capítulo
  ganha um selo com a contagem.
- **Próximo marcador nesta nota** e **Marcador anterior nesta nota** passam por eles.
- **Abrir marcadores** abre o painel **Marcadores**. Ele os lista para **Este livro** ou **Todas as
  notas**. Clique num para ir até ele. O botão de resolver remove o marcador da nota, depois que
  você já escreveu a resposta.
- **Eles seguram a publicação.** A verificação de publicação para diante de um marcador esquecido
  numa nota (veja [Publicação](publishing.md)).

Configurações, na seção Marcadores: **Palavra do marcador** (a palavra, `XXX` por padrão) e
**Marcar no explorador os arquivos com marcadores**.

## Escreva sem parar: o fluxo do Enter e a tipografia

*Recursos › Enter e tipografia.*

### Enter, Enter, Enter

Vem desligado por padrão. Ligue **Enter, Enter, Enter** na seção Editor. Depois, num capítulo ou
em outra nota acompanhada, apertar Enter numa linha vazia além do espaço normal entre parágrafos
faz uma **quebra de cena**:

```
a última linha da cena

---

a primeira linha da seguinte
```

O que é "um espaço normal" vem da configuração **Parágrafos são separados por**: **Uma linha em
branco** (Markdown padrão, então você aperta Enter três vezes depois da última linha) ou **Uma
única quebra de linha** (duas vezes). Num capítulo, mais um Enter depois de uma quebra de cena no
fim da nota faz o **próximo capítulo**: o Escrita o cria depois do atual, com o título "Sem
título", e o abre no lugar desta aba. Um conto só ganha quebras de cena. Nada acontece dentro de
propriedades, código ou comentários.

**Inserir quebra de cena** põe uma quebra no cursor, com as linhas em branco em volta ajustadas.
Ele se recusa a pôr uma nas propriedades.

### Tipografia inteligente

Vem ligada por padrão (**Tipografia inteligente**). Enquanto você digita:

- `--` depois de uma palavra vira —.
- `--` no começo da linha vira — de diálogo (**Travessão de diálogo**).
- `...` vira …
- Aspas retas se curvam no seu estilo (**Aspas**): “…” ‘…’, «…» ‹…›, „…“ ‚…‘, ou **Não mexer nas
  aspas**. O apóstrofo vira ’.

Aperte Backspace logo depois de uma troca para recuperar o que você digitou. Uma barra invertida
mantém o próximo caractere como foi digitado. Nada muda em propriedades, código ou matemática.
**Onde a tipografia inteligente vale** é **Só nos capítulos de livros** (o padrão) ou **Em todas
as notas**.

As configurações ficam na seção Editor: **Enter, Enter, Enter**, **Parágrafos são separados por**,
**Tipografia inteligente**, **Onde a tipografia inteligente vale**, **Aspas** e **Travessão de
diálogo**. As aspas e o estilo de parágrafo são compartilhados com o foco no diálogo e a lente de
revisão, então aparecem enquanto um deles está ligado.

## Leia só as falas: foco no diálogo

*Recursos › Foco no diálogo.*

**Ligar/desligar foco no diálogo** esmaece tudo na nota, menos as falas, para você ler o diálogo
de uma cena sozinho. Fala é:

- uma linha que começa com travessão (—, – ou ―). Travessões com espaço dentro do parágrafo
  passam para a narração e voltam: `— Vem cá — disse ela. — Agora.`
- tudo que está entre aspas duplas do seu estilo de aspas, e `"` retas.

Uma linha quebrada à mão dentro de um parágrafo continua sendo fala. Código, propriedades e
comentários nunca são fala. Funciona na Visualização ao vivo e no Código-fonte, não no modo de
leitura, e fica ligado naquela nota até você desligar ou reiniciar o Obsidian. A única
configuração dele é **Aspas**, compartilhada com a tipografia inteligente. A lente de revisão
mostra a parcela de diálogo do mesmo texto (veja [Revisão](revision.md)).

## Mover um parágrafo ou uma cena

*Recursos › Mover parágrafo ou cena.*

Quatro comandos trocam o parágrafo, ou a cena entre quebras `---`, sob o seu cursor com a vizinha:
**Mover parágrafo para cima**, **Mover parágrafo para baixo**, **Mover cena para cima** e **Mover
cena para baixo**. Eles não têm atalhos padrão; associe os que quiser nas configurações do
Obsidian.

- **Um desfazer.** A mudança toda é uma só.
- **Algumas coisas ficam onde estão.** Beats, comentários, blocos de código e de matemática, e as
  propriedades não se movem. Um parágrafo passa por cima de um deles como se fosse um vizinho.
- **Nada quebra.** Uma mudança que alteraria como a nota é lida é recusada, e um aviso diz isso.
  Um parágrafo na ponta da nota não se move.

Funcionam no editor, na Visualização ao vivo ou no Código-fonte.

## Inserir de um modelo

*Recursos › Inserir de um modelo.*

Defina a **Pasta de modelos** (em Livros) e rode **Inserir de um modelo**. Ele lista as notas dessa
pasta, com o caminho embaixo do nome. A que você escolhe entra no cursor, ou no fim da sua seleção.

- `{{title}}`, `{{date}}` (AAAA-MM-DD) e `{{time}}` (HH:mm) são preenchidos.
- As propriedades do modelo são acrescentadas à sua nota só onde ela ainda não as tem. Nada é
  sobrescrito.
- Tudo entra como uma única mudança, então um desfazer a desfaz.
- Beats e marcadores num modelo funcionam normalmente depois de inseridos.

Sem pasta de modelos definida, o comando avisa e oferece abrir as configurações. Se a nota mudar
enquanto o modelo carrega, nada é inserido. A mesma pasta guarda os modelos que o universo usa
(veja [O mundo](the-world.md)).

## Ortografia sob demanda

*Recursos › Ortografia sob demanda.*

**Ligar/desligar corretor** liga ou desliga os sublinhados de ortografia do Obsidian. Esconda-os
enquanto você rascunha e ligue quando for revisar.

## Veja as contagens no explorador de arquivos

*Recursos › Contagens no explorador.*

Notas acompanhadas e capítulos mostram o tamanho ao lado do nome, na unidade da própria nota
(palavras, ou caracteres para uma nota com `unit: characters`). A nota de um livro, a pasta dele e
a pasta de capítulos mostram o total do livro. Acima de 10.000 o número é abreviado (`12,3 mil`, ou
`12.3k` em inglês), e a contagem completa fica na dica.

- **Uma meta ao lado da contagem.** Com **Mostrar a meta ao lado da contagem**, uma nota com meta
  ou limite mostra `4.210 / 5.000`. Um capítulo mostra a meta efetiva, então um capítulo que usa o
  padrão do livro também a mostra.
- **Totais das pastas.** Com **Mostrar o total das pastas**, as outras pastas mostram as palavras
  das notas acompanhadas que estão nelas. Os livros sempre mostram o total.
- **Um limite.** Uma nota perto do limite ou acima dele é marcada.
- **O ponto dos marcadores** fica ao lado do nome também.

As configurações estão na seção Metas. Quais notas são acompanhadas vem de **Pastas acompanhadas**
e **Pastas ignoradas**.

## Quando algo parece errado

| Você vê | Por quê | O que fazer |
|---|---|---|
| Nenhuma faixa num capítulo | Ele não tem a propriedade `pov`, ou o nome na configuração é outro | Acrescente `pov`, ou mude a configuração |
| Duas faixas de cores diferentes para um personagem | O texto e o link escrevem o nome de jeitos diferentes | Use um link só, ou dê à entrada um apelido igual ao texto |
| Arrastar não funciona | Há um filtro ligado | Clique em **Limpar** |
| Um capítulo não tem barra | Sem meta própria e sem `chapterTarget` no livro | Acrescente um dos dois |
| A barra usa a unidade errada | O `unit` do capítulo ou do livro diz isso | Mude ou remova a propriedade |
| Um capítulo não mostra meta no explorador | O livro não tem `chapterTarget`, ou a configuração está vazia | Acrescente `chapterTarget` à nota do livro |
| O Enter não faz quebra de cena | **Enter, Enter, Enter** está desligado, a nota não é acompanhada, ou você está em propriedades, código ou comentário | Ligue a opção, ou veja onde você está |
| As aspas não se curvam | **Aspas** está em "Não mexer nas aspas", ou a nota não é um capítulo | Mude a configuração, ou use **Em todas as notas** |
| Minhas palavras não contaram | A nota está fora de **Pastas acompanhadas**, ou a mudança passou de **Ignorar saltos acima de** | Veja as pastas e o tamanho |
| Um movimento não fez nada | O cursor está num beat, comentário, código ou matemática, ou a nota está na ponta | Ponha o cursor num parágrafo |
