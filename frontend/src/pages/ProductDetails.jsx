import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ImageCompareModal from '../components/ImageCompareModal';
import { 
  Package, 
  ShieldCheck, 
  Calendar, 
  DollarSign, 
  Store, 
  FileText, 
  Camera, 
  Wrench, 
  Download, 
  GitCommit, 
  Sparkles, 
  Plus, 
  Trash2, 
  ChevronRight,
  Upload,
  ArrowLeft,
  AlertTriangle,
  Layers
} from 'lucide-react';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals & Uploads
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);

  // New Photo Form
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [newPhotoType, setNewPhotoType] = useState('current');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // New Repair Form
  const [repairData, setRepairData] = useState({
    service_center: '',
    repair_date: new Date().toISOString().split('T')[0],
    description: '',
    cost: '',
    currency: 'USD',
    warranty_covered: false,
    status: 'Completed'
  });
  const [repairDocFile, setRepairDocFile] = useState(null);
  const [savingRepair, setSavingRepair] = useState(false);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/products/${id}`);
      setProduct(res.data);
    } catch (err) {
      console.error(err);
      setError('Could not load product details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    if (!newPhotoFile) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', newPhotoFile);
      formData.append('photo_type', newPhotoType);
      formData.append('caption', newPhotoCaption || `${newPhotoType} condition inspection`);

      await api.post(`/condition-photos/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowPhotoUploadModal(false);
      setNewPhotoFile(null);
      setNewPhotoCaption('');
      fetchProduct();
    } catch (err) {
      console.error('Failed to upload condition photo:', err);
      alert('Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveRepair = async (e) => {
    e.preventDefault();
    if (!repairData.service_center || !repairData.description) {
      alert('Please fill in service center and description.');
      return;
    }

    setSavingRepair(true);
    try {
      const formData = new FormData();
      formData.append('service_center', repairData.service_center);
      formData.append('repair_date', repairData.repair_date);
      formData.append('description', repairData.description);
      formData.append('cost', repairData.cost ? parseFloat(repairData.cost) : 0.0);
      formData.append('currency', repairData.currency);
      formData.append('warranty_covered', repairData.warranty_covered);
      formData.append('status', repairData.status);
      if (repairDocFile) {
        formData.append('document', repairDocFile);
      }

      await api.post(`/repairs/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowRepairModal(false);
      setRepairData({
        service_center: '',
        repair_date: new Date().toISOString().split('T')[0],
        description: '',
        cost: '',
        currency: 'USD',
        warranty_covered: false,
        status: 'Completed'
      });
      setRepairDocFile(null);
      fetchProduct();
    } catch (err) {
      console.error('Failed to save repair record:', err);
      alert('Failed to save repair record.');
    } finally {
      setSavingRepair(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-500">Product not found.</p>
        <Link to="/products" className="text-xs text-blue-600 font-semibold hover:underline mt-2 inline-block">
          ← Back to My Products
        </Link>
      </div>
    );
  }

  const origPhotos = product.condition_photos?.filter(p => p.photo_type === 'original') || [];
  const currPhotos = product.condition_photos?.filter(p => p.photo_type === 'current') || [];
  const canCompare = origPhotos.length > 0 && currPhotos.length > 0;

  // Calculate warranty days
  let wStat = 'none';
  let wDays = null;
  if (product.warranty?.end_date) {
    const end = new Date(product.warranty.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    wDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    wStat = wDays < 0 ? 'expired' : (wDays <= 30 ? 'expiring_soon' : 'active');
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/products')}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-100 rounded-xl text-slate-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">
                {product.category}
              </span>
              <StatusBadge status={wStat} remainingDays={wDays} size="xs" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">{product.name}</h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Generate PDF Evidence Report */}
          <a
            href={`/api/v1/evidence/products/${product.id}/pdf`}
            download
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Generate Evidence PDF</span>
          </a>

          {/* Timeline Link */}
          <Link
            to={`/timeline?product_id=${product.id}`}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <GitCommit className="w-3.5 h-3.5 text-blue-600" />
            <span>Ownership Timeline</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Details + Warranty Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Specifications & Receipt */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
              Product Specifications
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Brand / Make</span>
                <span className="font-semibold text-slate-800 text-sm">{product.brand || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Model Number</span>
                <span className="font-semibold text-slate-800 text-sm">{product.model_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Serial Number</span>
                <span className="font-semibold text-slate-800 text-sm font-mono">{product.serial_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Purchase Date</span>
                <span className="font-semibold text-slate-800 text-sm">{product.purchase_date || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Purchase Price</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {product.currency} {product.purchase_price ? product.purchase_price.toFixed(2) : '0.00'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Store / Retailer</span>
                <span className="font-semibold text-slate-800 text-sm">{product.retailer || 'N/A'}</span>
              </div>
            </div>

            {product.notes && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 block mb-0.5">Notes</span>
                <p className="text-xs text-slate-700">{product.notes}</p>
              </div>
            )}
          </div>

          {/* Receipt Document Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Purchase Receipt Document
              </h3>
              {product.receipt_url && (
                <a
                  href={product.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  View Full File
                </a>
              )}
            </div>

            {product.receipt_url ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-2">
                {product.receipt_url.toLowerCase().endsWith('.pdf') ? (
                  <div className="p-8 text-center">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-800">{product.receipt_filename || 'receipt.pdf'}</p>
                    <a
                      href={product.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block px-3 py-1 bg-slate-900 text-white rounded-lg text-xs"
                    >
                      Open PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={product.receipt_url}
                    alt="Receipt Document"
                    className="max-h-72 object-contain rounded-lg shadow-xs"
                  />
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <FileText className="w-8 h-8 mx-auto mb-1 opacity-60" />
                <p className="text-xs">No receipt uploaded for this product.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Warranty Terms & Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Warranty Status</h3>
              </div>
              <StatusBadge status={wStat} remainingDays={wDays} size="xs" />
            </div>

            {product.warranty ? (
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Coverage Type:</span>
                  <span className="font-semibold text-slate-800">{product.warranty.warranty_type}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Duration:</span>
                  <span className="font-semibold text-slate-800">{product.warranty.duration_months} Months</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Coverage Window:</span>
                  <span className="font-semibold text-slate-800">
                    {product.warranty.start_date} to {product.warranty.end_date}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Days Remaining:</span>
                  <span className={`font-bold ${wDays < 0 ? 'text-rose-600' : (wDays <= 30 ? 'text-amber-600' : 'text-emerald-600')}`}>
                    {wDays < 0 ? `Expired (${Math.abs(wDays)}d ago)` : `${wDays} Days`}
                  </span>
                </div>
                {product.warranty.provider_contact && (
                  <div className="py-1.5 border-b border-slate-50">
                    <span className="text-slate-400 block text-[11px]">Provider Contact</span>
                    <span className="font-medium text-slate-800">{product.warranty.provider_contact}</span>
                  </div>
                )}
                {product.warranty.coverage_details && (
                  <div className="pt-2">
                    <span className="text-slate-400 block text-[11px] mb-1">Coverage Scope</span>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {product.warranty.coverage_details}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No warranty registered for this product.</p>
            )}
          </div>
        </div>
      </div>

      {/* Section: Condition Photographs & OpenCV Comparison */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <Camera className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-slate-900 text-sm">Product Condition Photographic Evidence</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Preserve visual proof of product condition. Run OpenCV computer vision comparison to evaluate physical wear & tear.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {canCompare && (
              <button
                onClick={() => setIsCompareModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Run OpenCV Comparison</span>
              </button>
            )}

            <button
              onClick={() => setShowPhotoUploadModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Condition Photo</span>
            </button>
          </div>
        </div>

        {product.condition_photos?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {product.condition_photos.map((photo) => (
              <div key={photo.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col justify-between">
                <div className="aspect-video bg-slate-200 overflow-hidden relative">
                  <img src={photo.photo_url} alt={photo.caption} className="w-full h-full object-cover" />
                  <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs ${
                    photo.photo_type === 'original' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    {photo.photo_type.toUpperCase()}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-slate-800 leading-snug">{photo.caption || 'Condition Photo'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {photo.taken_at ? new Date(photo.taken_at).toLocaleDateString() : 'Recorded'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
            <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-600 font-medium">No condition photographs uploaded yet.</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Add original and current photos to enable automated OpenCV wear analysis.</p>
            <button
              onClick={() => setShowPhotoUploadModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Upload Photo
            </button>
          </div>
        )}
      </div>

      {/* Section: Repair History */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Service & Repair History</h3>
          </div>
          <button
            onClick={() => setShowRepairModal(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Repair</span>
          </button>
        </div>

        {product.repairs?.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {product.repairs.map((rep) => (
              <div key={rep.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs font-bold text-slate-900">{rep.service_center}</h4>
                    <span className="text-[10px] text-slate-400">• {rep.repair_date}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      rep.warranty_covered 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {rep.warranty_covered ? 'Warranty Covered ($0)' : `Out-of-Pocket ($${rep.cost.toFixed(2)})`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{rep.description}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800">${rep.cost.toFixed(2)}</span>
                  {rep.document_url && (
                    <a
                      href={rep.document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline inline-flex items-center space-x-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Invoice</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <p className="text-xs">No repairs or maintenance events logged for this product.</p>
          </div>
        )}
      </div>

      {/* Modal: OpenCV Image Comparison */}
      {isCompareModalOpen && canCompare && (
        <ImageCompareModal
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          originalPhoto={origPhotos[0]}
          currentPhoto={currPhotos[0]}
        />
      )}

      {/* Modal: Upload Condition Photo */}
      {showPhotoUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Upload Condition Photograph</h3>
            <form onSubmit={handleUploadPhoto} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Photo Classification</label>
                <select
                  value={newPhotoType}
                  onChange={(e) => setNewPhotoType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="original">Original Baseline Photograph</option>
                  <option value="current">Current / Updated Condition Photograph</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Caption / Inspection Note</label>
                <input
                  type="text"
                  value={newPhotoCaption}
                  onChange={(e) => setNewPhotoCaption(e.target.value)}
                  placeholder="e.g. 6-Month Wear & Tear Check"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Image File</label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setNewPhotoFile(e.target.files[0])}
                  className="w-full text-xs text-slate-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoUploadModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPhoto}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {uploadingPhoto ? 'Uploading...' : 'Save Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Repair */}
      {showRepairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Log Service & Repair Record</h3>
            <form onSubmit={handleSaveRepair} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Authorized Service Center</label>
                <input
                  type="text"
                  required
                  value={repairData.service_center}
                  onChange={(e) => setRepairData({ ...repairData, service_center: e.target.value })}
                  placeholder="e.g. Official Apple Genius Bar / Sony Service Depot"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Repair Date</label>
                  <input
                    type="date"
                    required
                    value={repairData.repair_date}
                    onChange={(e) => setRepairData({ ...repairData, repair_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={repairData.cost}
                    onChange={(e) => setRepairData({ ...repairData, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Description</label>
                <textarea
                  required
                  rows={2}
                  value={repairData.description}
                  onChange={(e) => setRepairData({ ...repairData, description: e.target.value })}
                  placeholder="Describe parts replaced, adjustments, or diagnostic results..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="w_covered"
                  checked={repairData.warranty_covered}
                  onChange={(e) => setRepairData({ ...repairData, warranty_covered: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="w_covered" className="text-xs text-slate-700 font-medium">
                  Fully covered under warranty ($0 liability)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Repair Bill / Invoice Document</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setRepairDocFile(e.target.files[0])}
                  className="w-full text-xs text-slate-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRepairModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRepair}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {savingRepair ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

