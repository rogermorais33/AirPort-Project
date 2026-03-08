import { cn } from "@/lib/utils";

interface PoseMeterProps {
  label: string;
  value: number;
  threshold?: number;
  unit?: string;
}

export function PoseMeter({ label, value, threshold, unit = "°" }: PoseMeterProps) {
  const abs = Math.abs(value);
  const danger = threshold ? abs >= threshold : false;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className={cn("text-3xl font-semibold", danger ? "text-orange-300" : "text-emerald-300")}>
          {value.toFixed(1)}
          <span className="ml-1 text-sm text-zinc-400">{unit}</span>
        </p>
        {threshold ? (
          <span className={cn("text-xs", danger ? "text-orange-300" : "text-zinc-500")}>
            limiar ±{threshold}
          </span>
        ) : null}
      </div>
    </div>
  );
}
