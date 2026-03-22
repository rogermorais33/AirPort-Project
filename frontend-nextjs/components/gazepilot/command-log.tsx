import type { CommandEvent } from "@/lib/types";

interface CommandLogProps {
  commands: CommandEvent[];
}

export function CommandLog({ commands }: CommandLogProps) {
  if (commands.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50">
        <p className="text-sm text-zinc-500">Nenhum comando disparado.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <ul className="space-y-2">
        {commands.map((command, index) => (
          <li
            key={`${command.ts ?? "ts"}-${command.command}-${index}`}
            className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] px-3 py-3 text-sm shadow-[0_10px_30px_rgba(2,6,23,0.24)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-emerald-300">{command.command}</span>
              <div className="flex items-center gap-2">
                {command.source ? (
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                    {command.source === "eye_gaze" ? "íris" : command.source}
                  </span>
                ) : null}
                <span className="text-xs text-zinc-500">{(command.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-400">{command.trigger}</p>
            {command.ts ? <p className="mt-1 text-[11px] text-zinc-500">{new Date(command.ts).toLocaleTimeString()}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
