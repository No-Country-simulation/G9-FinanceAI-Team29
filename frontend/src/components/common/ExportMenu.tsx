import { useState, useRef } from "react";
import type React from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { DownloadIcon } from "../../icons";
import { exportToCsv } from "../../utils/export/exportCsv";
import { exportToXlsx } from "../../utils/export/exportXlsx";
import { exportToPdf } from "../../utils/export/exportPdf";
import { captureNodeAsImage } from "../../utils/export/captureChart";
import { fetchLogoBase64 } from "../../utils/export/theme";
import { mostrarError } from "../../utils/alerts";
import type { CellValue, ExportColumn, ExportKpi, RowColorFn } from "../../utils/export/types";

interface ExportMenuProps {
  filename: string;
  title: string;
  /** Contexto del reporte: filtros aplicados, período, etc. */
  subtitle?: string;
  kpis: ExportKpi[];
  columns: ExportColumn[];
  /** Valores crudos: números reales en columnas numéricas. */
  rows: CellValue[][];
  /** Agrega fila TOTAL. Solo para tablas homogéneas (no mezcla ingresos/gastos). */
  showTotals?: boolean;
  rowColorFn?: RowColorFn;
  chartRef?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  /** Si se provee, agrega la opción "Exportar Dashboard" que genera el Excel con gráficos nativos. */
  onExportDashboard?: () => Promise<void> | void;
}

let cachedLogo: string | undefined;

export default function ExportMenu({
  filename,
  title,
  subtitle,
  kpis,
  columns,
  rows,
  showTotals,
  rowColorFn,
  chartRef,
  disabled = false,
  onExportDashboard,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleExportDashboard = async () => {
    if (!onExportDashboard) return;
    setIsOpen(false);
    setExporting(true);
    try {
      await onExportDashboard();
    } catch (err) {
      console.error(err);
      mostrarError("No se pudo generar el dashboard", "Intenta nuevamente en unos segundos.");
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setIsOpen(false);
    setExporting(true);
    try {
      if (cachedLogo === undefined) {
        cachedLogo = await fetchLogoBase64();
      }
      const chartImageBase64 = chartRef?.current && format !== "csv"
        ? await captureNodeAsImage(chartRef.current)
        : undefined;

      const payload = {
        filename,
        title,
        subtitle,
        kpis,
        columns,
        rows,
        showTotals,
        rowColorFn,
        logoBase64: cachedLogo,
        chartImageBase64,
      };

      if (format === "csv") exportToCsv(payload);
      else if (format === "xlsx") await exportToXlsx(payload);
      else await exportToPdf(payload);
    } catch (err) {
      console.error(err);
      mostrarError("No se pudo generar el archivo", "Intenta nuevamente en unos segundos.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled || exporting}
        className="dropdown-toggle flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
      >
        <DownloadIcon className="h-4 w-4" />
        {exporting ? "Generando..." : "Exportar"}
      </button>

      <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="w-44 p-1.5">
        <DropdownItem onClick={() => handleExport("csv")} className="rounded-lg dark:text-gray-300 dark:hover:bg-white/5">
          Exportar CSV
        </DropdownItem>
        <DropdownItem onClick={() => handleExport("xlsx")} className="rounded-lg dark:text-gray-300 dark:hover:bg-white/5">
          Exportar Excel
        </DropdownItem>
        <DropdownItem onClick={() => handleExport("pdf")} className="rounded-lg dark:text-gray-300 dark:hover:bg-white/5">
          Exportar PDF
        </DropdownItem>
        {onExportDashboard && (
          <DropdownItem onClick={handleExportDashboard} className="rounded-lg dark:text-gray-300 dark:hover:bg-white/5">
            Exportar Dashboard
          </DropdownItem>
        )}
      </Dropdown>
    </div>
  );
}
