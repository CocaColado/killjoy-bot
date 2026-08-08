# Recuperação de bot do Discord

Este coletor lê o histórico disponível no servidor e salva mensagens, embeds,
botões, anexos, reações e respostas em JSON. Ele não apaga nem envia mensagens.

## 1. Criar o bot leitor

1. Abra o Discord Developer Portal e crie uma aplicação com um bot.
2. Em **Bot > Privileged Gateway Intents**, habilite **Message Content Intent**.
3. Convide o bot para o servidor com estas permissões:
   - View Channels
   - Read Message History
   - Send Messages
4. Garanta que o cargo do bot possa enxergar os canais privados relevantes.

Não conceda Administrator se não for necessário.

## 2. Configurar

Na pasta deste projeto, duplique `.env.example` com o nome `.env` e preencha:

```env
DISCORD_TOKEN=token_do_novo_bot_leitor
GUILD_ID=id_do_servidor
OLD_BOT_ID=id_do_bot_antigo
```

`OLD_BOT_ID` é opcional. Quando informado, o arquivo final contém somente as
mensagens enviadas pelo bot antigo. Sem ele, todo o histórico legível é salvo,
o que ajuda a entender comandos, perguntas e respostas.

Para copiar IDs no Discord, habilite **Configurações > Avançado > Modo
desenvolvedor**, clique com o botão direito no servidor ou usuário e escolha
**Copiar ID**.

## 3. Executar

Com Node.js 20 ou mais recente instalado:

```powershell
npm install
npm run collect
```

O resultado será criado dentro da pasta `data`. Para a reconstrução mais fiel,
envie o JSON gerado. Remova antes qualquer conteúdo sensível que usuários tenham
publicado no servidor.

## Limites do Discord

- O bot só lê canais e threads que seu cargo consegue ver.
- Mensagens apagadas não podem ser recuperadas.
- Arquivos externos removidos podem aparecer apenas como links expirados.
- A coleta de servidores grandes pode demorar; a biblioteca respeita os limites
  da API automaticamente.
