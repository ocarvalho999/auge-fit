"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";

export function ProgressLineChart({
  data,
  unit,
  label,
}: {
  data: { date: string; value: number }[];
  unit: string;
  label: string;
}) {
  return (
    <div role="img" aria-label={`${label}: ${data.length} registros`} className="h-52 w-full" data-testid={`grafico-${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#3A4141" strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d).slice(0, 5)} stroke="#A8B0B0" fontSize={12} />
          <YAxis stroke="#A8B0B0" fontSize={12} />
          <Tooltip
            contentStyle={{ background: "#202525", border: "1px solid #3A4141", borderRadius: 8, color: "#F4F6F6" }}
            labelFormatter={(d) => formatDate(String(d))}
            formatter={(v) => [`${String(v)} ${unit}`, label]}
          />
          <Line type="monotone" dataKey="value" stroke="#B6FF32" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
