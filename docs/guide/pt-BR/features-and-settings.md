# Recursos e configurações

O Escrita tem muitos recursos, e a maioria das pessoas usa poucos. Desde a 0.7 você pode
desligar os que não usa. Um recurso desligado não é carregado: não acrescenta comandos,
painéis, itens de menu nem trabalho em segundo plano. Os seus dados ficam, e voltam quando
você liga o recurso de novo.

Outras páginas: [Escrita](writing.md), [Publicação](publishing.md) e [O mundo](the-world.md).

## A página Recursos

Abra Configurações › Escrita. A seção **Recursos** fica no topo. Ela tem:

- **Idioma da escrita**. Automático segue o idioma do Obsidian: qualquer português dá pt-BR e
  qualquer inglês dá inglês. Outro idioma dá nenhum. A lente de revisão e o reconhecimento de
  nomes leem esse idioma. (Antes ele ficava na seção Revisão.)
- **Dezenove interruptores em cinco grupos**, cada um com uma linha sobre o que faz. Os
  estágios ficam sempre ligados, porque o esboço, a aba Obras e a checagem de publicação leem
  os estágios.

| Grupo | Interruptores |
|---|---|
| Escrita | Metas e sprints · Esboço e beats fantasmas · Marcadores · Enter e tipografia · Foco no diálogo · Mover parágrafo ou cena · Inserir de um modelo · Ortografia sob demanda · Contagens no explorador |
| Revisão | Lente de revisão · Versões · Darlings |
| Acompanhamento | Versão a cada estágio · Bloco de obras e onde você parou |
| Publicação | Checagem de publicação · Exportar · Envios |
| O mundo | Universo compartilhado · Fios |

Três interruptores eram configurações antes da 0.7, e agora ficam só aqui: **Contagens no
explorador**, **Ortografia sob demanda** e o modo do **Universo compartilhado**. A linha do
universo é uma lista (Desligado, Por livro, Universo) em vez de um interruptor, porque o modo
é o interruptor.

Quando você atualiza, todos os recursos ficam ligados, então nada some até você escolher.
Exportar e Envios são os dois interruptores que a 0.8 acrescenta, no grupo Publicação.

## O que cada interruptor desliga

| Interruptor | Desligado significa |
|---|---|
| Metas e sprints | Sem contagem de palavras escritas, meta diária, janela de progresso, sprints nem barra de status. As configurações dele se escondem. |
| Esboço e beats fantasmas | Sem painel do esboço, sem beats fantasmas no editor, sem comandos de beat. |
| Marcadores | Sem pílulas de marcador, pontos no explorador, painel nem selo no esboço. (A checagem de publicação continua parando num marcador esquecido numa nota, enquanto a Publicação estiver ligada.) |
| Enter e tipografia | O Enter não faz quebras de cena nem capítulos; sem travessões e aspas automáticos. |
| Foco no diálogo | O comando e o esmaecimento somem. |
| Mover parágrafo ou cena | Os quatro comandos de mover somem. |
| Inserir de um modelo | O comando some. (O universo continua usando a pasta de modelos.) |
| Ortografia sob demanda | O comando que liga e desliga some. |
| Contagens no explorador | Sem contagens, totais de pasta nem metas ao lado dos nomes. |
| Lente de revisão | Sem lente, painel, comandos de percorrer nem itens de menu. |
| Versões | Sem comandos de versão, tela de comparar, versões automáticas nem "versão antes de publicar". |
| Darlings | Sem "Mover seleção para os darlings", painel nem restaurar. |
| Versão a cada estágio | Uma mudança de estágio não guarda versão. |
| Bloco de obras e onde você parou | O bloco `escrita-works` aparece como código simples; o Escrita para de registrar onde você parou; sem comando da nota inicial nem abrir ao iniciar. |
| Checagem de publicação | Sem comandos de publicar e despublicar. |
| Exportar | Sem os comandos **Exportar…** e **Exportar de novo**, sem item no menu do arquivo e sem a seção Exportação nas configurações. A linha da pasta das exportações continua. |
| Envios | Sem o comando nem o item de menu **Registrar envio**, sem a contagem de pendentes no bloco de obras e sem a seção Envios nas configurações. A linha da pasta dos envios continua. |
| Universo compartilhado | Sem painel, sem comandos do universo, sem "Aparece em", sem marcas de nomes nem nomes na lente. |
| Fios | Sem comandos de fio, sinal na margem nem aba no painel. |

Ao desligar um recurso, um aviso curto diz o que fica e onde.

## Que dados ficam

Nada é apagado quando você desliga um recurso.

- **Versões**: os arquivos ficam na sua pasta de versões. O aviso diz o nome dela e quantas
  são.
- **Darlings**: os trechos cortados ficam nas suas notas. Ligue de novo para restaurá-los.
- **Metas**: o seu histórico de escrita fica nos dados do Escrita (o aviso diz quantos dias).
- **Lente**: as suas listas de palavras ficam na nota delas.
- **Acompanhamento**: o ponto onde você parou fica nos dados do Escrita.
- **Exportar**: os arquivos já gravados ficam na pasta das exportações. As suas escolhas para cada obra (formato, modelo, capítulos) e a última exportação ficam nos dados do Escrita, e acompanham renomeações e mudanças de lugar com o recurso desligado. Ligue de novo e "Exportar de novo" ainda conhece o último arquivo.
- **Envios**: as notas de envio ficam onde estão, na pasta dos envios. O aviso diz o nome da pasta e quantas notas há. São notas comuns: com o recurso desligado elas continuam sem entrar nas metas e sem virar obras. Se você já usa esse nome de pasta para outra coisa, mude a pasta nas configurações.
- **Fios**: os marcadores ficam nas suas notas; as datas em que cada um foi visto pela
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

## Linhas de pasta e como os campos salvam

A pasta das exportações (padrão `Escrita/Exports`), a pasta dos envios (padrão `Submissions`)
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

Remover comandos durante o uso exige o Obsidian **1.7.2** ou mais novo. A 0.7 do Escrita e as
seguintes pedem essa versão.

## Quando algo parece errado

| Você vê | Por quê | O que fazer |
|---|---|---|
| Falta um comando | O recurso dele está desligado | Ligue na seção Recursos |
| O bloco de obras não mostra pendentes | Envios está desligado, ou nada espera resposta | Ligue Envios |
| Falta uma configuração | Todos os recursos que a leem estão desligados | Ligue um; a configuração volta |
| Um ícone da lateral diz que o recurso está desligado | Você o desligou nesta sessão | Ligue o recurso, ou reinicie para tirar o ícone |
| O interruptor da versão a cada estágio está cinza | Versões está desligado | Clique em **Ligar Versões** |
| O bloco inicial aparece como código | O acompanhamento está desligado | Ligue "Bloco de obras e onde você parou" |
