import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { 
  Package, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  DollarSign, 
  Wrench, 
  Plus, 
  FileText, 
  ArrowRight, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Send
} from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/summary');
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading ownership dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Quick Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ownership & Warranty Overview</h1>
          <p className="text-xs text-slate-500 mt-1">Manage and track your registered product assets, condition proofs, and claim readiness.</p>
        </div>
        <div className="flex items-center space-x-2.5">
          <Link
            to="/add-product"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Product</span>
          </Link>
          <Link
            to="/add-product?tab=scan"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>AI Receipt Scan</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard
          title="Products"
          value={data?.total_products || 0}
          icon={Package}
          color="slate"
        />
        <StatCard
          title="Asset Value"
          value={`$${(data?.total_inventory_value || 0).toLocaleString()}`}
          icon={DollarSign}
          color="indigo"
        />
        <StatCard
          title="Active Warranties"
          value={data?.active_warranties || 0}
          icon={ShieldCheck}
          color="green"
        />
        <StatCard
          title="Expiring Soon"
          value={data?.expiring_soon || 0}
          subtitle="< 30 days"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Expired"
          value={data?.expired_warranties || 0}
          icon={AlertOctagon}
          color="rose"
        />
        <StatCard
          title="Repairs Logged"
          value={data?.total_repairs || 0}
          icon={Wrench}
          color="blue"
        />
      </div>

      {/* Two Column Section: Upcoming Expirations & Recent Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upcoming Warranty Expirations */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Upcoming Expirations</h2>
            </div>
            <Link to="/warranties" className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center space-x-1">
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 space-y-3">
            {data?.upcoming_expirations && data.upcoming_expirations.length > 0 ? (
              data.upcoming_expirations.map((item) => (
                <div
                  key={item.product_id}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.product_name}</h4>
                      <StatusBadge status="expiring_soon" remainingDays={item.days_remaining} size="xs" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {item.brand} • Ends {item.end_date}
                    </p>
                  </div>
                  <Link
                    to={`/products/${item.product_id}`}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                    title="View Product"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-80" />
                <p className="text-xs font-medium text-slate-600">No urgent expirations pending</p>
                <p className="text-[11px] text-slate-400 mt-0.5">All product warranties are in healthy standing.</p>
              </div>
            )}
          </div>

          {/* Telegram Alert Callout */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Automatic Telegram reminders active</span>
            <Link to="/telegram-settings" className="font-semibold text-blue-600 hover:underline flex items-center space-x-1">
              <Send className="w-3 h-3 text-blue-500" />
              <span>Configure Bot</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Recently Added Products */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recently Added Products</h2>
            </div>
            <Link to="/products" className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center space-x-1">
              <span>All Products</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 divide-y divide-slate-100">
            {data?.recent_products && data.recent_products.length > 0 ? (
              data.recent_products.map((prod) => (
                <div key={prod.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0 hover:bg-slate-50/50 px-2 rounded-lg transition">
                  <div className="flex items-center space-x-3 min-w-0 pr-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0 font-bold text-xs">
                      {prod.brand ? prod.brand.slice(0, 2).toUpperCase() : 'VA'}
                    </div>
                    <div className="min-w-0">
                      <Link to={`/products/${prod.id}`} className="text-xs font-bold text-slate-900 hover:text-blue-600 truncate block">
                        {prod.name}
                      </Link>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {prod.category} • Purchased {prod.purchase_date || 'N/A'} • ${prod.purchase_price ? prod.purchase_price.toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <StatusBadge status={prod.warranty_status} remainingDays={prod.warranty_days_remaining} size="xs" />
                    <Link
                      to={`/products/${prod.id}`}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-slate-600">No products registered yet</p>
                <Link to="/add-product" className="inline-block mt-2 text-xs font-semibold text-blue-600 hover:underline">
                  Register your first product →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

