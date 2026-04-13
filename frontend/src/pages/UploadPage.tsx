import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { extractFromImage } from "../api";

export default function UploadPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setError("Only JPG/PNG files are accepted");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File exceeds 10MB limit");
        return;
      }
      setLoading(true);
      setError("");
      setFileName(file.name);
      setProgress(0);

      // Simulate progress
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 25, 90));
      }, 400);

      try {
        const result = await extractFromImage(file);
        clearInterval(interval);
        setProgress(100);
        navigate("/review", { state: { extraction: result, imageUrl: URL.createObjectURL(file) } });
      } catch (e: unknown) {
        clearInterval(interval);
        setError(e instanceof Error ? e.message : "Extraction failed");
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxFiles: 1,
    disabled: loading,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
          Intelligent Document Processing
        </h1>
        <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
          Upload receipts or invoices to extract structured data instantly using enterprise-grade AI models.
        </p>
      </div>

      <div className="space-y-6">
        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`bg-white border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-slate-300 hover:border-primary/50"
          } ${loading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-primary text-3xl">cloud_upload</span>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {isDragActive ? "Drop your file here" : "Drag & drop your files"}
            </h3>
            <p className="text-slate-500">Support for JPG and PNG (Max 10MB)</p>
          </div>
          <div className="mt-8">
            <button
              type="button"
              className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-lg font-semibold shadow-lg shadow-primary/20 transition-all"
            >
              Select File
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex items-center gap-6">
            <div className="relative w-12 h-12 shrink-0">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-primary">Extracting...</h4>
              <p className="text-sm text-slate-500">
                Our AI engine is processing <span className="font-medium text-slate-700">{fileName}</span>. This usually takes 2-5 seconds.
              </p>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-mono text-primary font-bold">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4">
            <span className="material-symbols-outlined text-red-500">error</span>
            <div>
              <p className="text-sm font-medium">{error}</p>
              <p className="text-xs text-red-500 mt-0.5">Please try again with a different file.</p>
            </div>
          </div>
        )}
      </div>

      {/* Feature Footer */}
      <footer className="mt-20 pt-8 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary/60 text-2xl">security</span>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Secure Processing</h4>
              <p className="mt-1 text-sm text-slate-500">Your data is encrypted and processed securely on AWS.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary/60 text-2xl">bolt</span>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Fast Extraction</h4>
              <p className="mt-1 text-sm text-slate-500">Average processing time under 5 seconds using Claude AI vision.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary/60 text-2xl">auto_awesome</span>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">AI Categorization</h4>
              <p className="mt-1 text-sm text-slate-500">Smart category suggestions powered by Claude with high accuracy.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
