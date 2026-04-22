import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, Camera, Gamepad2, Orbit, Radar, Sparkles } from "lucide-react";

const routeCards = [
  {
    href: "/world",
    eyebrow: "Dream Expo City",
    title: "Explore o mundo 3D",
    body: "Ande com WASD, descubra distritos e ligue Browser Cam ou ESP32 so quando quiser interagir com gaze.",
    tone: "from-cyan-300/18 via-sky-400/8 to-transparent",
    badge: "free roam",
  },
  {
    href: "/live",
    eyebrow: "Control Room",
    title: "Ver o pipeline ao vivo",
    body: "Preview, pose, gaze cru, blink, comandos e tudo que esta sustentando a experiencia.",
    tone: "from-amber-300/18 via-pink-400/8 to-transparent",
    badge: "telemetry",
  },
  {
    href: "/calibration",
    eyebrow: "Calibration",
    title: "Ajustar e treinar",
    body: "Quando quiser sair do plug-and-play e refinar o mapeamento para sessao ou demo.",
    tone: "from-emerald-300/16 via-cyan-400/8 to-transparent",
    badge: "tune",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,18,32,0.97),rgba(15,12,36,0.92)_50%,rgba(8,22,30,0.94))] px-6 py-8 shadow-[0_34px_110px_rgba(2,6,23,0.48)] md:px-8 md:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.2),transparent_26%),radial-gradient(circle_at_80%_14%,rgba(251,191,36,0.16),transparent_24%),radial-gradient(circle_at_70%_72%,rgba(244,114,182,0.16),transparent_28%)]" />
        <div className="pointer-events-none absolute -left-16 top-16 h-56 w-56 rounded-full bg-cyan-300/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <HeroChip icon={Orbit} label="dream expo city" />
              <HeroChip icon={Gamepad2} label="wasd first" />
              <HeroChip icon={Camera} label="camera opcional" />
            </div>

            <p className="mt-6 text-xs uppercase tracking-[0.34em] text-cyan-100/72">GazePilot / AirPort Project</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-tight text-white md:text-6xl">
              Um site-jogo para explorar, testar e sentir eye tracking de um jeito mais vivo.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/66 md:text-lg">
              O mundo 3D agora e a entrada natural do projeto. Caminhe normalmente, descubra os distritos e ative
              Browser Cam ou ESP32 so nas experiencias em que gaze realmente faz sentido.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <PrimaryLink href="/world">Entrar no mundo</PrimaryLink>
              <SecondaryLink href="/live">Abrir control room</SecondaryLink>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <SignalCard label="Locomocao" value="WASD / setas" body="andar livre sem depender de webcam" />
              <SignalCard label="Interacao" value="Olhar + blink" body="menus, arcades, portas e diagnosticos" />
              <SignalCard label="Entrada" value="Browser Cam ou ESP32" body="troca de fonte sem quebrar o fluxo" />
            </div>
          </div>

          <div className="glass-panel relative overflow-hidden rounded-[32px] p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_34%)]" />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/42">Flow</p>
              <p className="mt-3 text-2xl font-semibold text-white">Como usar sem friccao</p>

              <div className="mt-5 space-y-3">
                <FlowStep
                  index="01"
                  title="Entrar no mundo"
                  body="Caminhe pelo skyport com teclado. Sem popup de camera logo de cara."
                />
                <FlowStep
                  index="02"
                  title="Escolher um distrito"
                  body="Aproxime, veja as acoes contextuais e entenda o que cada lugar faz."
                />
                <FlowStep
                  index="03"
                  title="Ligar tracking so quando quiser"
                  body="Browser Cam para fluidez. ESP32 para demo real do hardware."
                />
              </div>

              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">Why this feels better</p>
                <p className="mt-3 text-sm leading-6 text-white/68">
                  O projeto para de parecer um dashboard pesado e vira uma experiencia exploravel, com a parte
                  tecnica aparecendo quando agrega e nao como barreira inicial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        {routeCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.68))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.24)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-[linear-gradient(180deg,rgba(18,27,48,0.78),rgba(5,10,24,0.74))]"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.tone} opacity-90 transition duration-300 group-hover:opacity-100`} />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/48">{card.eyebrow}</p>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/60">
                  {card.badge}
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{card.title}</p>
              <p className="mt-3 text-sm leading-6 text-white/66">{card.body}</p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
                abrir rota
                <ArrowRight className="h-4 w-4 transition duration-300 group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function HeroChip({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/70">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/14 px-5 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
    >
      <Sparkles className="h-4 w-4" />
      <span>{children}</span>
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
    >
      <Radar className="h-4 w-4" />
      <span>{children}</span>
    </Link>
  );
}

function SignalCard({
  label,
  value,
  body,
}: {
  label: string;
  value: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
      <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-white/62">{body}</p>
    </div>
  );
}

function FlowStep({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-semibold tracking-[0.2em] text-cyan-100">
        {index}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-white/62">{body}</p>
      </div>
    </div>
  );
}
