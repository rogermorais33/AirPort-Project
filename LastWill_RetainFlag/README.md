# Trabalho - MQTT: Last Will e Retain Flag

Esta pasta demonstra, na pratica, dois recursos importantes do MQTT para sistemas IoT:

- Last Will and Testament (LWT): mensagem que o broker publica automaticamente quando um cliente cai sem encerrar a conexao corretamente.
- Retain Flag: marca que faz o broker guardar a ultima mensagem de um topico e entrega-la imediatamente para novos subscribers.

## Arquivos

- `pubSensores.js`: publisher com os exemplos de QoS ja existentes e o modo `3` para LWT + Retain Flag.
- `subSensores.js`: subscriber com os exemplos de QoS ja existentes e o modo `3` para observar mensagens novas e retidas.
- `package.json`: dependencias e scripts para executar os exemplos.

## Como executar

Instale as dependencias:

```bash
cd LastWill_RetainFlag
npm install
```

Verifique se ja existe um Mosquitto rodando na porta `1883`:

```bash
podman ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

Se ja houver um container `eclipse-mosquitto:2` com `0.0.0.0:1883->1883/tcp`, ele pode ser usado por estes scripts sem mudar nada.

Se nao houver broker rodando, suba um Mosquitto em container Podman:

```bash
npm run broker
```

O script `npm run broker` executa:

```bash
podman run --name mqtt-lastwill-mosquitto --replace -d -p 1883:1883 docker.io/library/eclipse-mosquitto:2 mosquitto -c /mosquitto-no-auth.conf
```

O arquivo `/mosquitto-no-auth.conf` vem na imagem oficial e libera conexao anonima. Use esse modo apenas em ambiente local/de aula.

Para acompanhar os logs do broker criado pelo script:

```bash
npm run broker:logs
```

Para parar o broker criado pelo script:

```bash
npm run broker:stop
```

Em um terminal, execute o subscriber e escolha a opcao `3`:

```bash
npm run sub
```

Em outro terminal, execute o publisher e escolha a opcao `3`:

```bash
npm run pub
```

Por padrao os scripts usam `mqtt://localhost:1883`. Para outro broker:

```bash
MQTT_BROKER_URL=mqtt://SEU_HOST:1883 npm run pub
MQTT_BROKER_URL=mqtt://SEU_HOST:1883 npm run sub
```

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
4. Em outro terminal, encerre o processo abruptamente:

```bash
kill -9 PID_AQUI
```

Depois do timeout de keepalive, o broker publica automaticamente a mensagem de Last Will como `status=offline` e `lwt=true`. Como essa mensagem tambem usa `retain: true`, novos subscribers passam a enxergar imediatamente que o sensor esta offline.

Se voce parar o publisher com `Ctrl+C`, o codigo faz um desligamento controlado: publica `status=offline`, `lwt=false` e encerra a conexao corretamente. Nesse caso o Last Will nao e disparado, porque o broker sabe que o cliente saiu de forma normal.

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
