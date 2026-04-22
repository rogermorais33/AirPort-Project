# Trabalho - MQTT: Last Will e Retain Flag

Esta pasta demonstra, na pratica, dois recursos importantes do MQTT para sistemas IoT:

- Last Will and Testament (LWT): mensagem que o broker publica automaticamente quando um cliente cai sem encerrar a conexao corretamente.
- Retain Flag: marca que faz o broker guardar a ultima mensagem de um topico e entrega-la imediatamente para novos subscribers.

## Resumo rapido

Neste exemplo existem tres papeis:

- Publisher: `pubSensores.js`, simulando um sensor do Terminal A.
- Broker: `broker.js` com Aedes ou Mosquitto em container, responsavel por receber e distribuir mensagens MQTT.
- Subscriber: `subSensores.js`, simulando um painel ou servico que acompanha os sensores.

O publisher envia mensagens normais, como `status=online`, telemetria, configuracao e alerta. Algumas dessas mensagens sao publicadas com `retain: true`, que e uma flag propria do MQTT colocada na chamada `publish`. Quando uma mensagem tem Retain Flag, o broker guarda a ultima mensagem daquele topico. Assim, se um subscriber novo entrar depois, ele recebe imediatamente esse ultimo valor, mesmo que tenha sido publicado antes dele conectar.

O Last Will and Testament tambem e um recurso proprio do MQTT, mas ele e configurado na conexao do publisher, dentro de `mqtt.connect(...)`, no campo `will`. O publisher informa ao broker: "se eu cair sem encerrar direito, publique esta mensagem por mim". Se o processo for morto, a rede cair ou o cliente parar de responder ao keepalive, o broker publica automaticamente a mensagem de Last Will, neste projeto como `status=offline`.

Importante: o subscriber consegue identificar mensagem retida por `packet.retain`, porque isso vem do protocolo MQTT. Ja para Last Will, o MQTT nao entrega um `packet.lwt`; por isso o payload contem `lwt: true` apenas como marca da aplicacao, para diferenciar offline por queda inesperada de offline por desligamento controlado.

## Arquivos

- `broker.js`: broker MQTT local em Node.js, portatil para Windows, WSL e Linux.
- `validate-lwt-retain.js`: validacao automatizada de Retain Flag, Last Will e Last Will retido.
- `pubSensores.js`: publisher com os exemplos de QoS ja existentes e o modo `3` para LWT + Retain Flag.
- `subSensores.js`: subscriber com os exemplos de QoS ja existentes e o modo `3` para observar mensagens novas e retidas.
- `package.json`: dependencias e scripts para executar e validar os exemplos.

## Requisitos

- Node.js 18 ou superior.
- npm.
- Opcional: Docker, Podman ou Mosquitto instalado, caso queira usar outro broker.

O caminho recomendado para aula e validacao local e usar o broker Node deste projeto. Ele evita dependencia de Docker Desktop, Podman ou instalacao global do Mosquitto.

## Validacao automatizada

Instale as dependencias:

```bash
cd LastWill_RetainFlag
npm install
```

Rode a validacao completa:

```bash
npm test
```

Esse comando executa:

```bash
npm run check
npm run validate
```

O `npm run check` valida a sintaxe dos scripts. O `npm run validate` sobe um broker MQTT temporario em uma porta livre e testa automaticamente:

1. Retain Flag: publica uma mensagem com `retain: true` e confirma que um subscriber novo recebe essa mensagem com `packet.retain === true`.
2. Last Will: conecta um publisher com `will`, derruba a conexao de forma abrupta e confirma que o broker publica `status=offline` com `lwt=true`.
3. Last Will + Retain: confirma que outro subscriber novo recebe o `offline` retido depois da queda.

Saida esperada:

```txt
[ok] Retain Flag: subscriber novo recebeu a ultima mensagem retida.
[ok] Last Will: broker publicou offline apos queda abrupta.
[ok] Last Will + Retain: subscriber novo recebeu o offline retido.
[ok] Validacao completa: LWT e Retain Flag funcionando.
```

## Como executar manualmente no Windows, WSL ou Linux

