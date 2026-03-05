"use client";

import { type ComponentType, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  RefreshCcw,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { formatDateTime, formatElapsed, formatShortTime, formatValue } from "@/lib/format";
import type { DashboardFilters, SensorReading } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEVICE_PRESETS = ["esp32-wokwi-001", "esp32-wokwi-api-test-001", "esp32-001"];

const WINDOW_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 60, label: "1 hora" },
  { value: 360, label: "6 horas" },
  { value: 1440, label: "24 horas" },
  { value: 4320, label: "3 dias" },
];

const LIMIT_OPTIONS = [120, 240, 480, 800, 1200];

const REFRESH_OPTIONS = [5000, 10000, 15000, 30000, 60000];

function computeAverage(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null && !Number.isNaN(value));
  if (valid.length === 0) {
    return null;
  }

  return valid.reduce((sum, item) => sum + item, 0) / valid.length;
}

function clamp(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}

interface MetricDefinition {
  key: keyof Pick<
    SensorReading,
    | "temperature_c"
    | "humidity_pct"
    | "pressure_hpa"
    | "gas_resistance_ohm"
    | "voc_index"
    | "air_quality_score"
  >;
  title: string;
  unit: string;
  decimals: number;
  icon: ComponentType<{ className?: string }>;
}

const metrics: MetricDefinition[] = [
  {
    key: "temperature_c",
    title: "Temperatura",
    unit: "°C",
    decimals: 1,
    icon: Thermometer,
  },
  {
    key: "humidity_pct",
    title: "Umidade",
    unit: "%",
    decimals: 1,
    icon: Waves,
  },
  {
    key: "pressure_hpa",
    title: "Pressão",
    unit: "hPa",
    decimals: 1,
    icon: Gauge,
  },
  {
    key: "gas_resistance_ohm",
    title: "Resistência Gás",
    unit: "ohm",
    decimals: 0,
    icon: Activity,
  },
  {
    key: "voc_index",
    title: "VOC Index",
    unit: "",
    decimals: 1,
    icon: Wind,
  },
  {
    key: "air_quality_score",
    title: "Air Quality Score",
    unit: "",
    decimals: 1,
    icon: AlertTriangle,
  },
];

