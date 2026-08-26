"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "@/services/t212.service";
import { HIDDEN, formatEur } from "@/lib/format";
import { useHiddenValues } from "@/context/HiddenValuesContext";

const PAGE = 50;

export function OrdersTable() {
  // A quantidade e o valor da ordem sao tapados. O preco por accao e a taxa de
  // cambio ficam: sao cotacoes de mercado e, sem a quantidade, nao dizem
  // quanto se investiu.
  const hidden = useHiddenValues();
  const [ticker, setTicker] = useState("");
  const [side, setSide] = useState<"" | "BUY" | "SELL">("");
  const [offset, setOffset] = useState(0);

  const { data } = useQuery({
    queryKey: ["t212-orders", ticker, side, offset],
    queryFn: () =>
      fetchOrders({
        ticker: ticker || undefined,
        side: side || undefined,
        limit: PAGE,
        offset,
      }),
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Orders</h2>
        <div className="flex items-center gap-2 text-sm">
          <input
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value);
              setOffset(0);
            }}
            placeholder="Filter by instrument"
            className="rounded-md border px-2 py-1 text-sm"
          />
          <select
            value={side}
            onChange={(e) => {
              setSide(e.target.value as "" | "BUY" | "SELL");
              setOffset(0);
            }}
            className="rounded-md border px-2 py-1 text-sm"
          >
            <option value="">Buys and sells</option>
            <option value="BUY">Buys only</option>
            <option value="SELL">Sells only</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Instrument</th>
              <th className="px-2 py-2 text-left">Side</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Price</th>
              <th className="px-2 py-2 text-right">Value</th>
              <th className="px-2 py-2 text-right">FX rate</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((o) => (
              <tr key={o.externalId} className="border-b last:border-0">
                <td className="px-2 py-2">{o.filledAt.slice(0, 10)}</td>
                <td className="px-2 py-2">{o.ticker}</td>
                <td className="px-2 py-2">{o.side === "BUY" ? "Buy" : "Sell"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{hidden ? HIDDEN : Number(o.quantity).toFixed(4)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{Number(o.price).toFixed(2)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatEur(Number(o.netValue), hidden)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {o.fxRate ? Number(o.fxRate).toFixed(4) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {data
            ? data.total === 0
              ? "No orders"
              : `${offset + 1}–${Math.min(offset + PAGE, data.total)} of ${data.total}`
            : ""}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE))} className="rounded-md border px-2 py-1 disabled:opacity-40">
            Previous
          </button>
          <button type="button" disabled={!data || offset + PAGE >= data.total} onClick={() => setOffset((o) => o + PAGE)} className="rounded-md border px-2 py-1 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