Use tres terminais no mesmo ambiente. Ou seja: tudo no Windows PowerShell, tudo no WSL, ou tudo no Linux.

Terminal 1: suba o broker local:

```bash
npm run broker
```

Esse comando executa `node broker.js` e abre um broker MQTT local em:

```txt
mqtt://127.0.0.1:1883
```

Terminal 2: execute o subscriber e escolha a opcao `3`:

```bash
npm run sub
```

Terminal 3: execute o publisher e escolha a opcao `3`:

```bash
npm run pub
```

Por padrao os scripts usam `mqtt://127.0.0.1:1883`.

No Windows, evitar `localhost` deixa o teste mais previsivel. Em algumas maquinas, `localhost` resolve primeiro para `::1`, que e o loopback IPv6. Se o broker estiver escutando em IPv4, o cliente pode falhar com `ECONNREFUSED ::1:1883`.

Para usar outro broker no Windows PowerShell:

```powershell
$env:MQTT_BROKER_URL="mqtt://SEU_HOST:1883"
npm run pub
npm run sub
```

Para usar outro broker no WSL/Linux/macOS:

```bash
MQTT_BROKER_URL=mqtt://SEU_HOST:1883 npm run pub
MQTT_BROKER_URL=mqtt://SEU_HOST:1883 npm run sub
```

Para rodar o broker local em outra porta:

Windows PowerShell:

```powershell
$env:MQTT_BROKER_PORT="1884"
npm run broker
```

WSL/Linux/macOS:

```bash
MQTT_BROKER_PORT=1884 npm run broker
```

Se o broker estiver em um ambiente e os clientes em outro, por exemplo broker no Windows e subscriber no WSL, tente primeiro `localhost`. Se nao conectar, configure `MQTT_BROKER_URL` com o IP do host que esta rodando o broker.

Para expor o broker Node em todas as interfaces IPv4, use:

Windows PowerShell:

```powershell
$env:MQTT_BROKER_HOST="0.0.0.0"
npm run broker
```

WSL/Linux/macOS:

```bash
MQTT_BROKER_HOST=0.0.0.0 npm run broker
```

## Configuracoes uteis dos clientes MQTT

Por padrao, publisher e subscriber usam `clean: true`, que e o comportamento comum para uma demonstracao simples.

Para testar com `clean: false`, defina a variavel de ambiente antes de rodar o publisher ou subscriber.

Windows PowerShell:

```powershell
$env:MQTT_CLEAN="false"
$env:MQTT_SUB_CLIENT_ID="sub-lwt-retain-fixo"
npm run sub
```

WSL/Linux/macOS:

```bash
MQTT_CLEAN=false MQTT_SUB_CLIENT_ID=sub-lwt-retain-fixo npm run sub
```

Variaveis disponiveis:

- `MQTT_CLEAN`: aplica para publisher e subscriber quando as variaveis especificas nao forem usadas.
- `MQTT_PUB_CLEAN`: configura apenas o publisher.
- `MQTT_SUB_CLEAN`: configura apenas o subscriber.
- `MQTT_PUB_CLIENT_ID`: define um `clientId` fixo para o publisher.
- `MQTT_SUB_CLIENT_ID`: define um `clientId` fixo para o subscriber.

Tambem e possivel colocar essas variaveis em um arquivo `.env` dentro da pasta `LastWill_RetainFlag`. Use `.env.example` como base.

Observacao importante: `clean: false` so faz sentido com `clientId` fixo. Se o `clientId` muda a cada execucao, o broker enxerga um cliente novo e nao consegue recuperar a sessao anterior.

O `clean` nao e o recurso principal desta atividade. Ele controla persistencia de sessao MQTT. Last Will e Retain Flag continuam funcionando com `clean: true` ou `clean: false`.

## Brokers disponiveis

O projeto oferece duas formas de broker:

- `npm run broker`: usa o broker Node/Aedes local. E o caminho mais portatil para Windows, WSL e Linux.
- `npm run broker:docker` ou `npm run broker:podman`: usa Mosquitto em container. E mais proximo de um broker real de producao.

Use apenas um broker por vez na porta `1883`.

