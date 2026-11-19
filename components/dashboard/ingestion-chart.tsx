"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Point = { day: string; ingested: number; failed: number };

export function IngestionChart({ data }: { data: Point[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingestion volume</CardTitle>
        <span className="text-xs text-dim">Last 14 days</span>
      </CardHeader>
      <CardContent className="h-64">
        {data.every((p) => p.ingested === 0) ? (
          <p className="grid h-full place-items-center text-center text-sm text-dim">Upload volume over the last 14 days will chart here.</p>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="ingested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#15302e" vertical={false} />
            <XAxis dataKey="day" stroke="#7f9f9a" fontSize={11} tickLine={false} axisLine={false} interval={1} />
            <YAxis stroke="#7f9f9a" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#0a1716", border: "1px solid #15302e", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#e6f4f1" }}
            />
            <Area type="monotone" dataKey="ingested" stroke="#2dd4bf" strokeWidth={2} fill="url(#ingested)" name="Ingested" />
            <Area type="monotone" dataKey="failed" stroke="#f0616d" strokeWidth={2} fillOpacity={0} name="Failed" />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
