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
            className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-emerald-300">{command.command}</span>
              <span className="text-xs text-zinc-500">{(command.confidence * 100).toFixed(0)}%</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">{command.trigger}</p>
            {command.ts ? <p className="mt-1 text-[11px] text-zinc-500">{new Date(command.ts).toLocaleTimeString()}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
