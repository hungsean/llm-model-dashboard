import { useEffect, useMemo, useState } from "react";
import type { ModelPricing, PricingResponse } from "../worker/types";
import "./PricingTable.css";

type SortKey = "inputPricePerMTok" | "outputPricePerMTok";
type SortDir = "asc" | "desc";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function formatPrice(val: number | null): string {
  if (val === null) return "—";
  return priceFormatter.format(val);
}

function formatContext(val: number | null): string {
  if (val === null) return "—";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(val);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function PricingTable() {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("inputPricePerMTok");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PricingResponse>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const providers = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.models.map((m) => m.provider))).sort();
  }, [data]);

  const sorted = useMemo(() => {
    if (!data) return [];
    let list = data.models;

    if (providerFilter) list = list.filter((m) => m.provider === providerFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) || m.modelId.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, providerFilter, search, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  if (loading) return <p className="pt-status">載入中...</p>;
  if (error) return <p className="pt-status pt-error">載入失敗：{error}</p>;
  if (!data || data.models.length === 0)
    return <p className="pt-status">目前沒有價格資料。</p>;

  return (
    <section className="pt-wrapper">
      <div className="pt-meta">
        <span className="pt-unit">單位：USD / 1M tokens</span>
        <span className="pt-updated">
          資料更新：{data.fetchedAt ? formatDate(data.fetchedAt) : "尚無資料"}
        </span>
      </div>

      <div className="pt-controls">
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          aria-label="篩選 Provider"
        >
          <option value="">所有 Provider</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <input
          type="search"
          placeholder="搜尋模型名稱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="搜尋模型"
        />
      </div>

      <div className="pt-scroll">
        <table className="pt-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>模型</th>
              <th
                className="pt-sortable"
                onClick={() => handleSort("inputPricePerMTok")}
                aria-sort={sortKey === "inputPricePerMTok" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Input 價格{sortLabel("inputPricePerMTok")}
              </th>
              <th
                className="pt-sortable"
                onClick={() => handleSort("outputPricePerMTok")}
                aria-sort={sortKey === "outputPricePerMTok" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Output 價格{sortLabel("outputPricePerMTok")}
              </th>
              <th>Context Window</th>
              <th>更新時間</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="pt-empty">
                  沒有符合條件的模型
                </td>
              </tr>
            ) : (
              sorted.map((m: ModelPricing) => (
                <tr key={`${m.provider}/${m.modelId}`}>
                  <td data-label="Provider">{m.provider}</td>
                  <td data-label="模型">
                    <span className="pt-model-cell">
                      <span className="pt-model-name">{m.displayName}</span>
                      <span className="pt-model-id">{m.modelId}</span>
                    </span>
                  </td>
                  <td data-label="Input 價格">{formatPrice(m.inputPricePerMTok)}</td>
                  <td data-label="Output 價格">{formatPrice(m.outputPricePerMTok)}</td>
                  <td data-label="Context Window">{formatContext(m.contextWindow)}</td>
                  <td data-label="更新時間">{formatDate(m.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="pt-count">共 {sorted.length} 個模型</p>
    </section>
  );
}