### Opcao 1: broker Node/Aedes

```bash
npm run broker
```

Esse comando roda `broker.js` e nao precisa de Docker, Podman nem Mosquitto instalado.

### Opcao 2: Mosquitto com Docker

Rodar em primeiro plano:

```bash
npm run broker:docker
```

Nesse modo, pare com `Ctrl+C`.

Rodar em segundo plano:

```bash
npm run broker:docker:detached
```

Ver logs:

```bash
npm run broker:docker:logs
```

Parar/remover o container:

```bash
npm run broker:docker:stop
```

### Opcao 3: Mosquitto com Podman

Rodar em primeiro plano:

```bash
npm run broker:podman
```

Nesse modo, pare com `Ctrl+C`.

Rodar em segundo plano:

```bash
npm run broker:podman:detached
```

Ver logs:

```bash
npm run broker:podman:logs
```

Parar/remover o container:

```bash
npm run broker:podman:stop
```

O arquivo `/mosquitto-no-auth.conf` vem na imagem oficial e libera conexao anonima. Use esse modo apenas em ambiente local/de aula.

## Troubleshooting

### `Erro MQTT: connect ECONNREFUSED ::1:1883`

Esse erro normalmente significa que o cliente tentou conectar em `localhost` usando IPv6 (`::1`), mas o broker esta ouvindo em IPv4.

Solucoes:

1. Use `mqtt://127.0.0.1:1883` em vez de `mqtt://localhost:1883`.
2. Se existir um `.env`, confira se ele nao tem `MQTT_BROKER_URL=mqtt://localhost:1883`.
3. Confirme que o broker esta rodando antes de abrir `pub` ou `sub`.
4. Confirme que nao ha outro processo ocupando a porta `1883`.

No Windows PowerShell:

```powershell
$env:MQTT_BROKER_URL="mqtt://127.0.0.1:1883"
npm run sub
```

Ou para o publisher:

```powershell
$env:MQTT_BROKER_URL="mqtt://127.0.0.1:1883"
npm run pub
```

O Aedes continua sendo uma alternativa ao container. Esse erro nao significa que voce precisa usar Docker ou Podman; significa apenas que o endereco usado pelo cliente nao bateu com o endereco em que o broker esta ouvindo.

## Topicos usados

- `aula/lwt-retain/aeroporto/terminal-a/status`
- `aula/lwt-retain/aeroporto/terminal-a/telemetria`
- `aula/lwt-retain/aeroporto/terminal-a/config`
- `aula/lwt-retain/aeroporto/terminal-a/alerta-incendio`

## Demonstracao do Retain Flag

O publisher publica `status`, `telemetria`, `config` e `alerta-incendio` com `retain: true`.

Passo a passo:

1. Inicie o publisher no modo `3`.
2. Depois inicie o subscriber no modo `3`.
3. O subscriber recebe imediatamente as ultimas mensagens dos topicos, mesmo que elas tenham sido publicadas antes dele conectar.
4. No console do subscriber, mensagens recebidas do historico do broker aparecem como `[retida]`.

Isso simula um painel IoT que acabou de abrir e ja precisa mostrar o ultimo estado conhecido do sensor, sem esperar a proxima leitura.

Para limpar as mensagens retidas da atividade:

```bash
npm run pub
```

Escolha a opcao `4`. O publisher envia payload vazio com `retain: true`, que remove o valor retido no broker.

## Demonstracao do Last Will

No modo `3`, o publisher conecta com um Last Will configurado no topico `status`:

```js
will: {
    topic: "aula/lwt-retain/aeroporto/terminal-a/status",
    payload: "{\"status\":\"offline\",\"lwt\":true}",
    qos: 1,
    retain: true
}
```

Enquanto a conexao esta saudavel, o publisher publica `status=online` com `retain: true`.

Para ver o LWT acontecer:

1. Deixe o subscriber rodando no modo `3`.
2. Inicie o publisher no modo `3`.
3. Copie o PID mostrado pelo publisher.
4. Em outro terminal, encerre o processo abruptamente.

Windows PowerShell:

```powershell
Stop-Process -Id PID_AQUI -Force
```

