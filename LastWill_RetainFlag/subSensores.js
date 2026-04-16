import mqtt from "mqtt";
import readline from "readline";

const BROKER_URL = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";
const LWT_BASE_TOPIC = "aula/lwt-retain/aeroporto/terminal-a";

function qos0() {
    const client = mqtt.connect(BROKER_URL);
    client.on("connect", () => {
        console.log("SUB QoS0: conectado");
        console.log("Sensor 1: Temperatura Ambiente");
        client.subscribe("aula/qos/sensor1", { qos: 0 });
    });
    
    client.on("message", (topic, msg) => {
        console.log("SUB QoS0 recebeu:", msg.toString());
    });
}

function qos1() {
    const options = {
        clientId: "sub-qo1",
        clean: false
    };

    const client = mqtt.connect(BROKER_URL, options);

    client.on("connect", (connack) => {
        // connack.sessionPresent indica se o Broker já tinha sua sessão guardada
        console.log(`SUB QoS1: conectado (Sessão recuperada: ${connack.sessionPresent})`);
        console.log("Sensor 2: Nivel do Reservatorio");

        // No QoS 1 com clean:false, você só precisa dar subscribe uma vez na vida.
        // Mas deixar aqui garante que o tópico seja assinado na primeira execução.

        client.subscribe("aula/qos/sensor2", { qos: 1 });
    });

    client.on("message", (topic, msg) => {
      console.log("SUB QoS1 recebeu:", msg.toString());
    });
}

function qos2() {
    const client = mqtt.connect(BROKER_URL, {
        clientId: "sub-qos2",
        clean: false // Essencial para manter a sessao.
    });

    const recebidas = new Set();

    client.on("connect", () => {
        console.log("SUB conectado");
        console.log("Sensor 3: Detector de Incendio");

        client.subscribe("aula/qos/sensor3", { qos: 2 }, () => {
            console.log("SUB inscrito em aula/qos/sensor3 QoS2");
        });
    });

    client.on("message", (topic, msg) => {
        const mensagem = msg.toString();

        if (recebidas.has(mensagem)) {
            console.log("DUPLICADA:", mensagem);
        } else {
            recebidas.add(mensagem);
            console.log("RECEBIDA:", mensagem);
        }
    });
}

function lastWillRetainFlag() {
    const client = mqtt.connect(BROKER_URL, {
        clientId: `sub-lwt-retain-${process.pid}`,
        clean: true
    });

    client.on("connect", () => {
        console.log("SUB Last Will + Retain Flag: conectado");
        console.log(`Inscrevendo em ${LWT_BASE_TOPIC}/#`);
        console.log("Mensagens com retain=true chegaram do historico guardado no broker.\n");

        client.subscribe(`${LWT_BASE_TOPIC}/#`, { qos: 1 }, (err) => {
            if (err) {
                console.error("Erro ao assinar topicos LWT/Retain:", err.message);
                return;
            }

            console.log("Aguardando mensagens...");
        });
    });

    client.on("message", (topic, msg, packet) => {
        const origem = packet.retain ? "retida" : "nova";
        const raw = msg.toString();

        let payload = raw;
        try {
            payload = JSON.parse(raw);
        } catch {
            // Mantem o payload bruto quando a mensagem nao for JSON.
        }

        console.log(`\n[${origem}] ${topic}`);
        console.log(payload);

        if (topic.endsWith("/status") && payload.status === "offline") {
            if (payload.lwt) {
                console.log("LWT detectado: o publisher caiu sem encerrar a conexao corretamente.");
            } else {
                console.log("Offline controlado: o publisher avisou antes de encerrar.");
            }
        }
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
    default:
      console.log("Opção inválida");
  }

  rl.close();
});
