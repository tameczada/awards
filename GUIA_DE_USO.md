# Guia de uso — painel admin

## Login
Acesse `/admin.html`. No primeiro acesso use "Primeiro acesso? Criar admin" com a
`ADMIN_SETUP_KEY` do `.env`/Render. Depois disso, é só usuário e senha normalmente.

## Criar uma categoria
1. Aba **Categorias** → **+ Nova categoria**
2. Preencha nome (ex: "Pior filme do ano"), descrição opcional, status e datas
   - **Agendada**: aparece no site mas ainda não recebe votos (ex: "abre dia X")
   - **Aberta**: recebe votos normalmente
   - **Encerrada**: mostra o resultado público, não aceita mais votos
   - Se você preencher "Início" e "Fim", o status muda sozinho automaticamente
     quando a data chegar (mesmo que esteja marcado como "Aberta" no cadastro)
3. Salvar

## Adicionar imagem da categoria
Clique na categoria na lista para expandir → **"Trocar imagem da categoria"** →
escolha o arquivo. Ela aparece tanto no card da home quanto na página de votação
daquela categoria.

## Adicionar opções (os itens que concorrem)
Com a categoria expandida, digite o nome no campo "Nome da nova opção" e clique em
**+ adicionar**. Cada opção pode ter sua própria imagem (botão "imagem" ao lado do
nome).

## Trocar a imagem de fundo da página inicial
Aba **Configurações** → **Fundo da página inicial** → deixe selecionado "Imagem" →
**Escolher imagem…** Atualiza na hora, sem precisar de deploy novo.

## Usar uma cor sólida no lugar da imagem
No mesmo painel, clique em **"Cor sólida"**, escolha a cor no seletor (ou digite o
código hexadecimal, ex: `#16110D`) e clique em **Aplicar cor**. Pra voltar a usar
imagem, clique em "Imagem" de novo — a última imagem enviada continua salva.

## Trocar o tema de cores
Aba **Configurações** → **Tema de cores** → escolha uma das paletas prontas (aplica
na hora) ou clique em **"Personalizado"** pra abrir os seletores de cor individuais:
destaque principal, destaque claro, cor secundária, fundo da página, fundo dos
cartões e cor do texto. Depois de ajustar, clique em **Salvar cores personalizadas**.

## Trocar a tipografia
Aba **Configurações** → **Tipografia** → escolha um dos pares de fonte (título +
texto). Aplica imediatamente em todo o site, inclusive nos títulos das categorias.

## Dashboard ao vivo (pra OBS ou pra acompanhar em outra tela)
Aba **Configurações** → **Dashboard ao vivo** → copie o link (já vem com o token
de acesso embutido). Esse link abre uma página separada, sem precisar de login, que
mostra um card por categoria com as barras de votos atualizando sozinhas em tempo
real — sem precisar dar F5. Dá pra usar como fonte de navegador no OBS ou só deixar
aberto numa aba/segunda tela.

Se o link vazar ou você quiser revogar o acesso, clique em **"Gerar novo token"** —
o link antigo para de funcionar na hora e um novo é criado.

### Modo "revelação" de uma categoria específica
No topo do próprio dashboard tem um seletor **"Mostrar todas as categorias"**. Ao
escolher uma categoria específica ali:

- O dashboard passa a mostrar **só aquela categoria**, em destaque.
- Os votos ficam **censurados** (nomes das opções aparecem, números não — nem a
  ordem revela quem está ganhando).
- Aparece um botão **"Revelar resultado"**. Ao clicar, os números reais aparecem
  com uma animação (as barras "enchem" e o card brilha em dourado por um instante).
- Se revelar sem querer ou quiser repetir o efeito, clique em **"recensurar"** pra
  voltar ao estado escondido sem perder a categoria selecionada.
- Trocar de categoria no seletor sempre volta pro estado censurado automaticamente.

Como o dashboard é uma página compartilhada (todo mundo que abre o link vê o mesmo
estado ao vivo via WebSocket), controlar o seletor em qualquer aba aberta atualiza
instantaneamente em todas as outras — inclusive na fonte do OBS, se for o caso.

## Votação pelo chat da Twitch
Aba **Twitch Chat**.

1. **Gerar o token do bot**: crie (ou use) uma conta Twitch pro bot, acesse
   [twitchtokengenerator.com](https://twitchtokengenerator.com), gere um "Bot Chat
   Token" com os escopos `chat:read` e `chat:edit`, e copie o token.
2. Preencha **usuário do bot**, cole o **token OAuth**, informe o **canal** (o seu,
   sem @) e escolha se quer que o bot **responda no chat** confirmando cada voto.
   Salvar.
3. Clique em **Conectar bot**.
4. Em **"Categoria ativa para votos no chat"**, escolha qual categoria aberta vai
   receber votos do chat agora. A lista numerada aparece logo abaixo — é isso que
   você fala pros espectadores: *"digite `!votar 1` no chat pra votar em Fulano"*.

Cada espectador só vota uma vez por categoria (o sistema identifica pelo ID da conta
Twitch, então trocar de nome de usuário não deixa votar de novo). O bot reconecta
sozinho quando o servidor reinicia, desde que a conexão esteja marcada como ativa.

> No plano gratuito do Render, o serviço "dorme" depois de um tempo sem acesso —
> isso desconecta o bot da Twitch e a votação pelo chat para até alguém acessar o
> site de novo. Pra chat ao vivo sem interrupção durante uma live longa, considere
> um plano pago do Render ou algum serviço de "keep-alive" pingando o site.

## Ver apuração antes de encerrar
Com a categoria expandida no admin, a seção **"Apuração em tempo real"** mostra os
votos atualizados a qualquer momento — o público só vê isso depois que você muda o
status para "Encerrada".

## Encerrar uma votação
Editar categoria → Status → **Encerrada** → Salvar. O resultado passa a ficar visível
publicamente na hora.

## Excluir
Excluir uma categoria apaga também suas opções e votos. Excluir uma opção apaga os
votos daquela opção. Não tem como desfazer — o sistema pede confirmação antes.
