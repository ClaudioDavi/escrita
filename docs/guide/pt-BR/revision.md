# Revisão

Esta página é para o segundo rascunho: reler um conto, cortar o que não merece ficar, guardar o
que você cortou e poder voltar atrás. Três partes do Escrita ajudam, e nenhuma muda o seu texto
sem um clique seu:

- a **lente de revisão**, que sublinha o que vale a pena reler;
- as **versões**, cópias de uma nota que você pode comparar e restaurar;
- os **darlings**, trechos que você cortou mas não quer perder.

Outras páginas: [Recursos e configurações](features-and-settings.md), [Escrita](writing.md),
[Acompanhamento](tracking.md), [Publicação](publishing.md) e [O mundo](the-world.md). Cada parte tem o seu interruptor em
Recursos, no grupo Revisão: **Lente de revisão**, **Versões** e **Darlings**. Desligue um e os
comandos, o painel e os itens de menu dele somem. Os seus dados ficam (a nota de listas de
palavras, os arquivos de versões, a nota de darlings).

## Revise um conto

Um jeito de usar as três partes juntas:

1. Salve uma versão do rascunho, para sempre poder ver o que mudou.
2. Ligue a lente e passe pelo que ela marca. Corrija umas, ignore outras.
3. Corte o que não funciona com **Mover seleção para os darlings**, em vez de apagar.
4. Compare a nota com a sua versão para ver a revisão como um todo.
5. Gostou? Siga em frente. Não gostou? Restaure a versão, ou traga um darling de volta.

## A lente de revisão

Execute **Ativar ou desativar a lente de revisão** numa nota. O Escrita sublinha as ocorrências
no texto e abre um painel à direita. A lente só sugere. Ela nunca muda o seu texto, e nada sai
do seu aparelho. Ela fica ligada nessa nota até você desligá-la ou reiniciar o Obsidian.

Ela funciona no Live Preview e no modo Source, não no modo de leitura.
Se você tentar no modo de leitura, um aviso explica.

### As regras

Cada regra tem o seu estilo de sublinhado, e cada uma pode ser desligada em Configurações ›
Escrita › Revisão, em **Regras**.

| Regra | O que ela marca |
|---|---|
| **Ecos** | A mesma palavra, ou da mesma família (*olhar*, *olhou*, *olhando*), perto demais. A janela é de 40 palavras por padrão e recomeça a cada quebra de cena e a cada título. Nomes, palavras muito comuns e palavras com menos de 4 letras ficam de fora. |
| **Advérbios** | Palavras terminadas em *-mente* (português) ou *-ly* (inglês), menos palavras de verdade que só parecem advérbios (*mente*, *semente*, *only*, *family*). |
| **Gerúndios** | Palavras em *-ando*, *-endo* e *-indo*, o gerundismo (*vou estar enviando*) e três ou mais gerúndios numa frase. Em inglês esta regra se chama **Started to** e marca construções como *started to* e *began to*. |
| **Vícios** | As palavras e expressões que você lista na nota de listas de palavras (abaixo). Elas casam com palavras inteiras, em qualquer caixa, exatamente como escritas. Liste *começou a* e *começaram a*. |
| **Variantes de nome** | Uma palavra com inicial maiúscula que parece um erro de grafia de um nome da sua lista (*Maira* por *Maria*). O próprio nome, o plural ou diminutivo dele e uma palavra que você também escreve em minúscula nunca são marcados. |
| **Frases longas** | Uma frase com mais palavras que o limite, diálogo incluído. 45 palavras por padrão. |

