import "dotenv/config";
import assert from "node:assert/strict";
import net from "node:net";
import aedes from "aedes";
import mqtt from "mqtt";

const TEST_ID = `validate-${process.pid}-${Date.now()}`;
const BASE_TOPIC = `aula/lwt-retain/validacao/${TEST_ID}`;
const TOPICS = {
    status: `${BASE_TOPIC}/status`,
    config: `${BASE_TOPIC}/config`
};

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function waitForConnect(client) {
    return withTimeout(
        new Promise((resolve, reject) => {
            client.once("connect", resolve);
            client.once("error", reject);
        }),
        3000,
        "cliente MQTT conectar"
    );
}

function subscribe(client, topic, options = { qos: 1 }) {
    return withTimeout(
        new Promise((resolve, reject) => {
            client.subscribe(topic, options, (err, granted) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(granted);
            });
        }),
        3000,
        `assinar ${topic}`
    );
}

function publish(client, topic, payload, options = { qos: 1 }) {
    return withTimeout(
        new Promise((resolve, reject) => {
            client.publish(topic, JSON.stringify(payload), options, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        }),
        3000,
        `publicar ${topic}`
    );
}

function waitForMessage(client, predicate, label) {
    return withTimeout(
        new Promise((resolve) => {
            const onMessage = (topic, message, packet) => {
                const raw = message.toString();
                let payload = raw;

                try {
                    payload = JSON.parse(raw);
                } catch {
                    // Mantem payload bruto quando nao for JSON.
                }

                const item = { topic, payload, packet };
                if (predicate(item)) {
                    client.off("message", onMessage);
                    resolve(item);
                }
            };

            client.on("message", onMessage);
        }),
        7000,
        label
    );
}

function endClient(client) {
    return withTimeout(
        new Promise((resolve) => {
            if (!client.connected && client.disconnected) {
                resolve();
                return;
            }

            client.end(true, {}, resolve);
        }),
        3000,
        "encerrar cliente MQTT"
    ).catch(() => undefined);
}

async function startBroker() {
    const broker = aedes({ id: `validation-broker-${process.pid}` });
    const server = net.createServer(broker.handle);

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const { port } = server.address();

    return {
        broker,
        server,
        url: `mqtt://127.0.0.1:${port}`,
        async close() {
            await new Promise((resolve) => server.close(resolve));
            await new Promise((resolve) => broker.close(resolve));
        }
    };
}

async function validateRetainFlag(url) {
    const publisher = mqtt.connect(url, {
        clientId: `${TEST_ID}-retain-pub`,
        reconnectPeriod: 0
    });
    await waitForConnect(publisher);

    await publish(
        publisher,
        TOPICS.config,
        {
            sensorId: "terminal-a",
            modo: "validacao-retain",
            timestamp: new Date().toISOString()
        },
        { qos: 1, retain: true }
    );
    await endClient(publisher);

    const subscriber = mqtt.connect(url, {
        clientId: `${TEST_ID}-retain-sub`,
        clean: true,
        reconnectPeriod: 0
    });
    await waitForConnect(subscriber);

    const retainedPromise = waitForMessage(
        subscriber,
        ({ topic, payload, packet }) =>
            topic === TOPICS.config &&
            packet.retain === true &&
            payload.modo === "validacao-retain",
        "subscriber receber mensagem retida"
    );

    await subscribe(subscriber, TOPICS.config, { qos: 1 });
    const retained = await retainedPromise;

    assert.equal(retained.packet.retain, true);
    assert.equal(retained.payload.modo, "validacao-retain");
    await endClient(subscriber);

    console.log("[ok] Retain Flag: subscriber novo recebeu a ultima mensagem retida.");
}

async function validateLastWill(url) {
    const monitor = mqtt.connect(url, {
        clientId: `${TEST_ID}-lwt-monitor`,
        clean: true,
        reconnectPeriod: 0
    });
    await waitForConnect(monitor);
    await subscribe(monitor, TOPICS.status, { qos: 1 });

    const dyingPublisher = mqtt.connect(url, {
        clientId: `${TEST_ID}-lwt-pub`,
        keepalive: 1,
        reconnectPeriod: 0,
        will: {
            topic: TOPICS.status,
            payload: JSON.stringify({
                sensorId: "terminal-a",
                status: "offline",
                lwt: true,
                motivo: "validacao_queda_abrupta"
            }),
            qos: 1,
            retain: true
        }
    });
    await waitForConnect(dyingPublisher);

    const onlinePromise = waitForMessage(
        monitor,
        ({ topic, payload }) => topic === TOPICS.status && payload.status === "online",
        "monitor receber status online"
    );

    await publish(
        dyingPublisher,
        TOPICS.status,
        {
            sensorId: "terminal-a",
            status: "online",
            lwt: false,
            motivo: "validacao_conexao_estabelecida"
        },
        { qos: 1, retain: true }
    );
    await onlinePromise;

    const lastWillPromise = waitForMessage(
        monitor,
        ({ topic, payload }) =>
            topic === TOPICS.status &&
            payload.status === "offline" &&
            payload.lwt === true &&
            payload.motivo === "validacao_queda_abrupta",
        "monitor receber Last Will"
    );

    dyingPublisher.stream.destroy(new Error("validacao: queda abrupta"));
    const lastWill = await lastWillPromise;

    assert.equal(lastWill.payload.status, "offline");
    assert.equal(lastWill.payload.lwt, true);

    const freshSubscriber = mqtt.connect(url, {
        clientId: `${TEST_ID}-lwt-fresh-sub`,
        clean: true,
        reconnectPeriod: 0
    });
    await waitForConnect(freshSubscriber);

    const retainedLwtPromise = waitForMessage(
        freshSubscriber,
        ({ topic, payload, packet }) =>
            topic === TOPICS.status &&
            packet.retain === true &&
            payload.status === "offline" &&
            payload.lwt === true,
        "subscriber novo receber Last Will retido"
    );

    await subscribe(freshSubscriber, TOPICS.status, { qos: 1 });
    const retainedLwt = await retainedLwtPromise;

    assert.equal(retainedLwt.packet.retain, true);
    assert.equal(retainedLwt.payload.lwt, true);

    await endClient(monitor);
    await endClient(freshSubscriber);
    await delay(100);

    console.log("[ok] Last Will: broker publicou offline apos queda abrupta.");
    console.log("[ok] Last Will + Retain: subscriber novo recebeu o offline retido.");
}

async function main() {
    const broker = await startBroker();
    console.log(`[info] Broker de validacao iniciado em ${broker.url}`);

    try {
        await validateRetainFlag(broker.url);
        await validateLastWill(broker.url);
        console.log("[ok] Validacao completa: LWT e Retain Flag funcionando.");
    } finally {
        await broker.close();
    }
}

main().catch((err) => {
    console.error("[erro] Validacao falhou:", err.message);
    process.exit(1);
});
