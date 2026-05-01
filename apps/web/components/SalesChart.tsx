'use client';

import { webTheme } from '@counter/tokens/web';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Point {
  bucket: string;
  grossCents: number;
  orders: number;
}

interface Props {
  data: Point[];
  bucket: 'hour' | 'day';
}

const fmtMoney = (n: number) =>
  (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function formatBucket(value: string, bucket: 'hour' | 'day'): string {
  const d = new Date(value);
  if (bucket === 'hour') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SalesChart({ data, bucket }: Props) {
  const now = new Date();
  const currentBucket =
    bucket === 'hour'
      ? new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()),
        )
      : null;
  const nextBucket = currentBucket ? new Date(currentBucket.getTime() + 60 * 60 * 1000) : null;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={webTheme.colors.line} vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fill: webTheme.colors.ink3, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatBucket(v, bucket)}
          />
          <YAxis
            tick={{
              fill: webTheme.colors.ink3,
              fontSize: 12,
              fontFamily: webTheme.moneyFont.fontFamily,
            }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => fmtMoney(Number(v))}
            width={70}
          />
          <Tooltip
            contentStyle={{
              background: webTheme.colors.surface,
              border: `1px solid ${webTheme.colors.line2}`,
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(v) => formatBucket(String(v), bucket)}
            formatter={(value: number, name: string) =>
              name === 'grossCents' ? [fmtMoney(value), 'Gross'] : [String(value), 'Orders']
            }
          />
          {currentBucket && nextBucket && (
            <ReferenceArea
              x1={currentBucket.toISOString()}
              x2={nextBucket.toISOString()}
              fill={webTheme.colors.accent}
              fillOpacity={0.08}
            />
          )}
          <Line
            type="monotone"
            dataKey="grossCents"
            stroke={webTheme.colors.accentDeep}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