Windows CMD:

```powershell
taskkill /PID PID_AQUI /F
```

WSL/Linux/macOS:

```bash
kill -9 PID_AQUI
```

Depois do timeout de keepalive, o broker publica automaticamente a mensagem de Last Will como `status=offline` e `lwt=true`. Como essa mensagem tambem usa `retain: true`, novos subscribers passam a enxergar imediatamente que o sensor esta offline.

Se voce parar o publisher com `Ctrl+C`, o codigo faz um desligamento controlado: publica `status=offline`, `lwt=false` e encerra a conexao corretamente. Nesse caso o Last Will nao e disparado, porque o broker sabe que o cliente saiu de forma normal.

### Por que existe `lwt: true` no payload?

O Last Will e configurado no nivel MQTT dentro de `mqtt.connect(...)`, no campo `will`. Quem dispara a mensagem e o broker, nao o publisher.

Porem, quando o subscriber recebe a publicacao, o protocolo MQTT nao entrega um flag nativo dizendo "esta mensagem veio do Last Will". Diferente do Retain Flag, que aparece em `packet.retain`, nao existe um `packet.lwt`.

Por isso o payload inclui:

```json
{
  "status": "offline",
  "lwt": true
}
```

Esse `lwt: true` nao ativa o Last Will. Ele e apenas uma marca da aplicacao para o subscriber conseguir diferenciar:

- `lwt: true`: offline publicado automaticamente pelo broker porque o publisher caiu sem encerrar corretamente.
- `lwt: false`: offline publicado manualmente pelo publisher durante desligamento controlado.

Outra forma valida seria usar topicos diferentes, por exemplo `status/offline-by-lwt` para o Last Will e `status` para estados normais. Neste projeto, a diferenciacao foi feita no payload para manter tudo no topico de status.

## Quando usar Last Will

Use Last Will para representar falhas inesperadas de conexao ou queda de dispositivos:

- disponibilidade de sensores, gateways e atuadores;
- avisar dashboards que um dispositivo ficou offline;
- disparar alertas quando um equipamento critico para de responder;
- diferenciar desligamento planejado de queda inesperada.

Em IoT real, o LWT e util porque muitos dispositivos estao em redes instaveis, usam bateria, Wi-Fi, 4G ou links remotos. Sem LWT, o painel pode continuar mostrando um sensor como online mesmo depois dele sumir.

Impactos importantes:

- o broker so dispara o LWT quando detecta perda de conexao, entao pode existir atraso ate o keepalive expirar;
- redes instaveis podem gerar falso offline se o keepalive for agressivo demais;
- o payload do LWT e definido na conexao, entao nao deve depender de dados que mudam a cada segundo;
- combinar LWT com `retain: true` ajuda novos subscribers a verem imediatamente que o dispositivo esta offline.

## Quando usar Retain Flag

Use Retain Flag para guardar o ultimo estado conhecido de um topico:

- status atual de um dispositivo;
- ultima leitura de telemetria quando ela representa estado atual;
- configuracao de sensores ou parametros de atuadores;
- ultimo alerta ativo.

Em IoT real, isso evita telas vazias depois de reiniciar um dashboard, backend ou subscriber. Um novo cliente recebe o ultimo valor imediatamente e depois acompanha as proximas atualizacoes.

Impactos importantes:

- mensagens retidas ficam persistidas no broker ate serem substituidas ou apagadas;
- dados antigos podem parecer atuais se o payload nao tiver timestamp;
- nao e recomendado reter telemetria de alta frequencia sem necessidade;
- cuidado com dados sensiveis, pois novos subscribers autorizados receberao o ultimo valor retido automaticamente;
- para apagar uma mensagem retida, publique payload vazio no mesmo topico com `retain: true`.

## Resumo pratico

- Last Will responde a pergunta: "como aviso que o dispositivo caiu sem avisar?"
- Retain Flag responde a pergunta: "como um subscriber novo descobre o ultimo estado sem esperar uma nova publicacao?"
- Usados juntos, eles resolvem um caso comum em IoT: dashboards e servicos sempre sabem se um sensor esta online, offline controlado ou offline por falha.
