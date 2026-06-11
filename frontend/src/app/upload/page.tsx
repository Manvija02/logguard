'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute, useAuth } from '@/lib/auth';
import { uploadFile, getUploads, UploadRecord } from '@/lib/api';
import Navbar from '@/components/Navbar';

function UploadPageContent() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    uploadId: string;
    totalEntries: number;
    totalAnomalies: number;
    filename: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [pastUploads, setPastUploads] = useState<UploadRecord[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUploads();
    }
  }, [isAuthenticated]);

  const fetchUploads = async () => {
    try {
      const uploads = await getUploads();
      setPastUploads(uploads);
    } catch {
      // silently fail
    } finally {
      setLoadingUploads(false);
    }
  };

  const validateFile = (file: File): boolean => {
    const validExts = ['.txt', '.log'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      setError(`Invalid file type "${ext}". Only .txt and .log files are accepted.`);
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit.');
      return false;
    }
    return true;
  };

  const handleFile = (file: File) => {
    setError('');
    setUploadResult(null);
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      const result = await uploadFile(selectedFile, (percent) => {
        setUploadProgress(percent);
      });
      setUploadResult({ ...result, filename: selectedFile.name });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Refresh uploads list
      fetchUploads();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(
        axiosError.response?.data?.error || 'Upload failed. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.startsWith('completed')) {
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    }
    switch (s) {
      case 'processing':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'failed':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-cyber-darker cyber-grid-bg">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-cyber-green">Upload</span> Security Logs
          </h1>
          <p className="text-gray-500">
            Upload your log files for AI-powered anomaly detection and analysis.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="mb-8 animate-slide-up">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-12
              transition-all duration-300 group
              ${
                isDragging
                ? 'border-cyber-green bg-cyber-green/5 cyber-glow'
                : 'border-cyber-border hover:border-cyber-green/50 bg-white'
            }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.log"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-4 text-center">
              {/* Upload icon */}
              <div
                className={`
                  w-16 h-16 rounded-2xl flex items-center justify-center
                  transition-all duration-300
                  ${isDragging ? 'bg-cyber-green/20' : 'bg-slate-50 border border-cyber-border group-hover:border-cyber-green/30'}
                `}
              >
                <svg
                  className={`w-8 h-8 transition-colors duration-300 ${
                    isDragging ? 'text-cyber-green' : 'text-slate-400 group-hover:text-cyber-green'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <div>
                <p className="text-lg text-slate-700 mb-1">
                  {isDragging
                    ? 'Drop your file here'
                    : 'Drag & drop your .log or .txt file here'}
                </p>
                <p className="text-sm text-slate-500">or click to browse</p>
              </div>

              <p className="text-xs text-slate-400">
                Supported: .txt, .log • Max size: 50MB
              </p>
            </div>
          </div>
        </div>

        {/* Selected File */}
        {selectedFile && !isUploading && !uploadResult && (
          <div className="mb-8 cyber-card p-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyber-dark flex items-center justify-center border border-cyber-border">
                  <svg
                    className="w-6 h-6 text-cyber-green"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-slate-800 font-semibold">{selectedFile.name}</p>
                  <p className="text-sm text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800
                             border border-cyber-border hover:border-slate-400
                             rounded-lg transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  className="cyber-btn flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Analyze Logs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="mb-8 cyber-card p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 border-2 border-cyber-green/30 border-t-cyber-green rounded-full animate-spin" />
              <span className="text-slate-600 text-sm">
                Uploading and analyzing...
              </span>
              <span className="text-cyber-green font-mono text-sm ml-auto">
                {uploadProgress}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyber-green to-cyber-blue transition-all duration-300 relative"
                style={{ width: `${uploadProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Upload Success */}
        {uploadResult && (
          <div className="mb-8 cyber-card p-6 border-green-200 bg-green-50 animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center border border-green-200">
                <svg
                  className="w-6 h-6 text-cyber-green"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-cyber-green font-semibold">
                  Analysis Complete!
                </p>
                <p className="text-green-800 text-sm">
                  {uploadResult.filename} has been analyzed successfully.
                </p>
              </div>
              <button
                onClick={() =>
                  router.push(`/results/${uploadResult.uploadId}`)
                }
                className="cyber-btn"
              >
                View Results →
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3 animate-slide-up">
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Past Uploads */}
        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-cyber-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Recent Uploads
          </h2>

          {loadingUploads ? (
            <div className="cyber-card p-8 text-center">
              <div className="w-8 h-8 border-2 border-cyber-green/30 border-t-cyber-green rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading uploads...</p>
            </div>
          ) : pastUploads.length === 0 ? (
            <div className="cyber-card p-8 text-center">
              <p className="text-gray-500">
                No uploads yet. Upload your first log file to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastUploads.map((upload) => (
                <button
                  key={upload.id}
                  onClick={() => {
                    if (upload.status.toLowerCase().startsWith('completed')) {
                      router.push(`/results/${upload.id}`);
                    }
                  }}
                  className={`w-full cyber-card p-4 text-left transition-all duration-300 ${
                    upload.status.toLowerCase().startsWith('completed')
                      ? 'hover:border-cyber-green/30 cursor-pointer'
                      : 'cursor-default opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-cyber-dark flex items-center justify-center border border-cyber-border">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-slate-800 font-semibold text-sm">
                          {upload.filename}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {formatDate(upload.createdAt || '')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {upload.totalEntries !== undefined && (
                        <span className="text-xs text-gray-500 hidden sm:inline">
                          {upload.totalEntries} entries
                        </span>
                      )}
                      <span
                        className={`cyber-badge border ${getStatusColor(
                          upload.status
                        )}`}
                      >
                        {upload.status}
                      </span>
                      {upload.status.toLowerCase().startsWith('completed') && (
                        <svg
                          className="w-4 h-4 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <UploadPageContent />
    </ProtectedRoute>
  );
}
