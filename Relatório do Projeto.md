# Relatório do Projeto — GazePilot

Alunos: Rogério (1969016), Willian, Cauã, Bruno, Nicolas

## 1. Tema e objetivo

O projeto foi migrado para **GazePilot**, uma plataforma de acessibilidade e análise de UX baseada em visão computacional.

Objetivo principal:

- Permitir navegação hands-free usando movimentos de cabeça (MVP).
- Estimar pontos de gaze calibrados para gerar heatmaps por sessão/página.
- Produzir métricas de uso para análise de usabilidade e comportamento de navegação.

## 2. Problema abordado

Pessoas com mobilidade reduzida ou fadiga em uso contínuo de mouse/teclado precisam de alternativas de interação mais naturais.

Além disso, equipes de UX precisam compreender onde usuários concentram atenção em páginas sem instrumentação invasiva de vídeo.

## 3. Solução proposta

### 3.1 Hardware

- **ESP32-CAM (OV2640)** captura frames JPEG e envia para API via Wi-Fi.
- Firmware com reconexão automática e pareamento com sessão ativa para reduzir falhas operacionais.

### 3.2 Backend

- **FastAPI** para ingestão, processamento e publicação de eventos ao vivo.
- **PostgreSQL** como banco principal.
- **Alembic** para versionamento de schema.
- Pipeline CV robusto com **MediaPipe Face Landmarker + OpenCV solvePnP** para head pose.
- Fallback para OpenCV (Haar) quando modelo MediaPipe não estiver disponível.

### 3.3 Frontend

- **Next.js** com dashboard para:
  - live metrics
  - wizard de calibração (5/9 pontos)
  - listagem de sessões
  - relatório com heatmap e timeline
  - botão de sincronização de sessão ativa (`Attach Active`) para testes com hardware real

## 4. Modelo de dados

Principais tabelas:

- devices
- sessions
- pages
- calibration_profiles
- calibration_points
- frame_events
- face_metrics
- gaze_points
- commands
- anomalies

## 5. Pipeline e regras do MVP

Regras de comando com janela de 400ms e cooldown de 1s:

- `yaw > +20°` -> `NEXT`
- `yaw < -20°` -> `PREV`
- `pitch < -15°` -> `SCROLL_DOWN`
- `pitch > +15°` -> `SCROLL_UP`

Com smoothing por EMA e histerese para reduzir falso positivo.

## 6. Calibração e heatmap

- Usuário coleta 5 ou 9 pontos-alvo.
- Backend treina regressão linear e salva parâmetros no perfil.
- Frames seguintes geram gaze `(x,y)` com confiança.
- Relatório agrega bins para heatmap por sessão.

## 7. Resultados esperados

- Navegação sem contato físico em tarefas de leitura/navegação.
- Relatórios de atenção visual por página.
- Base para evolução futura com modelos de gaze mais robustos.

## 8. Limitações

- Sensível a iluminação ruim.
- Reflexo em óculos pode reduzir confiança.
- Estimativa de gaze no MVP depende de calibração e pose.

## 9. Privacidade e ética

- Não persistir vídeo bruto por padrão.
- Armazenar apenas métricas e pontos necessários para funcionalidade.
- Informar usuário quando rastreamento estiver ativo.
- Aplicar políticas de retenção e acesso controlado.

## 10. Próximos passos

- Integrar worker Redis em produção.
- Melhorar modelo de gaze com landmarks faciais mais ricos.
- Adicionar extensão de navegador para executar comandos automaticamente.
