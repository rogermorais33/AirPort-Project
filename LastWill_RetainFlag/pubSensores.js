import mqtt from "mqtt";
import readline from "readline";

const BROKER_URL = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";
const LWT_BASE_TOPIC = "aula/lwt-retain/aeroporto/terminal-a";
const LWT_TOPICS = {
    status: `${LWT_BASE_TOPIC}/status`,
    telemetria: `${LWT_BASE_TOPIC}/telemetria`,
    config: `${LWT_BASE_TOPIC}/config`,
    alerta: `${LWT_BASE_TOPIC}/alerta-incendio`
};

// const tempo_envio_temperatura = 5000
const tempo_envio_temperatura = 500;
// const tempo_envio_nivel_reservatorio = 30000
// const tempo_envio_nivel_reservatorio = 3000
const tempo_envio_nivel_reservatorio = 500;
// const tempo_envio_incendio = 2000
// const tempo_envio_incendio = Math.random()*5000
const tempo_envio_incendio = Math.random() * 500;

function agora() {
    return new Date().toISOString();
}

function publicarJson(client, topic, payload, options = {}) {
    const body = JSON.stringify(payload);

    client.publish(topic, body, options, (err) => {
        if (err) {
            console.error(`Erro ao publicar em ${topic}:`, err.message);
            return;
        }

        const retain = options.retain ? "retain=true" : "retain=false";
        const qos = `qos=${options.qos ?? 0}`;
        console.log(`PUB ${topic} (${qos}, ${retain}):`, body);
    });
}

function qos0() {
    const client = mqtt.connect(BROKER_URL);

    client.on("connect", () => {
        console.log("PUB QoS0: conectado");
        let i = 0;

        const t = setInterval(() => {
            const payload = JSON.stringify({
                id: `temp-${i}`,
                value: 20 + Math.random() * 3,
                qos: 0
            });
            client.publish("aula/qos/sensor1", payload, { qos: 0 });
            console.log("PUB QoS0 enviou:", payload);
            i++;

            if (i === 10) {
                clearInterval(t);
                client.end();
            }
        }, tempo_envio_temperatura);
    });
}

function qos1() {
    const client = mqtt.connect(BROKER_URL);

    client.on("connect", () => {
        console.log("PUB QoS1: conectado");
        let i = 0;

        const t = setInterval(() => {
            const payload = JSON.stringify({
                id: `nivel-${i}`,
                value: 50 + Math.random() * 10,
                qos: 1
            });
            client.publish("aula/qos/sensor2", payload, { qos: 1 });
            console.log("PUB QoS1 enviou:", payload);
            i++;

            if (i === 10) {
                clearInterval(t);
                client.end();
            }
        }, tempo_envio_nivel_reservatorio);
    });
}

function qos2() {
    const client = mqtt.connect(BROKER_URL);

    client.on("connect", () => {
        console.log("PUB conectado");

        let i = 0;

        const enviar = () => {
            const payload = JSON.stringify({
                id: `fire-${i}`,
                alerta: true,
                qos: 2
            });

            client.publish("aula/qos/sensor3", payload, { qos: 2 }, () => {
                console.log("PUB enviou:", payload);
            });

            i++;

            if (i < 5) {
                setTimeout(enviar, tempo_envio_incendio);
            } else {
                console.log("PUB finalizou");
                client.end();
            }
        };
        enviar();
    });
}

