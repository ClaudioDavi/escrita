/** ~10,000 words: 1,500 paragraphs of mixed dialogue and narration (shared by the dialogue tests). */
export function dialogueNote(): string {
  const paras: string[] = [];
  for (let i = 0; i < 1500; i++) {
    paras.push(i % 3 === 0
      ? "— Vem cá — disse ela, olhando pela janela."
      : i % 3 === 1
        ? "Ele respondeu “não posso agora” e voltou ao livro."
        : "A casa estava quieta, e a chuva não parava de cair lá fora.");
  }
  return paras.join("\n\n");
}
