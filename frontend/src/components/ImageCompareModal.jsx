import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, AlertTriangle, Layers, Eye, RefreshCw } from 'lucide-react';
import api from '../api/client';

export default function ImageCompareModal({ isOpen, onClose, originalPhoto, currentPhoto, onComparisonComplete }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('heatmap'); // 'heatmap', 'sideBySide'

  if (!isOpen) return null;

  const runComparison = async () => {
    if (!originalPhoto || !currentPhoto) {
      setError('Both original and current photographs are required to execute OpenCV visual comparison.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/condition-photos/compare', {
        original_photo_id: originalPhoto.id,
        current_photo_id: currentPhoto.id
      });
      setResult(res.data);
      if (onComparisonComplete) onComparisonComplete(res.data);
    } catch (err) {
      console.error('OpenCV comparison failed:', err);
      setError(err.response?.data?.detail || 'Failed to execute OpenCV image comparison.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">OpenCV Visual Condition Analysis</h3>
              <p className="text-xs text-slate-500">Computer vision structural difference & degradation evaluation</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Photo Source Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">Baseline Photo (Original)</span>
                <span className="text-[10px] text-slate-500">{originalPhoto?.caption || 'Baseline'}</span>
              </div>
              <div className="aspect-video bg-slate-200 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                {originalPhoto?.photo_url ? (
                  <img src={originalPhoto.photo_url} alt="Original" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">No original photo selected</span>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">Recent Verification (Current)</span>
                <span className="text-[10px] text-slate-500">{currentPhoto?.caption || 'Current'}</span>
              </div>
              <div className="aspect-video bg-slate-200 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                {currentPhoto?.photo_url ? (
                  <img src={currentPhoto.photo_url} alt="Current" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">No current photo selected</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Trigger if not yet compared */}
          {!result && (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
              <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">Ready to compute visual condition comparison</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                OpenCV will perform feature extraction, grayscale gaussian difference evaluation, and generate a structural variance heatmap.
              </p>
              <button
                onClick={runComparison}
                disabled={loading}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium shadow-sm transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing OpenCV Diff...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Execute OpenCV Analysis</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-5 animate-fade-in">
              {/* Score Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/80">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Similarity Score</p>
                  <p className="text-3xl font-extrabold text-blue-600 mt-1">{result.similarity_score}%</p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${result.similarity_score >= 80 ? 'bg-emerald-500' : (result.similarity_score >= 60 ? 'bg-amber-500' : 'bg-rose-500')}`}
                      style={{ width: `${result.similarity_score}%` }}
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/80">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Visual Difference</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-1">{result.structural_difference_percentage}%</p>
                  <p className="text-xs text-slate-500 mt-1">{result.keypoints_matched} ORB feature points matched</p>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/80">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Condition Verdict</p>
                  <div className="mt-1 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="text-base font-bold text-slate-900">{result.verdict}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Verified via OpenCV Jet Colormap Analysis</p>
                </div>
              </div>

              {/* Heatmap Composite Preview */}
              {result.diff_heatmap_url && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 p-2 shadow-inner">
                  <div className="flex items-center justify-between px-3 py-1.5 mb-2 text-white">
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-medium">Composite Computer Vision Differential Map</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Panel 1: Original | Panel 2: Contoured | Panel 3: Jet Heatmap</span>
                  </div>
                  <img 
                    src={result.diff_heatmap_url} 
                    alt="OpenCV Differential Heatmap" 
                    className="w-full rounded-lg border border-slate-800 shadow"
                  />
                </div>
              )}

              {/* Wear Analysis Breakdown */}
              {result.wear_analysis && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Automated Wear Analysis Observations</h4>
                  <ul className="space-y-1.5">
                    {result.wear_analysis.map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-600 flex items-start space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Vaultory OpenCV Visual Proof Engine</p>
          <div className="flex items-center space-x-2">
            {result && (
              <button
                onClick={runComparison}
                disabled={loading}
                className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition"
              >
                Re-analyze
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

