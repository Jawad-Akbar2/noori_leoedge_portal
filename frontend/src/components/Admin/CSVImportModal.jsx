import React, { useRef, useState, useEffect } from 'react';
import { Upload, X, AlertCircle, Download, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadCSVFile } from '../../services/csvService.js';
import { useEscape } from "../../context/EscapeStack";
import { downloadCSVTemplate } from '../../utils/csvHelpers.js';

export default function CSVImportModal({ onClose, onSuccess }) {
   useEscape(onClose);
   
  const fileInputRef = useRef(null);
  const logEndRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingLog, setProcessingLog] = useState([]);
  const [importSummary, setImportSummary] = useState(null);

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
      
      // Check file size
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
      {
        type: 'INFO',
        message: `📁 Starting CSV import for: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`
      },
      {
        type: 'INFO',
        message: '⏳ Uploading file to server...'
      }
    ];
    setProcessingLog(initialLog);
    setImportSummary(null);

    const result = await uploadCSVFile(selectedFile);

    if (result.success) {
      const logs = result.data?.processingLog || result.processingLog || [];
      setProcessingLog(logs);
      setImportSummary(result.data?.summary);
      
      toast.success('CSV imported successfully!');
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
    } else {
      const errorLogs = result.processingLog || [
        {
          type: 'ERROR',
          message: result.error || 'Import failed - Unknown error'
        }
      ];
      setProcessingLog(errorLogs);
      toast.error(result.error || 'CSV import failed');
    }

    setLoading(false);
  };

  const getLogBgColor = (type) => {
    switch (type) {
      case 'ERROR':
        return 'bg-red-100';
      case 'WARN':
        return 'bg-yellow-100';
      case 'SUCCESS':
        return 'bg-green-100';
      case 'INFO':
        return 'bg-blue-100';
      case 'SUMMARY':
        return 'bg-purple-100';
      default:
        return 'bg-gray-100';
    }
  };

  const getLogTextColor = (type) => {
    switch (type) {
      case 'ERROR':
        return 'text-red-800';
      case 'WARN':
        return 'text-yellow-800';
      case 'SUCCESS':
        return 'text-green-800';
      case 'INFO':
        return 'text-blue-800';
      case 'SUMMARY':
        return 'text-purple-800 font-bold';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 md:p-6 flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Import CSV Attendance</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Format Instructions */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm font-bold text-blue-900 mb-3">📋 CSV Format Required:</p>
            
            <div className="bg-white p-3 rounded mb-3 overflow-x-auto">
              <code className="text-xs whitespace-nowrap">
                empid | firstname | lastname | date(dd/mm/yyyy) | time(HH:mm) | status(0=in,1=out)
              </code>
            </div>

            <div className="space-y-2 text-xs text-blue-800">
              <p>✓ Each row = one attendance event (check-in or check-out)</p>
              <p>✓ Multiple rows for same employee-date = merged into single record</p>
              <p>✓ Time formats accepted: 09:00, 9:00, 9:5, 900, 0900, etc.</p>
              <p>✓ Date must be in dd/mm/yyyy format (e.g., 23/02/2026)</p>
              <p>✓ Status: 0 = check-in, 1 = check-out</p>
            </div>

            <button
              onClick={handleDownloadTemplate}
              disabled={loading}
              className="text-xs text-blue-600 hover:text-blue-800 mt-3 flex items-center gap-1 font-medium disabled:opacity-50"
            >
              <Download size={14} />
              Download CSV Template
            </button>
          </div>

          {/* File Upload Area */}
          <div
            onClick={() => !loading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
              selectedFile
                ? 'border-green-500 bg-green-50'
                : loading
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-60'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload size={40} className="mx-auto mb-3 text-gray-400" />
            <p className="text-gray-700 font-semibold mb-1">
              {loading ? 'Processing file...' : 'Click to select CSV file'}
            </p>
            <p className="text-sm text-gray-500 mb-3">or drag and drop CSV file here</p>
            
            {selectedFile && (
              <div className="text-sm text-green-700 bg-green-100 px-3 py-2 rounded inline-block">
                ✓ Selected: {selectedFile.name}
                <br />
                <span className="text-xs">Size: {(selectedFile.size / 1024).toFixed(2)} KB</span>
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
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-80 overflow-y-auto">
              <p className="text-sm font-bold text-gray-800 mb-3">📊 Processing Log:</p>
              <div className="space-y-2 font-mono text-xs">
                {processingLog.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded ${getLogBgColor(log.type)} ${getLogTextColor(log.type)} whitespace-pre-wrap`}
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
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-300 rounded-lg p-4">
              <p className="text-sm font-bold text-purple-900 mb-3">📈 Import Summary:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded text-center">
                  <p className="text-xs text-gray-600">Total Rows</p>
                  <p className="text-2xl font-bold text-purple-600">{importSummary.total}</p>
                </div>
                <div className="bg-white p-3 rounded text-center">
                  <p className="text-xs text-gray-600">Success</p>
                  <p className="text-2xl font-bold text-green-600">{importSummary.success}</p>
                </div>
                <div className="bg-white p-3 rounded text-center">
                  <p className="text-xs text-gray-600">Errors</p>
                  <p className="text-2xl font-bold text-red-600">{importSummary.failed}</p>
                </div>
                <div className="bg-white p-3 rounded text-center">
                  <p className="text-xs text-gray-600">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-600">{importSummary.skipped}</p>
                </div>
              </div>
              {importSummary.recordsCreated > 0 && (
                <p className="text-xs text-purple-800 mt-3">
                  📝 New Records: {importSummary.recordsCreated}
                </p>
              )}
              {importSummary.recordsUpdated > 0 && (
                <p className="text-xs text-purple-800">
                  ✏️ Updated Records: {importSummary.recordsUpdated}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="sticky bottom-0 bg-white border-t p-4 md:p-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={18} />
                Import CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}