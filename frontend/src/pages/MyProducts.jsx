import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { 
  Package, 
  Search, 
  Plus, 
  FileText, 
  GitCommit, 
  Wrench, 
  Trash2, 
  Filter, 
  Calendar, 
  DollarSign,
  ChevronRight,
  Sparkles,
  Download
} from 'lucide-react';

const CATEGORIES = ['All', 'Electronics', 'Computing', 'Appliances', 'Vehicles', 'Accessories', 'Other'];
const WARRANTY_FILTERS = ['All', 'Active', 'Expiring_Soon', 'Expired'];

export default function MyProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWarrantyStatus, setSelectedWarrantyStatus] = useState('All');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedWarrantyStatus !== 'All') params.warranty_status = selectedWarrantyStatus;

      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [search, selectedCategory, selectedWarrantyStatus]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/products/${id}`);
      setProducts(products.filter(p => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete product.');
    }
  };

  const getWarrantyInfo = (prod) => {
    if (!prod.warranty || !prod.warranty.end_date) return { status: 'none', days: null };
    const end = new Date(prod.warranty.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'expired', days: diffDays };
    if (diffDays <= 30) return { status: 'expiring_soon', days: diffDays };
    return { status: 'active', days: diffDays };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Registered Products</h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse and manage all verified product assets, warranty documents, and ownership records.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <Link
            to="/add-product"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </Link>
          <Link
            to="/add-product?tab=scan"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>AI Receipt Scan</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, brand, model, serial, or store..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
            />
          </div>

          {/* Warranty Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Warranty:</span>
            <div className="flex space-x-1">
              {WARRANTY_FILTERS.map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedWarrantyStatus(status)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    selectedWarrantyStatus === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status === 'Expiring_Soon' ? 'Expiring' : status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 pt-1">
          <span className="text-xs font-semibold text-slate-400 mr-1">Category:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition flex-shrink-0 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List / Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((prod) => {
            const { status: wStat, days: wDays } = getWarrantyInfo(prod);
            return (
              <div
                key={prod.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top Badge & Category */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">
                      {prod.category || 'General'}
                    </span>
                    <StatusBadge status={wStat} remainingDays={wDays} size="xs" />
                  </div>

                  {/* Product Title & Brand */}
                  <h3 className="font-bold text-slate-900 text-base leading-snug hover:text-blue-600 transition">
                    <Link to={`/products/${prod.id}`}>{prod.name}</Link>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {prod.brand} {prod.model_number && `• Model: ${prod.model_number}`}
                  </p>

                  {/* Metadata Specs */}
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Purchase Date</span>
                      <span className="font-medium text-slate-800">{prod.purchase_date || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Purchase Price</span>
                      <span className="font-medium text-slate-800">
                        {prod.currency || 'USD'} {prod.purchase_price ? prod.purchase_price.toFixed(2) : '0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Store / Retailer</span>
                      <span className="font-medium text-slate-800 truncate block">{prod.retailer || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Warranty Period</span>
                      <span className="font-medium text-slate-800">
                        {prod.warranty ? `${prod.warranty.duration_months} Months` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    {/* View Details */}
                    <Link
                      to={`/products/${prod.id}`}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Details
                    </Link>

                    {/* Evidence PDF Download */}
                    <a
                      href={`/api/v1/evidence/products/${prod.id}/pdf`}
                      download
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition"
                      title="Download Ownership Evidence PDF"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    {/* Timeline */}
                    <Link
                      to={`/timeline?product_id=${prod.id}`}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                      title="View Ownership Timeline"
                    >
                      <GitCommit className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Delete Button */}
                  <div>
                    {deleteConfirmId === prod.id ? (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleDelete(prod.id)}
                          className="px-2 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-md"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 text-[11px] rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(prod.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No products match your criteria</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Try clearing your filters or register a new product.</p>
          <Link
            to="/add-product"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Product</span>
          </Link>
        </div>
      )}
    </div>
  );
}

