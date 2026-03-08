# Edge Computing — GazePilot (Edge Híbrido)

## Por que não processar CV completo no ESP32-CAM?

A ESP32-CAM é excelente para captura e transmissão de imagem, mas limitada para inferência CV robusta em tempo real (landmarks, regressão de gaze, agregação histórica e regras avançadas).

Limitações práticas no dispositivo:

- CPU e RAM restritas para pipeline de visão mais complexo.
- Variabilidade alta de qualidade de imagem e iluminação.
- Custo de manter modelos atualizados no firmware.

## Estratégia adotada: Edge Híbrido

### No edge (ESP32-CAM)

- Captura JPEG local.
- Controle de taxa (fps configurável).
- Upload dos frames com metadados para a API.
- Heartbeat e busca de configuração remota.
- Tentativa de anexar sessão ativa para manter consistência entre firmware e dashboard.

### No backend

- Processamento CV (MediaPipe Face Landmarker + solvePnP, com fallback OpenCV).
- Engine de comandos com histerese/cooldown.
- Persistência temporal e agregação de relatórios.
- Publicação de eventos via websocket.

## Benefícios

- Firmware simples e estável.
- Evolução de modelo sem regravar hardware.
- Melhor observabilidade (latência, erro, confiança, anomalias).

## Escalonamento

- MVP: processamento síncrono/fila em memória.
- Produção: Redis + worker dedicado para desacoplar ingestão e inferência.