function lastWillRetainFlag() {
    const sensorId = "terminal-a";
    const clientId = `pub-${sensorId}-${process.pid}`;

    const client = mqtt.connect(BROKER_URL, {
        clientId,
        keepalive: 5,
        reconnectPeriod: 0,
        will: {
            topic: LWT_TOPICS.status,
            payload: JSON.stringify({
                sensorId,
                status: "offline",
                motivo: "falha_inesperada_ou_perda_de_conexao",
                lwt: true,
                timestampConexao: agora()
            }),
            qos: 1,
            retain: true
        }
    });

    let sequencia = 0;
    let intervalo;
    let encerrando = false;

    const publicarEstadoOnline = () => {
        publicarJson(
            client,
            LWT_TOPICS.status,
            {
                sensorId,
                status: "online",
                motivo: "conexao_estabelecida",
                lwt: false,
                timestamp: agora()
            },
            { qos: 1, retain: true }
        );
    };

    const publicarConfiguracao = () => {
        publicarJson(
            client,
            LWT_TOPICS.config,
            {
                sensorId,
                local: "Aeroporto - Terminal A",
                sensores: ["temperatura", "nivel_reservatorio", "incendio"],
                intervaloMs: 2000,
                descricao: "Configuracao retida para novos subscribers"
            },
            { qos: 1, retain: true }
        );
    };

    const publicarTelemetria = () => {
        const incendio = Math.random() > 0.92;

        publicarJson(
            client,
            LWT_TOPICS.telemetria,
            {
                sensorId,
                sequencia,
                temperaturaC: Number((22 + Math.random() * 5).toFixed(2)),
                nivelReservatorioPercentual: Number((45 + Math.random() * 20).toFixed(2)),
                incendio,
                timestamp: agora()
            },
            { qos: 1, retain: true }
        );

        if (incendio) {
            publicarJson(
                client,
                LWT_TOPICS.alerta,
                {
                    sensorId,
                    alerta: true,
                    mensagem: "Possivel incendio detectado no Terminal A",
                    timestamp: agora()
                },
                { qos: 1, retain: true }
            );
        } else if (sequencia % 5 === 0) {
            publicarJson(
                client,
                LWT_TOPICS.alerta,
                {
                    sensorId,
                    alerta: false,
                    mensagem: "Sem incendio ativo",
                    timestamp: agora()
                },
                { qos: 1, retain: true }
            );
        }

        sequencia++;
    };

    const desligarComAviso = () => {
        if (encerrando) {
            return;
        }

        encerrando = true;
        clearInterval(intervalo);

        console.log("\nDesligamento controlado: publicando offline manual.");
        const payload = JSON.stringify({
            sensorId,
            status: "offline",
            motivo: "desligamento_controlado",
            lwt: false,
            timestamp: agora()
        });

        client.publish(LWT_TOPICS.status, payload, { qos: 1, retain: true }, (err) => {
            if (err) {
                console.error("Erro ao publicar offline controlado:", err.message);
            } else {
                console.log(`PUB ${LWT_TOPICS.status} (qos=1, retain=true):`, payload);
            }

            client.end(false, {}, () => {
                console.log("Cliente encerrado sem disparar Last Will.");
                process.exit(0);
            });
        });

        setTimeout(() => process.exit(0), 1500).unref();
    };

    client.on("connect", () => {
        console.log("PUB Last Will + Retain Flag: conectado");
        console.log(`ClientId: ${clientId}`);
        console.log(`PID para teste com kill -9: ${process.pid}`);
        console.log("Use Ctrl+C para desligamento controlado.");
        console.log("Use kill -9 <PID> ou derrube a conexao para o broker disparar o Last Will.\n");

        publicarEstadoOnline();
        publicarConfiguracao();
        publicarTelemetria();
        intervalo = setInterval(publicarTelemetria, 2000);
    });

    client.on("error", (err) => {
        console.error("Erro MQTT:", err.message);
    });

    process.once("SIGINT", desligarComAviso);
    process.once("SIGTERM", desligarComAviso);
}

function limparMensagensRetidas() {
    const client = mqtt.connect(BROKER_URL);

    client.on("connect", () => {
        console.log("Limpando mensagens retained da atividade...");

        const topics = Object.values(LWT_TOPICS);
        let pendentes = topics.length;

        topics.forEach((topic) => {
            // Payload vazio com retain=true apaga a mensagem retida no broker.
            client.publish(topic, "", { qos: 1, retain: true }, (err) => {
                if (err) {
                    console.error(`Erro ao limpar ${topic}:`, err.message);
                } else {
                    console.log(`Retained removido: ${topic}`);
                }

                pendentes--;

                if (pendentes === 0) {
                    client.end();
                }
            });
        });
    });

    client.on("error", (err) => {
        console.error("Erro MQTT:", err.message);
    });
}



const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question(`
Escolha o modo:
0 - QoS0
1 - QoS1
2 - QoS2
3 - Last Will + Retain Flag
4 - Limpar mensagens retained da atividade

Opção: `, (res) => {

  switch (res) {
    case "0":
      qos0();
      break;
    case "1":
      qos1();
      break;
    case "2":
      qos2();
      break;
    case "3":
      lastWillRetainFlag();
      break;
    case "4":
      limparMensagensRetidas();
      break;
    default:
      console.log("Opção inválida");
  }

  rl.close();
});
