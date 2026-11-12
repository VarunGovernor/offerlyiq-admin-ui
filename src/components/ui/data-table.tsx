import React from "react";
import { Pagination } from "./pagination";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  clientSidePagination?: boolean;
  pageSize?: number;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  pagination,
  clientSidePagination = true,
  pageSize = 10,
  isLoading,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = React.useState(1);

  // Determine display data and pagination state
  let displayData = data;
  let currentP = 1;
  let totalP = 1;
  let handlePageChange = (p: number) => {};
  let showPagination = false;

  if (pagination) {
    // Controlled / Server-side pagination
    displayData = data;
    currentP = pagination.currentPage;
    totalP = pagination.totalPages;
    handlePageChange = pagination.onPageChange;
    showPagination = totalP > 1;
  } else if (clientSidePagination) {
    // Uncontrolled / Client-side pagination
    totalP = Math.ceil((data?.length || 0) / pageSize) || 1;

    // Ensure current page is within bounds
    const safePage = Math.max(1, Math.min(internalPage, totalP));
    if (safePage !== internalPage && data?.length > 0) {
      setInternalPage(safePage);
    }

    const startIndex = (safePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    displayData = (data || []).slice(startIndex, endIndex);

    currentP = safePage;
    handlePageChange = (p) => setInternalPage(p);
    showPagination = totalP > 1;
  }

  return (
    <div className="w-full space-y-4">
      <div className="bg-background/40 border border-border backdrop-blur-xl rounded-xl overflow-hidden">
        <div className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Scrollable data table">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-600 dark:text-muted-foreground uppercase bg-foreground/5 border-b border-border/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-4 font-medium whitespace-nowrap ${
                      col.align === "center"
                        ? "text-center"
                        : col.align === "right"
                          ? "text-right"
                          : "text-left"
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 relative">
              {isLoading && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-12 text-center"
                  >
                    <div className="flex justify-center">
                      <div className="w-8 h-8 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && displayData.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}

              {!isLoading &&
                displayData.map((item, index) => (
                  <tr
                    key={keyExtractor(item) || String(index)}
                    className="hover:bg-foreground/5 transition-colors group"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-6 py-4 whitespace-nowrap ${
                          col.align === "center"
                            ? "text-center"
                            : col.align === "right"
                              ? "text-right"
                              : "text-left"
                        }`}
                      >
                        {col.render(item)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPagination && (
        <Pagination
          currentPage={currentP}
          totalPages={totalP}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
