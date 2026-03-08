# browser-extension (opcional)

Extensão Chrome simples para escutar `command_triggered` via WebSocket e aplicar ações na página ativa.

## Como usar

1. Abra `chrome://extensions`
2. Ative **Developer mode**
3. Clique em **Load unpacked** e selecione `browser-extension/`
4. Garanta backend WS acessível em `ws://localhost:8000/api/v1/ws/live`

Se precisar mudar URL WS, altere `DEFAULT_WS_URL` em `background.js` (MVP atual sem tela de configuração).

## Comandos suportados

- `SCROLL_DOWN`
- `SCROLL_UP`
- `NEXT` (`history.forward()`)
- `PREV` (`history.back()`)

## Observação

Este bridge é MVP e não faz autenticação/JWT.
