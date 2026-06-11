import { useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LogEntry } from '@/lib/api';

interface ExportReportProps {
  filename: string;
  entries: LogEntry[];
  anomalies: any[];
}

export default function ExportReport({ filename, entries, anomalies }: ExportReportProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // 1. Export filtered/all log entries to CSV
  const handleExportCSV = () => {
    try {
      const csvData = entries.map((e) => ({
        Timestamp: e.timestamp || '',
        'IP Address': e.ip || '',
        Username: e.user || '',
        URL: e.url || '',
        Status: e.status || '',
        'Data Volume (Bytes)': e.bytes || 0,
        'Is Anomaly': e.isAnomaly ? 'YES' : 'NO',
        'Anomaly Reason': e.anomalyReason || '',
        'Confidence Score (%)': e.confidence !== undefined ? e.confidence : '',
        Country: e.country || '',
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const cleanName = filename.replace(/\.[^/.]+$/, '');
      const downloadName = `logguard-analysis-${cleanName}.csv`;

      if (navigator.msSaveBlob) {
        // IE 10+
        navigator.msSaveBlob(blob, downloadName);
      } else {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', downloadName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setDropdownOpen(false);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  // 2. Export dashboard layout to PDF using html2canvas & jsPDF
  const handleExportPDF = async () => {
    try {
      setDropdownOpen(false);
      setGeneratingPDF(true);

      const target = document.getElementById('dashboard-content');
      if (!target) {
        alert('Dashboard content element not found!');
        setGeneratingPDF(false);
        return;
      }

      // Add a brief delay to allow dropdown closing animations
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(target, {
        scale: 2, // Higher resolution output
        useCORS: true, // Support external image assets
        logging: false,
        backgroundColor: '#f1f5f9', // Force Slate 100 background
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add subsequent pages if the content height overflows A4 page height
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const cleanName = filename.replace(/\.[^/.]+$/, '');
      pdf.save(`logguard-report-${cleanName}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF report.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={generatingPDF}
          className="px-5 py-2.5 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-300 transform hover:scale-[1.02] flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {generatingPDF ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Report
              <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      </div>

      {dropdownOpen && (
        <>
          {/* Overlay to close dropdown on click outside */}
          <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
          <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-white border border-slate-100 ring-1 ring-black ring-opacity-5 z-40 animate-fade-in focus:outline-none overflow-hidden">
            <div className="py-1">
              <button
                onClick={handleExportPDF}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5 border-b border-slate-100/60"
              >
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Export PDF Report
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5"
              >
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV Data
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Typing extension for navigator.msSaveBlob support in legacy systems
declare global {
  interface Navigator {
    msSaveBlob?: (blob: any, defaultName?: string) => boolean;
  }
}
