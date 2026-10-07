# Primeiros passos

Esta página leva você da instalação do Escrita até o primeiro conto e o primeiro livro. Dá
para fazer tudo com um comando, **Preparar o cofre para escrever**, que mostra tudo antes de
criar qualquer coisa. Ou você pode pular o comando e fazer à mão: as duas últimas partes da
página mostram como.

Outras páginas: [Recursos e configurações](features-and-settings.md), [Escrita](writing.md),
[Publicação](publishing.md) e [O mundo](the-world.md).

- [Instalar o Escrita](#instalar-o-escrita)
- [O aviso da primeira vez](#o-aviso-da-primeira-vez)
- [Preparar o cofre para escrever](#preparar-o-cofre-para-escrever)
- [O que o preparo nunca faz](#o-que-o-preparo-nunca-faz)
- [Os exemplos](#os-exemplos)
- [A nota inicial](#a-nota-inicial)
- [Dois layouts: a mesa de escrita e o modo escrita](#dois-layouts-a-mesa-de-escrita-e-o-modo-escrita)
- [Seu primeiro conto, à mão](#seu-primeiro-conto-à-mão)
- [Seu primeiro livro, à mão](#seu-primeiro-livro-à-mão)
- [Comandos e configurações desta página](#comandos-e-configurações-desta-página)

## Instalar o Escrita

O Escrita pede o Obsidian **1.8.7 ou mais novo**. Funciona no computador e no celular.

- **Pela lista de plugins da comunidade**, quando o Escrita for aceito lá: abra Configurações ›
  Plugins da comunidade › Procurar, busque "Escrita", instale e ative.
- **Com o BRAT**: instale o plugin BRAT, escolha "Add a beta plugin" e digite
  `ClaudioDavi/escrita`.
- **À mão**: baixe `main.js`, `manifest.json` e `styles.css` da última versão publicada no
  GitHub. Coloque os três em `<seu cofre>/.obsidian/plugins/escrita/`, recarregue o Obsidian e
  ative o Escrita em Configurações › Plugins da comunidade.

O Escrita nunca fala com um servidor. O que você escreve fica no seu cofre.

Numa instalação nova, os padrões vêm do idioma do Obsidian, uma vez só: qualquer português dá
padrões em português (status como `rascunho`, pastas como `Capítulos`) e qualquer outro idioma dá
padrões em inglês. Eles ficam salvos, então não mudam quando o idioma do Obsidian muda. Uma
instalação nova também começa com o conjunto de recursos **Escritor** (veja
[Recursos e configurações](features-and-settings.md)). Se você atualiza de uma versão
anterior, nada muda: suas configurações e seus interruptores ficam como estavam.

## O aviso da primeira vez

Na primeira vez que o Escrita carrega numa instalação nova, aparece um aviso pequeno:

> Escrita está pronto. Quer preparar este cofre para escrever? Mostro tudo antes de criar.

Ele tem dois botões, **Preparar…** e **Agora não**. Some sozinho depois de uns vinte segundos.
É um aviso, não uma janela: você pode ignorá-lo e continuar trabalhando.

Aparece uma vez só, qualquer que seja a resposta. Quem atualiza de uma versão anterior nunca o
vê. Você pode rodar o preparo quando quiser, pela paleta de comandos (próxima parte).

## Preparar o cofre para escrever

Abra a paleta de comandos e rode **Preparar o cofre para escrever** (em inglês, **Set up a
writing vault**). O comando não tem atalho. Pode rodar quantas vezes quiser: o que já existe
aparece como "fica", e nada é tocado duas vezes.

A janela tem dois passos. Nada é gravado até você apertar **Criar** no segundo.

### Passo 1: escolhas

- **O que você escreve?** **Contos e ensaios**, **Um romance** ou **Os dois**. Contos e ensaios
  cria uma pasta para eles (`Contos`). Um romance cria uma pasta para livros (`Livros`), onde
  cada livro ganha uma subpasta. Os dois cria as duas.
- **Idioma dos padrões.** **English** ou **Português (Brasil)**. Começa no idioma do Obsidian.
  Decide só as palavras que o Escrita grava nas notas e usa como nomes: os status, os nomes de
  pastas e notas, as listas. A interface continua no idioma do Obsidian. As notas de exemplo e a
  nota inicial também são escritas nesse idioma.
- **Ponto de partida.** Três cartões: **Essencial** (9 de 19 interruptores), **Escritor** (16 de
  19) e **Tudo** (os 19). Começa em **Escritor**. Uma predefinição é um ponto de partida, não um
  modo: depois, cada interruptor é seu, em Configurações › Escrita › Recursos. O que cada uma liga
  está em [Recursos e configurações](features-and-settings.md).
- **Mundo compartilhado.** **Desligado**, **Por livro** ou **Universo**, para personagens e
  lugares. Só aparece com **Tudo**, porque o modo muda onde as entradas ficam; pode decidir
  depois. Veja [O mundo](the-world.md).

Aperte **Ver o que vou criar**.

### Passo 2: o que vou criar

O segundo passo lista tudo o que o preparo vai fazer, em grupos. Cada linha diz o que é e por
quê. Uma marca na frente avisa o que a linha vai fazer: **+** é novo, **=** fica como está e
**·** é uma configuração que muda.

| Grupo | O que lista |
|---|---|
| **Pastas** | `Contos` e/ou `Livros`. Uma pasta que já existe é usada como está, e a linha diz quantas notas há nela. Se você mantém uma lista de pastas acompanhadas, uma pasta nova entra nela (veja abaixo). |
| **Exemplos** | O conto de exemplo e o livro de exemplo, se você quiser (veja [os exemplos](#os-exemplos)). |
| **Configurações** | Cada configuração que o preparo mudaria, com o valor, e cada uma que ele deixa em paz, com o motivo. |
| **Nota inicial** | `Início.md` (`Home.md` em inglês), com o bloco de obras. |
| **Layout** | **Arrumar a tela uma vez**, com dois cartões: a mesa de escrita e o modo escrita. |

Algumas linhas têm uma caixa para marcar. Só as linhas marcadas rodam. Uma linha sem caixa não
tem escolha a fazer:

| Caixa | O que cobre |
|---|---|
| **Exemplos** | Todas as notas de exemplo juntas. |
| **Idioma dos padrões** | O idioma e cada configuração que leva palavras: **Status**, **Pasta de capítulos**, **Títulos de capítulo sem número**, **Resultados dos envios**, **Pasta de exportações**, **Pasta de envios**, as notas de darlings, **Nota do universo**, **Tipos de entrada**, **Valores de forma**, **Palavra dos fios**, **Palavra de fio fechado** e **Idioma da escrita**. |
| **Nota inicial** | Criar a nota inicial e defini-la como a sua **Nota inicial**. |
| **Abrir a nota inicial ao iniciar** | Abre a nota inicial quando o Obsidian inicia. |
| **Recursos** | Põe os interruptores como a predefinição que você escolheu. |
| **Arrumar a tela uma vez** | O layout. |

As linhas sem caixa são as pastas, a linha das pastas acompanhadas (**Pastas que contam**) e a
resposta de **Mundo compartilhado** que você deu no passo 1.

**Num cofre que já tem obras**, o preparo é cuidadoso. As caixas dos exemplos, do idioma, de abrir
ao iniciar e dos recursos vêm desmarcadas, com uma linha dizendo por quê ("Desmarcado: você já
tem obras"). O layout também vem desmarcado quando há mais de uma aba ou painel abertos. Marque a
linha se você quiser mesmo. Uma configuração que você mesmo salvou aparece como "fica" ("Você já
salvou esta; ela fica"), seja qual for a caixa.

**Pastas que contam.** O Escrita só conta palavras dentro das suas pastas acompanhadas. Se você
não tem nenhuma (o cofre inteiro conta), a linha diz isso e nada muda. Se tem, o preparo
acrescenta as pastas novas à lista. Nunca a substitui.

No fim, uma linha resume: "Nenhuma nota existente muda. Uma pasta que já existe é usada como está."
e "Vou criar 9 itens e mudar 6 configurações." Aperte **Voltar** para mudar as escolhas (as caixas
que você mexeu ficam), **Cancelar** para parar ou **Criar**.

### O que acontece quando você aperta Criar

1. As pastas são criadas.
2. As notas de exemplo e a nota inicial são gravadas.
3. As configurações são salvas, uma vez, por último, e só se todas as pastas existirem.
4. O layout é aplicado, se estiver marcado, e a nota inicial abre.

Um aviso diz o que aconteceu: "Pronto. Criei 9 itens e mudei 6 configurações. A nota inicial
está aberta."

Se algo falhar (um nome de arquivo que não vale, uma pasta que na verdade é um arquivo), o aviso
diz o que foi criado e o que não foi: "Criei 4 de 9 itens. Não consegui criar …". **Nada é
desfeito.** O que foi criado fica, as configurações não são salvas, e você pode rodar o comando de
novo depois de resolver a causa.

## O que o preparo nunca faz

- Nunca muda, sobrescreve nem apaga uma nota existente. Cada arquivo só é criado se não houver
  nada ali, em qualquer caixa de letras. Se uma nota aparecer depois da prévia, ela é contada como
  pulada, não gravada.
- Nunca muda uma configuração salva sem uma caixa marcada. As únicas coisas que mudam sem caixa
  são a lista de pastas acompanhadas (as pastas novas entram nela) e a resposta de **Mundo
  compartilhado** que você mesmo escolheu no passo 1.
- Nunca move suas versões nem muda a lista de pastas que o Escrita ignora. Uma instalação nova em
  português usa `Escrita/Versões` para as versões e `Modelos` como pasta de modelos; uma instalação
  que já existe mantém o que tem.
- Nunca fecha uma aba nem um painel. O layout acrescenta ao que está aberto.
- Nunca define um atalho de teclado, e nunca fala com um servidor.
- Nunca pede que você mantenha nada em dia. Roda uma vez, e depois as notas, as configurações e o
  layout são seus.

## Os exemplos

Os exemplos mostram cada recurso funcionando, para você olhar antes de escrever. Os nomes começam
com **Exemplo ·** (**Example ·** em inglês) e cada nota tem `example: true` nas propriedades, então
podem ser apagadas quando você quiser. A nota inicial diz isso também.

**Um conto**, na sua pasta de contos (com contos e ensaios, ou com os dois): *Exemplo · A
travessia* (*Example · The crossing*).

- Uma meta de 2.000 palavras e o status de rascunho.
- Dois beats (`%% beat: … %%`), para o esboço ter o que mostrar.
- Um pouco de prosa entre eles e um marcador (`%% XXX: … %%`), para o painel de marcadores e a
  checagem de publicação terem o que achar.

**Um livro**, na sua pasta de livros (com um romance, ou com os dois): *Exemplo · O farol*
(*Example · The lighthouse*).

- A nota do livro, com a premissa e uma meta padrão para os capítulos.
- Uma pasta de capítulos com dois capítulos. *01 Chegada* tem prosa, dois beats, um marcador e uma
  meta de 1.200 palavras. *02 A tempestade* tem três beats e ainda nenhuma prosa, então os beats
  aparecem como fantasmas, e uma meta de 1.500.

Num cofre que já tem obras, os exemplos vêm desmarcados. Apague quando quiser: nada mais depende
deles.

## A nota inicial

A nota inicial é uma nota sua. Ela tem um bloco de código, ` ```escrita-works `, e o Escrita o
desenha: o que escrever hoje, cada obra com o tamanho dela contra a meta ou o prazo, e
**Continuar**, que abre uma obra onde você parou. O Escrita desenha o bloco e nunca escreve nele.
Acrescente em volta o que quiser.

O preparo a cria como `Início.md` (`Home.md` em inglês) na raiz do cofre, começa com uma linha
dizendo que a nota é sua e a define como a sua **Nota inicial**. Se já existir uma nota com esse
nome em outra caixa de letras (`início.md`), o preparo a usa como está.

- **Abrir a nota inicial** abre a nota. Se ela ainda não existir, o comando oferece criar uma.
  Sem nota inicial definida, ele procura um `Início.md` ou `Home.md` que já exista.
- **Nota inicial** (Configurações › Escrita, seção Nota inicial) é o caminho da nota.
- **Abrir ao iniciar** abre a nota inicial na aba ativa quando o Obsidian inicia. Vem desligado, e
  o preparo tem uma linha para isso, **Abrir a nota inicial ao iniciar**.

Uma obra é um livro, ou uma nota acompanhada, cujo status é uma das suas palavras de estágio. O
bloco lista as obras que você está escrevendo e revisando, e conta as que são só ideia, prontas ou
publicadas. Cada obra abre onde você editou por último.

Se o bloco aparecer como código simples, o interruptor **Bloco de obras e onde você parou** está
desligado. Ligue-o em Recursos.

## Dois layouts: a mesa de escrita e o modo escrita

O passo 2 do preparo termina com **Arrumar a tela uma vez**. Escolha um cartão. Depois do preparo, o
Escrita não mexe mais no layout: ele é seu.

### A mesa de escrita

A nota inicial na frente, na área principal. À direita, a barra lateral é dividida em duas: o
esboço, com os capítulos e seus beats, em cima, e a lente de revisão embaixo, com os marcadores
como segunda aba atrás dela. Se o universo estiver ligado, o painel dele é uma segunda aba à
esquerda, atrás dos arquivos. Um painel cujo recurso está desligado fica de fora, e os outros se
ajustam.

No celular as gavetas não se dividem, então o esboço e a lente são duas abas da gaveta da direita.

A nota inicial abre numa aba que já a mostra, senão numa aba vazia, senão numa aba nova. Nunca abre
por cima de uma aba com outra coisa.

### Modo escrita

Só a nota. As barras laterais, a barra de abas, a faixa de ícones e a barra de status se
escondem (no celular, também o cabeçalho da nota). Duas coisas ficam:

- Um botão discreto **Sair do modo escrita** no canto, sempre visível, porque o celular não tem
  hover.
- Um contador pequeno embaixo, "hoje 312 / 500": suas palavras de hoje contra a meta diária. Só
  aparece enquanto **Metas e sprints** estiver ligado, e nada mais é mostrado.

**Continuar** no bloco de obras abre a obra na mesma aba, ainda no modo escrita.

Comandos: **Entrar no modo escrita** e **Sair do modo escrita**. Você vê um ou o outro, conforme o
estado. Nenhum tem atalho; atribua o que você usa em Configurações › Atalhos. Ao entrar, aparece um
aviso uma vez por sessão: "Modo escrita. Para sair: o botão no canto ou o comando."

A configuração **Abrir no modo escrita** (na seção Nota inicial, ao lado de **Abrir ao iniciar**)
abre o Obsidian no modo escrita, depois que a nota inicial abre. O preparo a liga quando você
escolhe o cartão do modo escrita.

O modo escrita não grava nada no seu cofre. Ele acrescenta uma classe de estilo e recolhe as
barras laterais que estavam abertas. Ao sair, reabre só as barras que fechou, e só volta o que ele
escondeu. Também sai sozinho se você desligar o acompanhamento ou desativar o Escrita. O modo
escrita faz parte de **Bloco de obras e onde você parou**; não há um interruptor separado.

Ele é pequeno de propósito. Se você quer mais (rolagem de máquina de escrever, esmaecimento, uma
coluna de texto mais larga), os plugins Zen Mode, Ultra Zen Mode e Easy View fazem isso, e o seu tema
define a coluna de leitura. O único extra do Escrita é o contador da meta e o **Continuar**. Evite
rodar dois desses ao mesmo tempo: os dois escondem as mesmas barras.

## Seu primeiro conto, à mão

Você não precisa do preparo para isso. Um conto é qualquer nota.

1. Crie uma nota onde quiser, por exemplo `Contos/A travessia.md`. Se você tem uma lista de pastas
   acompanhadas (Configurações › Escrita, **Pastas acompanhadas**), crie dentro de uma delas. Se a
   lista está vazia, o cofre inteiro é acompanhado.
2. Acrescente propriedades no topo da nota:

   ```
   ---
   status: rascunho
   target: 2000
   ---
   ```

   `status` é uma das suas palavras de estágio: `rascunho` nos padrões em português, `draft` nos
   em inglês. Elas ficam em Configurações › Escrita, **Estágios**. `target` é o tamanho que você
   quer, em palavras. Dá para acrescentar `unit: characters` para contar em caracteres, `limit`
   para um máximo rígido e `deadline: 2026-12-31`. Os nomes das propriedades também são
   configurações.
3. Escreva. O Escrita conta as palavras que você digita na nota, contra a sua meta diária (**Meta
   diária de palavras**, na seção Metas).
4. Planeje, se quiser. Uma linha `%% beat: Mara e o pai atravessam a baía %%` é um beat de cena:
   aparece no esboço e como um rótulo apagado no editor até a prosa chegar. Uma linha
   `%% XXX: o nome da cidade %%` é um marcador para algo que você ainda não sabe. **Inserir
   marcador** coloca um no cursor. Os dois são comentários do Obsidian, então a visualização de
   leitura os esconde.
5. Abra a nota inicial. Com o status num estágio e a nota numa pasta acompanhada, o conto é uma obra,
   e o bloco o lista com o tamanho dele contra a meta.

Quando terminar, mude o status para o estágio seguinte. Como revisar e publicar está em
[Escrita](writing.md) e [Publicação](publishing.md).

## Seu primeiro livro, à mão

Uma nota é um livro quando uma pasta com o mesmo nome fica ao lado dela e essa pasta guarda uma
pasta de capítulos:

```
Livros/O farol.md                      a nota do livro
Livros/O farol/Capítulos/              a pasta de capítulos (o nome é uma configuração)
    01 Chegada.md                      uma nota por capítulo
    02 A tempestade.md
```

**O jeito rápido**: rode **Criar um livro**. Uma janela pede um **Título** e uma **Pasta** (vazio
é a raiz do cofre). O Escrita cria a nota do livro, com o status de rascunho e uma meta de 80.000
palavras, cria a pasta e a pasta de capítulos, cria um primeiro capítulo sem título e o abre com o
esboço. O comando funciona igual num cofre sem o preparo.

**À mão**: crie a nota, a pasta com o mesmo nome e a pasta de capítulos dentro dela, e depois uma
nota para cada capítulo. O nome da pasta de capítulos é **Nome da pasta de capítulos** nas
configurações (`Capítulos` nos padrões em português, `Chapters` nos em inglês). Os nomes dos
arquivos de capítulo começam com o número (`01 Chegada.md`). O Escrita mantém os números em ordem
quando você acrescenta, remove ou move capítulos.

Depois, abra o esboço. **Novo capítulo…** (ou Enter) acrescenta um capítulo, e dentro de um
capítulo uma linha `%% beat: … %%` é um beat. O `status` da nota do livro é uma palavra de
estágio, como num conto, então o livro aparece no bloco de obras.

O esboço, as metas por capítulo e o resto estão em [Escrita](writing.md).

## Comandos e configurações desta página

| Nome | O que faz |
|---|---|
| **Preparar o cofre para escrever** (comando) | Abre a janela de dois passos. Também se chega a ele pela página Recursos quando não há nota inicial. |
| **Abrir a nota inicial** (comando) | Abre a nota inicial. |
| **Entrar no modo escrita**, **Sair do modo escrita** (comandos) | Escondem e mostram tudo o que não é a nota. |
| **Nota inicial** (configuração) | O caminho da nota inicial. |
| **Abrir ao iniciar** (configuração) | Abre a nota inicial quando o Obsidian inicia. |
| **Abrir no modo escrita** (configuração) | Abre o Obsidian no modo escrita. |

**Criar um livro** é um comando do esboço; a página dele é [Escrita](writing.md).
