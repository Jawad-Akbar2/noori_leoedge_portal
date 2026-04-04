import React, { useRef, useState, useEffect } from 'react';
import { Upload, X, AlertCircle, Download, Loader2, CheckCircle2, FileSpreadsheet, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadCSVFile } from '../../services/csvService.js';
import { useEscape } from "../../context/EscapeStack";
import { downloadCSVTemplate } from '../../utils/csvHelpers.js';

// ─── Modern CSV Import Modal ──────────────────────────────────────────────────
export default function CSVImportModal({ onClose, onSuccess }) {
  useEscape(onClose);

  const fileInputRef = useRef(null);
  const logEndRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingLog, setProcessingLog] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Auto-scroll to bottom of log
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [processingLog]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please select a CSV file with .csv extension');
        setSelectedFile(null);
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast.error('File size exceeds 5MB limit');
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setProcessingLog([]);
      setImportSummary(null);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please drop a CSV file with .csv extension');
        return;
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('File size exceeds 5MB limit');
        return;
      }
      setSelectedFile(file);
      setProcessingLog([]);
      setImportSummary(null);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadCSVTemplate();
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setLoading(true);
    const initialLog = [
      { type: 'INFO', message: `📁 Starting CSV import for: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)` },
      { type: 'INFO', message: '⏳ Uploading file to server...' }
    ];
    setProcessingLog(initialLog);
    setImportSummary(null);

    const result = await uploadCSVFile(selectedFile);

    if (result.success) {
      const logs = result.data?.processingLog || result.processingLog || [];
      setProcessingLog(logs);
      setImportSummary(result.data?.summary);

      toast.success('CSV imported successfully!');

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
    } else {
      const errorLogs = result.processingLog || [{ type: 'ERROR', message: result.error || 'Import failed - Unknown error' }];
      setProcessingLog(errorLogs);
      toast.error(result.error || 'CSV import failed');
    }

    setLoading(false);
  };

  const getLogStyles = (type) => {
    switch (type) {
      case 'ERROR': return 'bg-red-50 border-red-200 text-red-700';
      case 'WARN': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'SUCCESS': return 'bg-green-50 border-green-200 text-green-700';
      case 'INFO': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'SUMMARY': return 'bg-purple-50 border-purple-200 text-purple-700 font-semibold';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100">
              <FileSpreadsheet size={16} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Import CSV Attendance</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Format Instructions */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 p-4">
            <p className="text-sm font-semibold text-blue-800 flex items-center gap-2 mb-3">
              <AlertCircle size={14} /> CSV Format Required
            </p>

            <div className="bg-white rounded-lg p-3 mb-3 overflow-x-auto border border-gray-200">
              <code className="text-xs font-mono text-gray-600 whitespace-nowrap">
                empid | firstname | lastname | date(dd/mm/yyyy) | time(HH:mm) | status(0=in,1=out)
              </code>
            </div>

            <div className="space-y-1.5 text-xs text-gray-600">
              <p>✓ Each row = one attendance event (check-in or check-out)</p>
              <p>✓ Multiple rows for same employee-date = merged into single record</p>
              <p>✓ Time formats accepted: 09:00, 9:00, 9:5, 900, 0900, etc.</p>
              <p>✓ Date must be in dd/mm/yyyy format (e.g., 23/02/2026)</p>
              <p>✓ Status: 0 = check-in, 1 = check-out</p>
            </div>

            <button
              onClick={handleDownloadTemplate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 mt-3 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-lg hover:bg-blue-200 transition disabled:opacity-50"
            >
              <Download size={12} />
              Download CSV Template
            </button>
          </div>

          {/* File Upload Area */}
          <div
            onClick={() => !loading && fileInputRef.current?.click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
              ${dragActive ? 'border-blue-500 bg-blue-50' : ''}
              ${selectedFile
                ? 'border-green-500 bg-green-50'
                : loading
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <Upload size={40} className={`mx-auto mb-3 ${selectedFile ? 'text-green-500' : 'text-gray-400'}`} />
            <p className="text-gray-700 font-semibold mb-1">
              {loading ? 'Processing file...' : 'Click or drag CSV file here'}
            </p>
            <p className="text-sm text-gray-500 mb-3">Supports .csv files up to 5MB</p>

            {selectedFile && (
              <div className="inline-flex items-center gap-2 text-sm text-green-700 bg-green-100 px-3 py-2 rounded-lg">
                <CheckCircle2 size={14} />
                <span>{selectedFile.name}</span>
                <span className="text-xs text-green-600">({(selectedFile.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />
          </div>

          {/* Processing Log */}
          {processingLog.length > 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 max-h-64 overflow-y-auto">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Clock size={14} /> Processing Log
              </p>
              <div className="space-y-2 font-mono text-xs">
                {processingLog.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border ${getLogStyles(log.type)}`}
                  >
                    {log.message}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Import Summary */}
          {importSummary && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-4">
              <p className="text-sm font-semibold text-purple-800 mb-3">📊 Import Summary</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 text-center border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500">Total Rows</p>
                  <p className="text-xl font-bold text-gray-800">{importSummary.total}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500">Success</p>
                  <p className="text-xl font-bold text-green-600">{importSummary.success}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500">Errors</p>
                  <p className="text-xl font-bold text-red-600">{importSummary.failed}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500">Skipped</p>
                  <p className="text-xl font-bold text-yellow-600">{importSummary.skipped}</p>
                </div>
              </div>
              {(importSummary.recordsCreated > 0 || importSummary.recordsUpdated > 0) && (
                <div className="mt-3 pt-3 border-t border-purple-200 flex gap-4 text-xs text-purple-700">
                  {importSummary.recordsCreated > 0 && (
                    <span className="flex items-center gap-1">📝 New: {importSummary.recordsCreated}</span>
                  )}
                  {importSummary.recordsUpdated > 0 && (
                    <span className="flex items-center gap-1">✏️ Updated: {importSummary.recordsUpdated}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition shadow-md disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={15} />
                Import CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
