import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { BarChart3 } from "lucide-react";

export interface BiwReviewTableBarChartProps {
  biwReviewTableData: any[];
  darkMode: boolean;
}

export const BiwReviewTableBarChart: React.FC<BiwReviewTableBarChartProps> = ({
  biwReviewTableData,
  darkMode,
}) => {
    if (biwReviewTableData.length === 0) return null;

    // Filter out inspectors who have ALL zeros
    const filteredData = biwReviewTableData.filter((row) => {
      const accepted = row.accepted || 0;
      const rejected = row.rejected || 0;
      const rework = row.rework || 0;
      return accepted > 0 || rejected > 0 || rework > 0;
    });

    if (filteredData.length === 0) return null;

    // Get the top 10 sorted by Performance Score (with totalReviewed/totalSubmitted as tiebreaker)
    const sortedData = [...filteredData]
      .sort((a, b) => {
        const scoreDiff = (b.performanceScore || 0) - (a.performanceScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.totalReviewed || b.totalSubmitted || 0) - (a.totalReviewed || a.totalSubmitted || 0);
      })
      .slice(0, 10);

    const data = {
      labels: sortedData.map(row => {
        const baseName = row.name?.length > 14 ? row.name.substring(0, 14) + "..." : (row.name || "Unknown");
        return `${baseName} (${row.performanceScore || 0}%)`;
      }),
      datasets: [
        {
          label: "Accepted",
          data: sortedData.map(row => row.accepted || 0),
          backgroundColor: "rgba(34, 197, 94, 0.7)", // Green
          borderColor: "rgb(21, 128, 61)",
          borderWidth: 1,
          stack: "stack1",
          minBarLength: 0,
        },
        {
          label: "Rejected",
          data: sortedData.map(row => row.rejected || 0),
          backgroundColor: "rgba(239, 68, 68, 0.7)", // Red
          borderColor: "rgb(185, 28, 28)",
          borderWidth: 1,
          stack: "stack1",
          minBarLength: 0,
        },
        {
          label: "Reworked",
          data: sortedData.map(row => row.rework || 0),
          backgroundColor: "rgba(234, 179, 8, 0.7)", // Yellow
          borderColor: "rgb(161, 98, 7)",
          borderWidth: 1,
          stack: "stack1",
          minBarLength: 0,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 10, weight: "bold" as const },
            padding: 10,
            usePointStyle: true,
          },
        },
        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          callbacks: {
            title: (items: any) => {
              if (!items?.length) return "";
              const idx = items[0].dataIndex;
              const row = sortedData[idx];
              const perf = getBiwPerformanceLabel(row.performanceScore || 0);
              return `${row.name || "Unknown"} • Score: ${row.performanceScore || 0}% (${perf.label})`;
            },
            label: (context: any) => {
              const datasetLabel = context.dataset.label;
              const value = context.raw;
              return `${datasetLabel}: ${value}`;
            },
          },
        },
        datalabels: {
          display: (context: any) => (context.dataset.data[context.dataIndex] || 0) > 0,
          color: (context: any) => {
            if (context.datasetIndex === 0) return "#064e3b"; // High-contrast dark green
            if (context.datasetIndex === 1) return "#7f1d1d"; // High-contrast dark red
            return "#78350f"; // High-contrast dark amber
          },
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          borderRadius: 4,
          padding: { top: 2, bottom: 2, left: 5, right: 5 },
          anchor: "center" as const,
          align: "center" as const,
          textAlign: "center" as const,
          font: { weight: "bold" as const, size: 11 },
          formatter: (value: number) => {
            if (!value || value <= 0) return "";
            return String(value);
          },
        },
      },
      scales: {
        y: {
          stacked: true,
          beginAtZero: true,
          grace: '18%',
          ticks: {
            stepSize: 1,
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            color: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
          },
        },
        x: {
          stacked: true,
          ticks: {
            color: darkMode ? "#9ca3af" : "#6b7280",
            font: { size: 9 },
            maxRotation: 45,
            minRotation: 0,
          },
          grid: {
            display: false,
          },
        },
      },
    };

    const biwTopBarPlugins = useMemo(() => ([
      {
        id: 'biwTopBarLabels',
        afterDatasetsDraw(chart: any) {
          const { ctx, scales: { y } } = chart;
          ctx.save();
          chart.data.labels?.forEach((_: any, index: number) => {
            let totalValue = 0;
            chart.data.datasets.forEach((ds: any) => {
              totalValue += (ds.data[index] || 0);
            });
            if (totalValue <= 0) return;

            const row = sortedData[index];
            if (!row) return;
            const perf = getBiwPerformanceLabel(row.performanceScore || 0);
            const text = perf.label;

            const meta = chart.getDatasetMeta(0);
            const barElement = meta?.data?.[index];
            if (!barElement) return;

            const xPos = barElement.x;
            const yPos = y.getPixelForValue(totalValue);

            ctx.font = 'bold 9.5px Inter, system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const metrics = ctx.measureText(text);
            const pillWidth = Math.max(metrics.width + 12, 40);
            const pillHeight = 18;
            const pillX = xPos - pillWidth / 2;
            const pillY = yPos - pillHeight - 5;

            const score = row.performanceScore || 0;
            const isGreen = score >= 90;
            const isBlue = score >= 80 && score < 90;
            const isYellow = score >= 70 && score < 80;

            ctx.fillStyle = isGreen ? '#ecfdf5' : isBlue ? '#eff6ff' : isYellow ? '#fefce8' : '#fef2f2';
            ctx.strokeStyle = isGreen ? '#10b981' : isBlue ? '#3b82f6' : isYellow ? '#eab308' : '#ef4444';
            ctx.lineWidth = 1.2;

            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
            } else {
              ctx.rect(pillX, pillY, pillWidth, pillHeight);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isGreen ? '#065f46' : isBlue ? '#1e40af' : isYellow ? '#854d0e' : '#991b1b';
            ctx.fillText(text, xPos, pillY + pillHeight / 2);
          });
          ctx.restore();
        }
      }
    ]), [sortedData]);

    return (
      <div
        id="biw-review-table-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-800 rounded-lg mr-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                BIW Review Table - Inspector Metrics
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Top inspectors by BIW performance score
              </p>
            </div>
          </div>
        </div>


        <div style={{ height: "400px", position: "relative" }}>
          <Bar data={data} options={options} plugins={biwTopBarPlugins} />
        </div>
      </div>
    );
};

export default BiwReviewTableBarChart;
