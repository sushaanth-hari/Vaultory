import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  Check, 
  AlertCircle, 
  Camera, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw,
  Info
} from 'lucide-react';

const CATEGORIES = ['Electronics', 'Computing', 'Appliances', 'Vehicles', 'Accessories', 'Furniture', 'Tools', 'Other'];

export default function AddProduct() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'scan' ? 'scan' : 'manual';

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    model_number: '',
    serial_number: '',
    category: 'Electronics',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price: '',
    currency: 'USD',
    retailer: '',
    warranty_duration_months: 12,
    warranty_type: 'Manufacturer',
    notes: '',
    warranty_notes: ''
  });

  // Attached Files
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [rawOcrText, setRawOcrText] = useState('');
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [conditionPhotoFile, setConditionPhotoFile] = useState(null);
  const [conditionPhotoPreview, setConditionPhotoPreview] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleReceiptScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setReceiptFile(file);
    setScanning(true);
    setError('');
    setSuccess('');

    const uploadPayload = new FormData();
    uploadPayload.append('file', file);

    try {
      const res = await api.post('/ocr/scan-receipt', uploadPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = res.data;
      setReceiptUrl(data.receipt_url || '');
      setRawOcrText(data.raw_extracted_text || '');

      // Populate form fields with exact extracted data - strictly without hallucinated values
      setFormData((prev) => ({
        ...prev,
        name: data.name !== undefined && data.name !== null ? data.name : prev.name,
        brand: data.brand !== undefined && data.brand !== null ? data.brand : prev.brand,
        model_number: data.model_number !== undefined && data.model_number !== null ? data.model_number : prev.model_number,
        serial_number: data.serial_number !== undefined && data.serial_number !== null ? data.serial_number : prev.serial_number,
        purchase_date: data.purchase_date !== undefined && data.purchase_date !== null ? data.purchase_date : prev.purchase_date,
        purchase_price: data.purchase_price !== undefined && data.purchase_price !== null ? data.purchase_price : prev.purchase_price,
        currency: data.currency || prev.currency,
        retailer: data.retailer !== undefined && data.retailer !== null ? data.retailer : prev.retailer,
        warranty_duration_months: data.warranty_duration_months !== undefined && data.warranty_duration_months !== null ? data.warranty_duration_months : prev.warranty_duration_months,
      }));

      setSuccess('Valid bill verified! Exact content extracted without fabrication. Review the fields below before saving.');
    } catch (err) {
      console.error('Scan error:', err);
      // Clean state upon rejection so invalid bill cannot be saved
      setReceiptFile(null);
      setReceiptUrl('');
      setRawOcrText('');
      setError(err.response?.data?.detail || 'Invalid bill: The uploaded document was rejected. Please upload a clear photo or document of a valid purchase receipt.');
    } finally {
      setScanning(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleConditionPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setConditionPhotoFile(file);
      setConditionPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Product name is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 1. Create Product & Warranty
      const payload = {
        ...formData,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : 0.0,
        warranty_duration_months: parseInt(formData.warranty_duration_months, 10) || 12,
      };

      const res = await api.post('/products', payload);
      const createdProduct = res.data;

      // 2. If a receipt file was uploaded manually (or from scan) and not already linked
      if (receiptFile && !createdProduct.receipt_url) {
        const rFormData = new FormData();
        rFormData.append('file', receiptFile);
        await api.post(`/products/${createdProduct.id}/receipt`, rFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // 3. If an original condition photograph was selected, upload it
      if (conditionPhotoFile) {
        const pFormData = new FormData();
        pFormData.append('file', conditionPhotoFile);
        pFormData.append('photo_type', 'original');
        pFormData.append('caption', 'Baseline photographic evidence registered at purchase.');
        await api.post(`/condition-photos/products/${createdProduct.id}`, pFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      navigate(`/products/${createdProduct.id}`);
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.response?.data?.detail || 'Failed to register product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Register Product Ownership</h1>
        <p className="text-xs text-slate-500 mt-1">
          Scan a purchase receipt using Tesseract OCR & OpenAI, or enter product and warranty details manually.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('scan')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'scan'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>AI Receipt Scanner (OCR + OpenAI)</span>
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'manual'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-slate-500" />
          <span>Manual Entry Form</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tab 1: OCR Scanner Dropzone */}
      {activeTab === 'scan' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 transition bg-slate-50/50">
            <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-slate-800">Upload Purchase Receipt</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
              Supports JPEG, PNG, or PDF receipts. Exact text is extracted and verified; invalid or non-bill documents are automatically rejected.
            </p>
            <label className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Select Receipt File</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleReceiptScan}
                className="hidden"
                disabled={scanning}
              />
            </label>
          </div>

          {scanning && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center space-x-3">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-blue-900">Extracting Receipt Metadata...</p>
                <p className="text-[11px] text-blue-700">Running Tesseract OCR text extraction and OpenAI product structuring.</p>
              </div>
            </div>
          )}

          {/* Raw OCR Text Expandable */}
          {rawOcrText && (
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowRawOcr(!showRawOcr)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-700"
              >
                <span>View Raw Extracted OCR Text</span>
                <span className="text-[11px] text-blue-600">{showRawOcr ? 'Hide' : 'Show'}</span>
              </button>
              {showRawOcr && (
                <pre className="mt-2 p-3 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                  {rawOcrText}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Registration Form (used for both review after scan and manual entry) */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span>Product Specifications & Details</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand / Manufacturer</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                placeholder="e.g. Sony, Apple, Samsung"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Model Number</label>
              <input
                type="text"
                name="model_number"
                value={formData.model_number}
                onChange={handleInputChange}
                placeholder="e.g. WH1000XM5/B"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number</label>
              <input
                type="text"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleInputChange}
                placeholder="e.g. S01-94827103"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Purchase Info */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Purchase & Warranty Terms</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date</label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-xs">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  name="purchase_price"
                  value={formData.purchase_price}
                  onChange={handleInputChange}
                  placeholder="399.99"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-r-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store / Retailer</label>
              <input
                type="text"
                name="retailer"
                value={formData.retailer}
                onChange={handleInputChange}
                placeholder="e.g. Best Buy, Amazon, Apple"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Duration (Months)</label>
              <input
                type="number"
                name="warranty_duration_months"
                value={formData.warranty_duration_months}
                onChange={handleInputChange}
                placeholder="12"
                min="0"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Type</label>
              <select
                name="warranty_type"
                value={formData.warranty_type}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              >
                <option value="Manufacturer">Manufacturer Limited</option>
                <option value="Extended">Extended Warranty</option>
                <option value="Store">Store / Retailer Protection</option>
                <option value="Lifetime">Lifetime Warranty</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Attachment</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files[0])}
                className="w-full px-2 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-xl bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Condition Photograph Section */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <Camera className="w-4 h-4 text-purple-600" />
            <span>Original Condition Photographic Evidence</span>
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            {conditionPhotoPreview ? (
              <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-white flex-shrink-0">
                <img src={conditionPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white flex-shrink-0">
                <Camera className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-800">Capture Day 1 Baseline Photograph</label>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
                This image establishes your baseline for future OpenCV computer vision wear & tear comparisons.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleConditionPhotoChange}
                className="text-xs text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-2 disabled:opacity-50"
          >
            <span>{submitting ? 'Registering...' : 'Save Product Record'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

