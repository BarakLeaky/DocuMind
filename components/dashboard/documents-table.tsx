"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel,
  useReactTable, type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteDocumentAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { PROCESSING_STATES, STATUS_META, type ProcessingState } from "@/lib/constants";
import type { DocumentRow } from "@/lib/types";
import { formatBytes, timeAgo } from "@/lib/utils";

const col = createColumnHelper<DocumentRow>();

export function DocumentsTable({ data, pageSize = 8, compact = false, canDelete = false }: { data: DocumentRow[]; pageSize?: number; compact?: boolean; canDelete?: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(row: DocumentRow) {
    if (!window.confirm(`Delete "${row.title}"? This removes the file, its passages and its extracted data.`)) return;
    setDeleting(row.id);
    setError(null);
    try {
      await deleteDocumentAction(row.id);
      router.refresh();
    } catch {
      setError("Could not delete the document. Try again.");
    } finally {
      setDeleting(null);
    }
  }

  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<ProcessingState | "all">("all");

  const rows = useMemo(() => (status === "all" ? data : data.filter((d) => d.status === status)), [data, status]);

  const columns = useMemo(
    () => [
      col.accessor("title", {
        header: "Document",
        cell: (c) => (
          <Link href={`/documents/${c.row.original.id}`} className="font-medium hover:text-brand">
            {c.getValue()}
          </Link>
        ),
      }),
      col.accessor("type", { header: "Type", cell: (c) => <span className="text-dim">{c.getValue()}</span> }),
      col.accessor("status", { header: "Status", cell: (c) => <StatusBadge status={c.getValue()} /> }),
      ...(compact ? [] : [col.accessor("pages", { header: "Pages", cell: (c) => <span className="tabular-nums text-dim">{c.getValue()}</span> })]),
      col.accessor("version", { header: "Ver.", cell: (c) => <span className="text-dim">v{c.getValue()}</span> }),
      ...(compact ? [] : [col.accessor("sizeBytes", { header: "Size", cell: (c) => <span className="text-dim">{formatBytes(c.getValue())}</span> })]),
      col.accessor("confidence", {
        header: "Confidence",
        cell: (c) => {
          const v = c.getValue();
          return v == null ? <span className="text-dim">—</span> : <span className="tabular-nums">{Math.round(v * 100)}%</span>;
        },
      }),
      col.accessor("updatedAt", { header: "Updated", cell: (c) => <span className="text-dim">{timeAgo(c.getValue())}</span> }),
      ...(canDelete
        ? [col.display({
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: (c) => (
              <Button variant="ghost" size="icon" className="size-8 text-dim hover:text-danger" aria-label={`Delete ${c.row.original.title}`} disabled={deleting === c.row.original.id} onClick={() => remove(c.row.original)}>
                <Trash2 />
              </Button>
            ),
          })]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compact, canDelete, deleting],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-dim" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter documents…" className="pl-9" aria-label="Filter documents" />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProcessingState | "all")}
          className="h-9 rounded-lg border border-line bg-panel px-3 text-sm"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {PROCESSING_STATES.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-dim">{table.getFilteredRowModel().rows.length} documents</span>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel-2/60 text-left text-xs uppercase tracking-wide text-dim">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-2.5 font-medium">
                    {h.column.getCanSort() ? (
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <ArrowUpDown className="size-3 opacity-60" />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-dim">No documents match your filters.</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-line hover:bg-panel-2/40">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className="mr-2 text-xs text-dim">Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
        <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page"><ChevronLeft /></Button>
        <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </div>
  );
}