export function DashboardShell() {
  const {
    data,
    filters,
    loading,
    refreshing,
    error,
    realtimeStatus,
    setFilters,
    refreshNow,
    readingsAsc,
  } =
    useDashboardData();

  const [draft, setDraft] = useState<DashboardFilters>(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const latest = data.latest;
  const previous = data.readingsDesc[1] ?? null;

  const urgentCount = useMemo(
    () => data.readingsDesc.filter((reading) => reading.is_urgent).length,
    [data.readingsDesc],
  );

  const heartbeatCount = useMemo(
    () => data.readingsDesc.filter((reading) => reading.is_heartbeat).length,
    [data.readingsDesc],
  );

  const averageAir = useMemo(
    () => computeAverage(data.readingsDesc.map((reading) => reading.air_quality_score)),
    [data.readingsDesc],
  );

  const averageHumidity = useMemo(
    () => computeAverage(data.readingsDesc.map((reading) => reading.humidity_pct)),
    [data.readingsDesc],
  );

  const maxTemperature = useMemo(() => {
    if (data.readingsDesc.length === 0) {
      return null;
    }

    return Math.max(...data.readingsDesc.map((item) => item.temperature_c));
  }, [data.readingsDesc]);

  const minTemperature = useMemo(() => {
    if (data.readingsDesc.length === 0) {
      return null;
    }

    return Math.min(...data.readingsDesc.map((item) => item.temperature_c));
  }, [data.readingsDesc]);

  const chartData = useMemo(
    () =>
      readingsAsc.map((reading) => ({
        ...reading,
        timeLabel: formatShortTime(reading.timestamp),
      })),
    [readingsAsc],
  );

  const alertState = useMemo(() => {
    if (!latest) {
      return {
        badge: "secondary" as const,
        title: "Sem dados",
        message: "Ainda não há leituras para esse device no período selecionado.",
      };
    }

    if (latest.is_urgent) {
      return {
        badge: "destructive" as const,
        title: "Estado crítico",
        message: "A última leitura foi marcada como urgente pelo firmware do ESP32.",
      };
    }

    if ((latest.voc_index ?? 0) >= 65 || (latest.air_quality_score ?? 100) <= 45) {
      return {
        badge: "warning" as const,
        title: "Atenção",
        message: "VOC alto ou score de qualidade baixo. Verifique ventilação imediatamente.",
      };
    }

    return {
      badge: "default" as const,
      title: "Operação estável",
      message: "Sem sinais críticos para os critérios atuais da sua lógica de borda.",
    };
  }, [latest]);

  function applyFilterChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next: DashboardFilters = {
      deviceId: draft.deviceId.trim() || filters.deviceId,
      minutes: clamp(draft.minutes, filters.minutes, 1, 43200),
      limit: clamp(draft.limit, filters.limit, 1, 2000),
      autoRefresh: draft.autoRefresh,
      refreshMs: clamp(draft.refreshMs, filters.refreshMs, 5000, 300000),
    };

    setFilters(next);
  }

  const apiStatusIsOk = data.health?.api?.toLowerCase() === "ok";
  const influxStatusIsOk = data.health?.influxdb?.toLowerCase() === "ok";
  const realtimeBadgeVariant =
    realtimeStatus === "connected"
      ? "default"
      : realtimeStatus === "connecting"
        ? "warning"
        : realtimeStatus === "error"
          ? "destructive"
          : "secondary";

  return (
    <div className="relative mx-auto w-full max-w-[1560px] px-4 py-5 md:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dashboard-grid bg-[length:4px_4px] opacity-20" />

      <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
        <Card className="glass-panel h-fit">
          <CardHeader className="space-y-2">
            <p className="eyebrow">AIR QUALITY INTELLIGENCE</p>
            <CardTitle className="font-display text-2xl">AirPort Ops Center</CardTitle>
            <CardDescription className="text-balance text-slate-300/90">
              Fluxo: ESP32/BME680 envia leitura para FastAPI, backend grava no InfluxDB e
              este dashboard faz carga inicial via REST e atualização em tempo real por WebSocket.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form className="space-y-4" onSubmit={applyFilterChanges}>
              <div className="space-y-2">
                <Label htmlFor="device-id">Device ID</Label>
                <Input
                  id="device-id"
                  value={draft.deviceId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, deviceId: event.target.value }))
                  }
                  placeholder="esp32-wokwi-001"
                />

                <div className="flex flex-wrap gap-2">
                  {DEVICE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-emerald-400/60 hover:text-slate-50"
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          deviceId: preset,
                        }))
                      }
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Janela histórica</Label>
                <Select
                  value={String(draft.minutes)}
                  onValueChange={(value) =>
                    setDraft((current) => ({ ...current, minutes: Number(value) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a janela" />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Limite de pontos</Label>
                <Select
                  value={String(draft.limit)}
                  onValueChange={(value) =>
                    setDraft((current) => ({ ...current, limit: Number(value) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o limite" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-refresh" className="text-slate-200">
                    Auto refresh
                  </Label>
                  <p className="text-xs text-slate-400">Atualização contínua dos gráficos</p>
                </div>
                <Switch
                  id="auto-refresh"
                  checked={draft.autoRefresh}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, autoRefresh: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Intervalo de refresh</Label>
                <Select
                  value={String(draft.refreshMs)}
                  onValueChange={(value) =>
                    setDraft((current) => ({ ...current, refreshMs: Number(value) }))
                  }
                  disabled={!draft.autoRefresh}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o intervalo" />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRESH_OPTIONS.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value / 1000}s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full">
                Aplicar filtros
              </Button>
            </form>

            <div className="rounded-xl border border-white/10 bg-slate-900/65 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>Status API</span>
                <Badge variant={apiStatusIsOk ? "default" : "destructive"}>
                  {data.health?.api ?? "-"}
                </Badge>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>Realtime (WebSocket)</span>
                <Badge variant={realtimeBadgeVariant}>{realtimeStatus}</Badge>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>Status InfluxDB</span>
                <Badge variant={influxStatusIsOk ? "default" : "warning"}>
                  {data.health?.influxdb ?? "-"}
                </Badge>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>Último sync</span>
                <span className="text-slate-200">
                  {data.syncedAt ? formatDateTime(data.syncedAt) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Pontos carregados</span>
                <span className="text-slate-200">{data.readingsDesc.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="glass-panel">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
              <div>
                <p className="eyebrow">Dashboard em produção</p>
                <h2 className="mt-1 font-display text-2xl text-slate-50">
                  Device: {filters.deviceId}
                </h2>
                <p className="mt-1 text-sm text-slate-300/90">
                  Última leitura: {latest ? formatDateTime(latest.timestamp) : "sem dados"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={alertState.badge}>{alertState.title}</Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void refreshNow();
                  }}
                  disabled={refreshing}
                  className="gap-2"
                >
                  <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Card className="glass-panel border-red-400/40 bg-red-950/30">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-red-200">Erro ao carregar dados</p>
                  <p className="text-sm text-red-200/80">{error}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    void refreshNow();
                  }}
                >
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              const latestValue = latest?.[metric.key] ?? null;
              const previousValue = previous?.[metric.key] ?? null;

              const hasTrend =
                typeof latestValue === "number" &&
                Number.isFinite(latestValue) &&
                typeof previousValue === "number" &&
                Number.isFinite(previousValue);
              const diff = hasTrend ? latestValue - previousValue : 0;
              const trendText = hasTrend
                ? `${diff > 0 ? "+" : ""}${diff.toFixed(metric.decimals)}${metric.unit}`
                : "Sem base";

              return (
                <Card key={metric.key} className="glass-panel">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {metric.title}
                        </p>
                        <p className="mt-2 font-display text-3xl leading-none text-slate-50">
                          {formatValue(latestValue, metric.decimals, metric.unit)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-2">
                        <Icon className="h-4 w-4 text-emerald-300" />
                      </div>
                    </div>

                    <p
                      className={cn(
                        "text-xs font-medium",
                        !hasTrend && "text-slate-400",
                        hasTrend && diff > 0 && "text-amber-300",
                        hasTrend && diff < 0 && "text-emerald-300",
                        hasTrend && diff === 0 && "text-slate-300",
                      )}
                    >
                      {trendText}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <Card className="glass-panel xl:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Conforto ambiental</CardTitle>
                  <CardDescription>Temperatura, umidade e pressão em série temporal</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                    <XAxis
                      dataKey="timestamp"
                      stroke="#94a3b8"
                      tickFormatter={(value) => formatShortTime(String(value))}
                      minTickGap={24}
                    />
                    <YAxis yAxisId="temp" stroke="#fbbf24" width={44} />
                    <YAxis yAxisId="humidity" orientation="right" stroke="#34d399" width={44} />
                    <YAxis yAxisId="pressure" hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(2, 8, 23, 0.92)",
                        border: "1px solid rgba(148, 163, 184, 0.24)",
                        borderRadius: 12,
                      }}
                      labelFormatter={(label) => formatDateTime(String(label))}
                    />
                    <Legend />
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="temperature_c"
                      name="Temperatura (°C)"
                      stroke="#fbbf24"
                      strokeWidth={2.4}
                      dot={false}
                    />
                    <Line
                      yAxisId="humidity"
                      type="monotone"
                      dataKey="humidity_pct"
                      name="Umidade (%)"
                      stroke="#34d399"
                      strokeWidth={2.2}
                      dot={false}
                    />
                    <Line
                      yAxisId="pressure"
                      type="monotone"
                      dataKey="pressure_hpa"
                      name="Pressão (hPa)"
                      stroke="#60a5fa"
                      strokeWidth={1.8}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Qualidade do ar</CardTitle>
                <CardDescription>AQ score e VOC index</CardDescription>
              </CardHeader>
              <CardContent className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                    <XAxis
                      dataKey="timestamp"
                      stroke="#94a3b8"
                      tickFormatter={(value) => formatShortTime(String(value))}
                      minTickGap={24}
                    />
                    <YAxis stroke="#94a3b8" width={36} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(2, 8, 23, 0.92)",
                        border: "1px solid rgba(148, 163, 184, 0.24)",
                        borderRadius: 12,
                      }}
                      labelFormatter={(label) => formatDateTime(String(label))}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="air_quality_score"
                      name="AQ Score"
                      stroke="#4ade80"
                      fill="rgba(74, 222, 128, 0.2)"
                      strokeWidth={2.2}
                    />
                    <Line
                      type="monotone"
                      dataKey="voc_index"
                      name="VOC Index"
                      stroke="#f87171"
                      strokeWidth={2.2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Resistência de gás</CardTitle>
                <CardDescription>Comportamento do sensor no período</CardDescription>
              </CardHeader>
              <CardContent className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                    <XAxis
                      dataKey="timestamp"
                      stroke="#94a3b8"
                      tickFormatter={(value) => formatShortTime(String(value))}
                      minTickGap={24}
                    />
                    <YAxis stroke="#94a3b8" width={44} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(2, 8, 23, 0.92)",
                        border: "1px solid rgba(148, 163, 184, 0.24)",
                        borderRadius: 12,
                      }}
                      labelFormatter={(label) => formatDateTime(String(label))}
                    />
                    <Legend />
                    <Bar
                      dataKey="gas_resistance_ohm"
                      name="Gas (ohm)"
                      fill="rgba(125, 211, 252, 0.56)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-3 2xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Últimas leituras</CardTitle>
                <CardDescription>Top 12 registros da janela selecionada</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horário</TableHead>
                      <TableHead>Temp</TableHead>
                      <TableHead>Umid</TableHead>
                      <TableHead>AQ</TableHead>
                      <TableHead>VOC</TableHead>
                      <TableHead>Urgente</TableHead>
                      <TableHead>Heartbeat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.readingsDesc.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-400">
                          Sem dados para o filtro atual.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.readingsDesc.slice(0, 12).map((reading) => (
                        <TableRow key={`${reading.timestamp}-${reading.device_id}`}>
                          <TableCell>{formatDateTime(reading.timestamp)}</TableCell>
                          <TableCell>{formatValue(reading.temperature_c, 1, "°C")}</TableCell>
                          <TableCell>{formatValue(reading.humidity_pct, 1, "%")}</TableCell>
                          <TableCell>{formatValue(reading.air_quality_score, 1, "")}</TableCell>
                          <TableCell>{formatValue(reading.voc_index, 1, "")}</TableCell>
                          <TableCell>
                            <Badge variant={reading.is_urgent ? "destructive" : "default"}>
                              {reading.is_urgent ? "Sim" : "Não"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={reading.is_heartbeat ? "warning" : "secondary"}>
                              {reading.is_heartbeat ? "Sim" : "Não"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Insights da janela</CardTitle>
                <CardDescription>Indicadores derivados da telemetria</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Urgências</p>
                  <p className="mt-1 text-2xl font-display text-red-300">{urgentCount}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Heartbeats</p>
                  <p className="mt-1 text-2xl font-display text-amber-200">{heartbeatCount}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    Média de qualidade
                  </p>
                  <p className="mt-1 text-2xl font-display text-emerald-200">
                    {formatValue(averageAir, 1, "")}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    Média de umidade
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">
                    {formatValue(averageHumidity, 1, "%")}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    Faixa de temperatura
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">
                    {formatValue(minTemperature, 1, "°C")} a {formatValue(maxTemperature, 1, "°C")}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Última amostra</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">
                    {latest ? formatElapsed(latest.timestamp) : "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <Badge variant={alertState.badge}>{alertState.title}</Badge>
                  <p className="mt-2 text-sm text-slate-200">{alertState.message}</p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
          <div className="rounded-xl border border-white/10 bg-slate-900/85 px-5 py-4 text-sm text-slate-200">
            Carregando dashboard...
          </div>
        </div>
      ) : null}
    </div>
  );
}
