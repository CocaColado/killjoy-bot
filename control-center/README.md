# Killjoy Control // OVERDRIVE

Central local do Windows para administrar o servidor Patifes com um segundo bot.

## Abrir

Clique duas vezes em `Iniciar Killjoy Control.cmd`. A central abre como uma janela nativa do Windows, construída em WPF. Ela não abre navegador nem publica um site.

O pequeno núcleo interno aceita conexões somente do próprio computador (`127.0.0.1`) e fica oculto. Ele serve exclusivamente para a janela conversar com o bot.

Na primeira abertura, informe o token de uma **segunda aplicação Discord** e o ID do servidor. O token é protegido pela criptografia da conta do Windows.

## Segurança

- Ações são preparadas como planos antes da execução.
- Exclusões exibem um aviso especial.
- Alterações ficam registradas em `data/audit.json`.
- Backups estruturais ficam em `data/backups`.
- A Killjoy hospedada não é iniciada, parada ou modificada por esta central.

## Módulos ativos na primeira versão

- estado e permissões do OVERDRIVE;
- mapa, criação, edição e exclusão de canais;
- hierarquia, criação, edição e exclusão de cargos;
- consulta de membros e distribuição de cargos;
- editor visual de anúncios;
- backup de canais, permissões, cargos e configurações;
- auditoria local.
- Arena de Clipes com `/clipe enviar`, categorias, votos, ranking, temporadas e cargo semanal;
- boas-vindas configuráveis com mensagem, canal e cargo automático;
- criador de eventos com publicação e confirmação por reação;
- controle local de call e reprodução de arquivos com volume limitado a 25%;
- modo de baixo consumo: os módulos pesados só trabalham quando solicitados.

## Comandos do OVERDRIVE

- `/overdrive` — confirma que o laboratório está online;
- `/clipe enviar` — inscreve um vídeo na Arena;
- `/clipe ranking` — mostra a classificação da temporada.

Feche e abra novamente o Killjoy Control depois de uma atualização dos arquivos para carregar a nova versão.
