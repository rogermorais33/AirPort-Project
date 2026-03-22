export type DistrictActionId = "story" | "enter" | "challenge";
export type WorldLandmarkType = "market" | "apartments";

export interface DistrictAction {
  id: DistrictActionId;
  label: string;
  description: string;
}

export interface WorldDistrict {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  accent: string;
  landmarkType: WorldLandmarkType;
  boothId: string;
  position: [number, number, number];
  shellSize: [number, number, number];
  zoneRadius: number;
  signLabel: string;
  ambientLabel: string;
  lore: string;
  actions: DistrictAction[];
}

export const SKYPORT_DISTRICTS: WorldDistrict[] = [
  {
    id: "blink-theater",
    boothId: "blink-theater",
    title: "Blink Theater",
    subtitle: "memories, doors and blink cues",
    color: "#f59e0b",
    accent: "#fde68a",
    landmarkType: "apartments",
    position: [-11, 0, -10],
    shellSize: [8, 5.2, 7.2],
    zoneRadius: 7.4,
    signLabel: "Relive Lane",
    ambientLabel: "soft reels + warm projector glow",
    lore:
      "Um cinema de lembrancas curtas. O blink nao e so input aqui; ele faz o espaco respirar e troca a cena como se o usuario estivesse editando a propria memoria.",
    actions: [
      {
        id: "story",
        label: "Lore",
        description: "Ler a ideia por tras do blink theater.",
      },
      {
        id: "enter",
        label: "Enter",
        description: "Abrir a experiencia blink memory.",
      },
      {
        id: "challenge",
        label: "Pulse",
        description: "Acender os letreiros e testar blink ao vivo.",
      },
    ],
  },
  {
    id: "arcade-bay",
    boothId: "arcade-bay",
    title: "Arcade Bay",
    subtitle: "district for gaze games",
    color: "#d946ef",
    accent: "#f5d0fe",
    landmarkType: "market",
    position: [0, 0, -13],
    shellSize: [9.5, 5.8, 8.4],
    zoneRadius: 8.2,
    signLabel: "Arcade Strip",
    ambientLabel: "synth pads + coin glow",
    lore:
      "A parte mais playful do skyport. O objetivo nao e navegar o mundo com os olhos, e sim usar o olhar como dispositivo de mira, selecao e timing dentro dos minigames.",
    actions: [
      {
        id: "story",
        label: "Read",
        description: "Ver a proposta de gameplay para o gaze arcade.",
      },
      {
        id: "enter",
        label: "Play",
        description: "Abrir o arcade principal.",
      },
      {
        id: "challenge",
        label: "Boost",
        description: "Ativar highlight extra no distrito.",
      },
    ],
  },
  {
    id: "signal-observatory",
    boothId: "signal-observatory",
    title: "Signal Observatory",
    subtitle: "see where the system is reading you",
    color: "#22d3ee",
    accent: "#cffafe",
    landmarkType: "apartments",
    position: [11, 0, -10],
    shellSize: [8.4, 6.2, 7.2],
    zoneRadius: 7.5,
    signLabel: "Signal Deck",
    ambientLabel: "wind chimes + telemetry hum",
    lore:
      "Um observatorio para deixar o tracking explicito e bonito. Ele transforma dados tecnicos em leitura visual: direcao, confianca, origem e estado do input.",
    actions: [
      {
        id: "story",
        label: "Explain",
        description: "Mostrar o papel do observatory no produto.",
      },
      {
        id: "enter",
        label: "Track",
        description: "Abrir o compass de atencao.",
      },
      {
        id: "challenge",
        label: "Glow",
        description: "Ligar o beacon e reforcar o foco.",
      },
    ],
  },
  {
    id: "vision-dock",
    boothId: "vision-dock",
    title: "Vision Dock",
    subtitle: "camera preview and raw gaze stage",
    color: "#34d399",
    accent: "#d1fae5",
    landmarkType: "market",
    position: [-11, 0, 10],
    shellSize: [8.6, 5.5, 7.6],
    zoneRadius: 7.4,
    signLabel: "Dock 04",
    ambientLabel: "camera shutters + sea breeze",
    lore:
      "O dock de diagnostico. Aqui o usuario ve exatamente o que a camera esta capturando e como o ponto de gaze cru se comporta, local ou remoto.",
    actions: [
      {
        id: "story",
        label: "Inspect",
        description: "Entender o fluxo de preview e diagnostico.",
      },
      {
        id: "enter",
        label: "Preview",
        description: "Abrir camera, overlay e gaze map.",
      },
      {
        id: "challenge",
        label: "Align",
        description: "Reforcar a leitura de centro e visibilidade.",
      },
    ],
  },
  {
    id: "command-cafe",
    boothId: "command-cafe",
    title: "Command Cafe",
    subtitle: "logs, loops and command language",
    color: "#60a5fa",
    accent: "#dbeafe",
    landmarkType: "market",
    position: [0, 0, 13],
    shellSize: [9.2, 5.4, 8.2],
    zoneRadius: 8,
    signLabel: "Cafe Protocol",
    ambientLabel: "soft chatter + relay clicks",
    lore:
      "Um lounge para mostrar que gaze nao precisa ser gimmick. Aqui os eventos viram linguagem de comando, com timing, contexto e fonte de input bem definidas.",
    actions: [
      {
        id: "story",
        label: "Concept",
        description: "Explicar o modelo de comandos do projeto.",
      },
      {
        id: "enter",
        label: "Logs",
        description: "Abrir stream de comandos e sinais.",
      },
      {
        id: "challenge",
        label: "Queue",
        description: "Marcar o distrito como ativo.",
      },
    ],
  },
  {
    id: "latency-lab",
    boothId: "latency-lab",
    title: "Latency Lab",
    subtitle: "where natural feel is measured",
    color: "#f472b6",
    accent: "#fbcfe8",
    landmarkType: "apartments",
    position: [11, 0, 10],
    shellSize: [8.6, 5.7, 7.4],
    zoneRadius: 7.7,
    signLabel: "Lab 08",
    ambientLabel: "pulse lines + diagnostics",
    lore:
      "O laboratorio traduz o principal tradeoff do produto: quando usar browser cam para fluidez, quando usar ESP32 para demo embarcada e como comunicar isso de um jeito premium.",
    actions: [
      {
        id: "story",
        label: "Read",
        description: "Ler o raciocinio de performance do projeto.",
      },
      {
        id: "enter",
        label: "Metrics",
        description: "Abrir cards e telemetria de latencia.",
      },
      {
        id: "challenge",
        label: "Tune",
        description: "Dar foco no distrito e no pipeline ativo.",
      },
    ],
  },
];

export function getDistrictById(id: string | null | undefined) {
  if (!id) {
    return null;
  }
  return SKYPORT_DISTRICTS.find((district) => district.id === id) ?? null;
}

export function getDistrictActionByIndex(districtId: string | null | undefined, index: number) {
  const district = getDistrictById(districtId);
  if (!district) {
    return null;
  }
  const safeIndex = Math.max(0, Math.min(district.actions.length - 1, index));
  return district.actions[safeIndex] ?? null;
}
