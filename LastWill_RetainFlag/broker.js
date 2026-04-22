import "dotenv/config";
import aedes from "aedes";
import net from "node:net";

const PORT = Number.parseInt(process.env.MQTT_BROKER_PORT ?? "1883", 10);
const HOST = process.env.MQTT_BROKER_HOST ?? "127.0.0.1";

if (Number.isNaN(PORT) || PORT < 1 || PORT > 65535) {
    console.error("MQTT_BROKER_PORT precisa ser uma porta valida entre 1 e 65535.");
    process.exit(1);
}

const broker = aedes({
    id: `aedes-lwt-retain-${process.pid}`
});

const server = net.createServer(broker.handle);

broker.on("client", (client) => {
    console.log(`[broker] cliente conectado: ${client?.id ?? "sem-id"}`);
});

broker.on("clientDisconnect", (client) => {
    console.log(`[broker] cliente desconectado: ${client?.id ?? "sem-id"}`);
});

broker.on("publish", (packet, client) => {
    if (!client || packet.topic.startsWith("$SYS")) {
        return;
    }

    const retain = packet.retain ? "retain=true" : "retain=false";
    console.log(`[broker] ${client.id} publicou em ${packet.topic} (${retain})`);
});

server.listen(PORT, HOST, () => {
    console.log(`[broker] MQTT local rodando em mqtt://${HOST}:${PORT}`);
    console.log("[broker] Pressione Ctrl+C para parar.");
});

function shutdown() {
    console.log("\n[broker] encerrando...");
    server.close(() => {
        broker.close(() => {
            console.log("[broker] encerrado.");
            process.exit(0);
        });
    });

    setTimeout(() => process.exit(0), 2000).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
