import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { 
  GitCommit, 
  ShoppingBag, 
  FileText, 
  Camera, 
  ShieldCheck, 
  Wrench, 
  Clock, 
  AlertCircle,
  Download,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function OwnershipTimeline() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProductId = searchParams.get('product_id');

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(initialProductId || '');
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Fetch all user products for the dropdown
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await api.get('/products');
        setProducts(res.data);
        if (res.data.length > 0 && !selectedProductId) {
          setSelectedProductId(res.data[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Fetch timeline for the selected product
  useEffect(() => {
    if (!selectedProductId) return;

    const fetchTimeline = async () => {
      try {
        setLoadingTimeline(true);
        const res = await api.get(`/timeline/products/${selectedProductId}`);
        setTimelineEvents(res.data);
      } catch (err) {
        console.error('Failed to load timeline:', err);
      } finally {
        setLoadingTimeline(false);
      }
    };

    fetchTimeline();
  }, [selectedProductId]);

  const handleProductChange = (e) => {
    const newId = e.target.value;
    setSelectedProductId(newId);
    setSearchParams({ product_id: newId });
  };

  const selectedProduct = products.find(p => p.id.toString() === selectedProductId.toString());

  const getEventIcon = (type) => {
    switch (type) {
      case 'purchase':
        return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
      case 'receipt_upload':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'warranty_start':
        return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      case 'warranty_end':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'condition_photo':
        return <Camera className="w-4 h-4 text-purple-600" />;
      case 'repair':
        return <Wrench className="w-4 h-4 text-rose-600" />;
      default:
        return <GitCommit className="w-4 h-4 text-slate-600" />;
    }
  };

  const getIconBackground = (type) => {
    switch (type) {
      case 'purchase':
        return 'bg-emerald-50 border-emerald-200';
      case 'receipt_upload':
        return 'bg-blue-50 border-blue-200';
      case 'warranty_start':
        return 'bg-indigo-50 border-indigo-200';
      case 'warranty_end':
        return 'bg-amber-50 border-amber-200';
      case 'condition_photo':
        return 'bg-purple-50 border-purple-200';
      case 'repair':
        return 'bg-rose-50 border-rose-200';
      default:
        return 'bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header & Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ownership Timeline</h1>
          <p className="text-xs text-slate-500 mt-1">
            Chronological audit trail of purchase, digitized receipts, condition baselines, and maintenance history.
          </p>
        </div>

        {/* Product Selector Dropdown */}
        {products.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600 flex-shrink-0">Selected Asset:</span>
            <select
              value={selectedProductId}
              onChange={handleProductChange}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 min-w-[220px]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.brand || 'Item'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Selected Product Summary Banner */}
      {selectedProduct && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {selectedProduct.brand ? selectedProduct.brand.slice(0, 2).toUpperCase() : 'PR'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">{selectedProduct.name}</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  {selectedProduct.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Purchased: {selectedProduct.purchase_date || 'N/A'} • {selectedProduct.currency || 'USD'} ${selectedProduct.purchase_price ? selectedProduct.purchase_price.toFixed(2) : '0.00'} • {selectedProduct.retailer || 'Retailer'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              to={`/products/${selectedProduct.id}`}
              className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              Product Details
            </Link>
            <a
              href={`/api/v1/evidence/products/${selectedProduct.id}/pdf`}
              download
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Evidence PDF</span>
            </a>
          </div>
        </div>
      )}

      {/* Timeline Stream */}
      {loadingTimeline ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : timelineEvents.length > 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 space-y-8 my-2">
            {timelineEvents.map((event, idx) => (
              <div key={event.id || idx} className="relative group">
                {/* Node Bullet Icon */}
                <div className={`absolute -left-[35px] sm:-left-[43px] top-0 w-8 h-8 rounded-full border flex items-center justify-center bg-white shadow-xs ${getIconBackground(event.type)}`}>
                  {getEventIcon(event.type)}
                </div>

                {/* Event Card Content */}
                <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-xl p-4 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{event.title}</h4>
                      {event.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                          {event.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {event.date}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{event.description}</p>

                  {/* Attached File/Photo Preview if applicable */}
                  {event.file_url && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center space-x-3">
                      <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white overflow-hidden flex-shrink-0">
                        {event.file_url.toLowerCase().endsWith('.pdf') ? (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <FileText className="w-6 h-6" />
                          </div>
                        ) : (
                          <img src={event.file_url} alt="Evidence" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium text-slate-800 block text-[11px]">Attached Digital Evidence</span>
                        <a
                          href={event.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-[11px] font-semibold inline-flex items-center space-x-1 mt-0.5"
                        >
                          <span>Open File</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <GitCommit className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-600">No ownership history records found for this product.</p>
        </div>
      )}
    </div>
  );
}