Uma sétima regra, **Nomes sem entrada**, vem desligada. Ela aponta nomes com inicial maiúscula
que voltam e ainda não têm entrada. Precisa do universo, e por isso está descrita em
[O mundo](the-world.md#nomes-sem-entrada).

### O painel

O painel (**Lente de revisão**) mostra, para a nota inteira, ou para a sua seleção quando há
uma (aparece "Seleção"):

- **Diálogo**: a parte das palavras que é fala. Uma nota com várias cenas mostra também a parte
  de cada cena ("Cena 2").
- **Legibilidade**: palavras por frase, sílabas por palavra e uma pontuação de facilidade de
  leitura, com uma faixa como "fácil" ou "difícil" e uma linha que diz o que ela significa. Em
  português é o Flesch adaptado por Martins (1996). Em inglês é o Flesch. Um texto muito curto
  diz de quantas palavras e frases precisa.
- **Regras · na nota inteira**: uma linha por regra com a contagem e a taxa **por 1.000
  palavras**, para comparar um conto curto e um capítulo longo. Cada linha tem botões de anterior
  e próximo que selecionam a ocorrência ("3 / 12").

A contagem de sílabas é aproximada de propósito. A lente pula títulos, blocos de matemática e,
por padrão, citações com `>`, então a contagem de palavras dela pode diferir um pouco da barra
de status.

### Passe pelas ocorrências

Use os botões de próximo e anterior de uma linha, ou execute **Próxima ocorrência da lente de
revisão** e **Ocorrência anterior da lente de revisão**. Eles percorrem a regra que você usou
por último. Não têm atalho padrão: defina o seu nas teclas de atalho do Obsidian, ou ponha-os
na barra de ferramentas do celular. No celular a gaveta fecha depois de cada passo e um aviso
mostra onde você está ("Ecos · 3 / 12").

### Ignore uma ocorrência

Quando você discorda de uma ocorrência, use **Ignorar aqui**: no menu de contexto do editor, em
cima da ocorrência, ou no painel enquanto passa por elas. O Escrita a lembra pela nota, pela
regra, pela palavra e pelas palavras em volta, então ela continua ignorada depois de edições em
outras partes da nota. O painel passa a mostrar "N ignoradas" com um botão **Limpar**. Limpar
pergunta antes ("Voltar a mostrar as 3 ocorrências ignoradas nesta nota?"). As ocorrências
ignoradas acompanham a nota quando você a renomeia.

### Listas de palavras

Os vícios, os nomes e as palavras ignoradas vêm de uma nota sua, a **nota de listas de
palavras**. Ela tem três títulos, em português ou inglês, com uma entrada por linha:

| Português | Inglês | Para que serve |
|---|---|---|
| `## Vícios` | `## Crutch words` | Palavras e expressões que você usa demais. Marcadas pela regra **Vícios**. |
| `## Nomes` | `## Names` | Personagens e lugares. A regra **Variantes de nome** avisa quando um sai quase igual. |
| `## Ignorar` | `## Ignore` | Palavras que a lente nunca marca em ecos, advérbios, gerúndios e variantes de nome. Não valem para os vícios, que você listou de propósito. |

Execute **Criar a nota de listas de palavras** (ou aperte **Criar** nas configurações) e o
Escrita escreve uma nota com os três títulos e uma pequena lista inicial de vícios. Ele nunca
mexe numa nota que já existe: só a abre. Sem uma nota de listas, as regras de vícios e de nomes
ficam em silêncio e o resto funciona.

**Acrescente pelo editor.** Com a lente ligada, selecione uma palavra ou expressão curta (de 1 a
6 palavras), ou apenas ponha o cursor numa palavra, e abra o menu de contexto do editor.
**Adicionar aos vícios**, **Adicionar aos nomes** e **Ignorar sempre** a põem na lista
correspondente. Nada mais na nota muda. Uma seleção que contém `%%` ou começa como item de lista
não é oferecida, porque não seria lida de volta da nota. Se a nota ainda não existe, ela é criada
antes, e um aviso diz "Adicionado aos vícios: «palavra»". Uma palavra que já está lá diz "Já está
na lista".

### Idioma

A lente lê o **Idioma da escrita** (Automático, Português (Brasil) ou English), definido na
página Recursos. Veja [Recursos e configurações](features-and-settings.md). Em outro idioma, as
regras de ecos, advérbios, gerúndios e a legibilidade ficam desligadas, e o painel oferece
**Abrir configurações** para você escolher um. Vícios, variantes de nome, frases longas e a
parte de diálogo continuam funcionando.

### Configurações da lente

Em Configurações › Escrita › **Revisão**:

| Configuração | O que faz |
|---|---|
| **Nota de listas de palavras** | O caminho da nota de listas, com um botão **Criar**. Vazio significa `Listas de palavras.md` (`Word lists.md` em inglês). |
| **Janela dos ecos** | Quantas palavras para trás um eco procura. 40 por padrão, de 10 a 200. |
| **Frase longa** | Uma frase com mais palavras que isto é marcada. 45 por padrão, de 15 a 200. |
| **Pular citações** | Linhas que começam com `>` não são lidas. Ligada por padrão. |
| **Regras** | Um interruptor para cada regra. |
| **Nomes sem entrada** e **Não são nomes** | A regra opcional e a lista de palavras que ela nunca marca. Veja [O mundo](the-world.md#nomes-sem-entrada). |
| **Mostrar a parte de diálogo** | Mostra a medida de diálogo no painel. |
| **Mostrar a legibilidade** | Mostra a medida de legibilidade. |

Os campos numéricos salvam quando você sai do campo. Um valor fora do intervalo volta ao
anterior.

## Versões

Uma versão é uma cópia do texto de uma nota para a qual você pode voltar. É a rede de segurança
da revisão.

### Salve uma

Execute **Salvar uma versão** ou use **Salvar uma versão** no menu de arquivo. Uma janela pede um
nome ("Versão" por padrão). Dê um nome útil, como "Enviado à revista". Se nada mudou desde a
última versão, um aviso diz "Nada mudou desde a última versão."

O Escrita também salva versões sozinho. Cada uma recebe o rótulo do seu tipo:

| Tipo | Quando |
|---|---|
| **Versão** | Você mesmo salvou. |
| **Antes de publicar** | Você executa Publicar na nota (veja [Publicação](publishing.md)). |
| **Antes de restaurar** | A cada restauração, para que uma restauração sempre possa ser desfeita. |
| **Antes da primeira edição do dia** | A primeira mudança numa nota acompanhada num dia de escrita. Desligado por padrão. |
| **Mudança de estágio** | Uma obra passa para outro estágio, como de rascunho para revisão. Esta pertence ao interruptor **Versão a cada estágio**, descrita em [Acompanhamento](tracking.md#guarde-uma-versão-a-cada-estágio-a-versão-de-estágio). |

As versões automáticas são aparadas: só as mais novas ficam para cada nota, e as mais antigas
vão para a lixeira. As versões que você salva e as de mudança de estágio nunca são removidas.

### Veja-as: o painel Versões

Execute **Abrir versões**. O painel **Versões** lista as versões da nota ativa, com o tamanho e
quanto a nota mudou desde então (por exemplo "+120 palavras desde então", ou "mesmo tamanho
hoje"). Cada versão tem:

- **Ver**: o texto completo dela, na visão **Texto completo** da aba de comparação.
- **Comparar**: abre a aba de comparação.
- **Restaurar**: devolve a nota inteira, com as propriedades. Uma janela pergunta antes. O texto
  atual é salvo antes como "Antes de restaurar", e se a nota mudou durante a restauração, nada é
  substituído.
- **Renomear** e **Excluir**. Excluir manda o arquivo da versão para a lixeira, depois de
  perguntar.

### Compare

Execute **Comparar com a última versão** para uma olhada rápida, ou **Comparar** em qualquer
versão. A aba compara a versão com a nota como está agora, ou com outra versão. A lista
**Versão** escolhe a que você está olhando e **Comparar com** escolhe com o que ela é comparada
(**Texto atual** ou outra versão). A comparação é palavra por palavra, em três visões:

- **No texto** mostra as palavras acrescentadas e removidas dentro do texto.
- **Lado a lado** mostra as duas versões uma ao lado da outra.
- **Texto completo** mostra o texto da versão sozinho, sem comparação.
- Parágrafos sem mudança ficam dobrados ("12 parágrafos sem mudança"). Clique na linha para
  abri-los.
- Um parágrafo que você moveu recebe o rótulo **Movido**.
- Um resumo diz o que mudou: "+120, −45, 8% dos parágrafos mudaram". Uma mudança nas
  propriedades aparece como **Propriedades mudaram**.
- **Atualizar** compara de novo depois que você edita a nota.
- Num texto muito longo, algumas mudanças aparecem como parágrafos inteiros ("Texto longo:
  algumas mudanças aparecem como parágrafos inteiros.").

Na comparação, **Usar o texto antigo** devolve um trecho (ou as propriedades), e só isso. Se o
trecho mudou depois da comparação, nada é substituído.

### Notas excluídas

As versões acompanham a nota quando você a renomeia ou move, e ficam guardadas quando você a
exclui. Execute **Ver versões de notas excluídas** para vê-las. Abra uma e copie o texto de
volta. A aba de comparação então diz "A nota não existe mais. Este é o texto da versão: copie o
que precisar."

### Onde ficam

As versões são arquivos `.txt` simples numa pasta com uma subpasta por nota, mais um
`index.json`. A busca, o grafo e os links os ignoram. Em Configurações › Escrita › **Versões**:

| Configuração | O que faz |
|---|---|
| **Pasta das versões** | Onde elas ficam. Vazio significa `Escrita/Snapshots`. Mudar não move as versões existentes. |
| **Versão antes da primeira edição do dia** | Na primeira vez que você altera uma nota acompanhada num dia de escrita, o Escrita guarda o texto como estava. Desligada por padrão. |
| **Versões automáticas por nota** | Quantas versões automáticas guardar. 20 por padrão, no mínimo 1. |

A pasta tem regras. Um aviso aparece sob a configuração e o valor antigo fica quando a nova
pasta não é uma pasta simples dentro do cofre, está na pasta de configurações do Obsidian ou numa
pasta acompanhada, tem um livro dentro, já tem notas, ou se sobrepõe à pasta de exportação ou de
envios. Uma pasta que começa com ponto fica oculta, mas o **Obsidian Sync** não a sincroniza. O
Sync só copia os arquivos de versões com "Sincronizar todos os outros tipos" ativado. Git,
iCloud, Dropbox e Syncthing os copiam normalmente. Se duas notas têm nomes que só diferem em
espaços especiais ou acentos, elas dividiriam uma pasta, e um aviso pede que você renomeie uma.

## Darlings

*Darlings* são os trechos que você ama e que a história não precisa. Não os apague. Mova-os.

### Corte um trecho

Selecione o trecho e execute **Mover seleção para os darlings**, ou escolha **Mover para os
darlings** no menu de contexto do editor. No celular, ponha o comando na barra de ferramentas. O
trecho sai da nota num único passo de desfazer e vai para uma nota de darlings, com um link para
o lugar de onde veio e a data. Um aviso diz "Movido para os darlings — restaure pelo painel
Darlings."

Se o texto mudou enquanto salvava, o Escrita copia o trecho para os darlings mas o deixa onde
estava. Ele nunca o perde.

### Para onde vão

Em Configurações › Escrita › **Darlings**:

| Configuração | O que faz |
|---|---|
| **Nota de darlings dentro de um livro** | O caminho da nota, dentro da pasta do livro. `Darlings.md` por padrão. |
| **Nota de darlings para o resto** | A nota para contos, ensaios e qualquer nota que não esteja num livro. `Darlings.md` por padrão, um caminho a partir da raiz do cofre. |

É uma nota comum, sua. Cada darling é um trecho com a origem num título, um comentário com os
dados de que o Escrita precisa e o seu texto exatamente como você escreveu. Execute **Abrir
darlings** para abrir o painel, que lista o que você cortou, com uma contagem ("3 darlings"), e
**Abrir a nota de darlings** para abrir a nota.

### Traga um de volta

No painel **Darlings**:

- **Restaurar** devolve o trecho para onde ele estava. O Escrita usa o texto que o cercava para
  achar o lugar. Se esse texto mudou, o trecho vai para o fim da nota, e um aviso diz isso. Se o
  trecho já tinha voltado, ele só é retirado dos darlings.
- **Abrir origem** abre a nota de onde ele foi cortado.
- **Excluir** o remove da nota de darlings, depois de perguntar. Se o plugin Recuperação de
  arquivos do Obsidian estiver ativado, ainda dá para trazer o trecho de volta.

Se a nota de origem não existe mais, o Escrita pergunta se deve colar o trecho no cursor da nota
que você tem aberta.

## Quando algo parece errado

| Você vê | Por quê | O que fazer |
|---|---|---|
| A lente não mostra nada | A lente está desligada nesta nota, ou você está no modo de leitura | Execute **Ativar ou desativar a lente de revisão** e saia do modo de leitura |
| Sem ecos, advérbios nem gerúndios | O idioma da escrita não é português nem inglês | Escolha um em Recursos |
| Vícios ou variantes de nome nunca aparecem | Não há nota de listas, ou os títulos dela são outros | Execute **Criar a nota de listas de palavras** |
| Uma palavra das listas não é marcada | Palavras inteiras casam como escritas: *começou a* não casa com *começaram a* | Liste cada forma |
| "Já está na lista" | A palavra já está lá | Nada a fazer |
| A pasta das versões não é salva | A pasta quebra uma regra | Leia o aviso sob a configuração |
| **Restaurar** diz que nada foi substituído | A nota mudou durante a restauração | Tente de novo |
| Um darling foi para o fim da nota | O texto em volta do lugar antigo mudou | Mova-o para onde quiser |
