# AgroTech — ajuste de design (o que mudou)

Mesma paleta, mesma estrutura de páginas, mesmo layout. O que saiu foi o que
denunciava "gerado por IA"; o que entrou foi acabamento.

## Ícones
- Todos os emojis viraram ícones SVG monocromáticos (traço 1.6px), herdando a cor
  do contêiner via `currentColor`. Isso vale para nav, cards de recursos,
  materiais, contato, mecânicas do jogo, specs, referências e o botão de tema.
- Novo utilitário `.ico` no CSS: `width/height: 1em`, então o tamanho do ícone é
  controlado pelo `font-size` do elemento pai.
- Favicon SVG inline adicionado (não havia nenhum).

## Efeitos removidos
- Textura de ruído (`body::before`) e textura de pontos (`body::after`).
- Ponto piscando do badge (`@keyframes blink`).
- Brilho varrendo a faixa de status (`@keyframes stripScan`).
- Linha de scanner do player de vídeo (`@keyframes vscan`).
- Marca-d'água gigante do caminhão (260px) e do texto fantasma "AGRO/EQUIPE/REF…".
- Animações de entrada escalonadas (`fadeUp`) nos elementos do hero.
- `translateY(-3px)` no hover de todos os cards — agora o hover é só borda + sombra.

## Tipografia
- Corpo de 15px → 16px, altura de linha 1.65.
- Textos de apoio de 11px → 14px (estavam ilegíveis).
- Micro-rótulos em CAIXA ALTA com `letter-spacing` de .14em reduzidos ou
  convertidos em texto normal.
- Títulos com `clamp()` — escalam bem entre celular e desktop.
- Pilha de fontes de fallback caso a Bebas Neue não carregue.

## Layout
- Conteúdo limitado a 1220px e centralizado (`--gutter`), em vez de esticar
  até a borda em telas largas.
- Breakpoint intermediário em 1024px (a grade da equipe pulava de 4 para 2 colunas
  só em 768px).
- Espaçamentos padronizados; raios de borda unificados em 3 tokens.

## Acessibilidade
- `:focus-visible` visível e consistente em links, botões e campos.
- `prefers-reduced-motion` respeitado.
- `aria-label` no botão de tema, `aria-current` no item de menu ativo,
  `aria-hidden` nos ícones decorativos.
- Item ativo marcado também no menu mobile.

## Conteúdo (ajustes pontuais)
- "247 sensores ativos agora" → "247 sensores em operação".
- "Última sync · agora" → "Atualização a cada 15 min".
- Página de contato: o título repetido "Entre em Contato" virou
  "Onde nos encontrar".
- Capitalização normalizada nos cargos e descrições da equipe.
- `<meta name="description">` e `theme-color` em todas as páginas.

## Arquivos alterados
`css/style.css` (reescrito), `js/main.js` (troca de ícone do tema),
`js/contato.js` (display flex no aviso de sucesso) e os 6 HTMLs.
Os CSS/JS por página seguem como estavam (stubs).
