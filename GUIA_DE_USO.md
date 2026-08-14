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
Aba **Configurações** → **Imagem de fundo da página inicial** → **Escolher imagem…**
Atualiza na hora, sem precisar de deploy novo.

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
