# Escrita

Esta página cobre o que a 0.7 acrescenta ao esboço (ponto de vista, status e filtros, e metas
por capítulo) e, desde a 0.9, a leitura do livro inteiro. As outras partes da página (metas, marcadores, digitação, mover blocos, modelos
e o resto) ainda vão chegar, e por enquanto o README as lista.

Outras páginas: [Recursos e configurações](features-and-settings.md) e
[O mundo](the-world.md). Ligue ou desligue o esboço em Recursos › Esboço e beats fantasmas.

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
configuração (**Propriedade da meta dos capítulos**).

- **O capítulo vence.** Um capítulo com `target: 1500` mostra a barra dele. O rótulo da barra
  diz de onde veio a meta: "meta do capítulo" para a do próprio capítulo.
- **Só a meta é herdada.** O `limit` e o `deadline` de um capítulo continuam sendo dele.
- **A unidade.** O `unit` do próprio capítulo vence. Sem ele, vale o `unit` da nota do livro, e
  sem esse, palavras. Então `unit: characters` na nota do livro conta todos os capítulos em
  caracteres, e um capítulo ainda pode escolher a sua.
- **Sem meta, sem barra.** Um livro sem `chapterTarget` e com capítulos sem meta não mostra
  barras.
- **O padrão aparece só no esboço.** As contagens do explorador e as metas leem as propriedades
  de cada capítulo, então o explorador pode não mostrar meta ao lado de um capítulo em que o
  esboço mostra uma barra vinda do padrão do livro.

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

## Quando algo parece errado

| Você vê | Por quê | O que fazer |
|---|---|---|
| Nenhuma faixa num capítulo | Ele não tem a propriedade `pov`, ou o nome na configuração é outro | Acrescente `pov`, ou mude a configuração |
| Duas faixas de cores diferentes para um personagem | O texto e o link escrevem o nome de jeitos diferentes | Use um link só, ou dê à entrada um apelido igual ao texto |
| Arrastar não funciona | Há um filtro ligado | Clique em **Limpar** |
| Um capítulo não tem barra | Sem meta própria e sem `chapterTarget` no livro | Acrescente um dos dois |
| A barra usa a unidade errada | O `unit` do capítulo ou do livro diz isso | Mude ou remova a propriedade |

## Notas novas começam como rascunho

Um livro ou capítulo novo, e uma nota que você cria numa pasta contada (pelo *Nova nota* do Obsidian ou a partir de um modelo), recebe a sua primeira palavra de rascunho como `status`, a menos que já tenha um. O Escrita espera um instante depois que a nota é criada, para que o status do modelo valha. Modelos, entradas do universo e as notas do próprio Escrita (nota inicial, listas de palavras, nota do universo) ficam como estão. Só as propriedades mudam. Para desligar: Configurações → Estágios, "Notas novas começam como rascunho".
