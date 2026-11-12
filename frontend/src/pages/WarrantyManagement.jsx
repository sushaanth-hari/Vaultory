import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import StatCard from '../components/StatCard';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  Edit3, 
  Download, 
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export default function WarrantyManagement() {
  const [warranties, setWarranties] = useState([]);
  const [stats, setStats] = useState({ total_warranties: 0, active_warranties: 0, expiring_soon: 0, expired_warranties: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [editModalWarranty, setEditModalWarranty] = useState(null);
  const [editForm, setEditForm] = useState({
    duration_months: 12,
    start_date: '',
    end_date: '',
    warranty_type: 'Manufacturer',
    coverage_details: '',
    provider_contact: '',
    notes: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchWarranties = async () => {
    try {
      setLoading(true);
      const [wRes, sRes] = await Promise.all([
        api.get('/warranties', { params: { status_filter: filter } }),
        api.get('/warranties/stats')
      ]);
      setWarranties(wRes.data);
      setStats(sRes.data);
    } catch (err) {
      console.error('Failed to load warranties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarranties();
  }, [filter]);

  const openEditModal = (w) => {
    setEditModalWarranty(w);
    setEditForm({
      duration_months: w.duration_months || 12,
      start_date: w.start_date || '',
      end_date: w.end_date || '',
      warranty_type: w.warranty_type || 'Manufacturer',
      coverage_details: w.coverage_details || '',
      provider_contact: w.provider_contact || '',
      notes: w.notes || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editModalWarranty) return;

    setSavingEdit(true);
    try {
      await api.put(`/warranties/${editModalWarranty.id}`, editForm);
      setEditModalWarranty(null);
      fetchWarranties();
    } catch (err) {
      console.error('Failed to update warranty:', err);
      alert('Failed to update warranty.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredList = warranties.filter((w) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (w.product_name || '').toLowerCase().includes(s) ||
      (w.product_brand || '').toLowerCase().includes(s) ||
      (w.warranty_type || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Warranty Management</h1>
        <p className="text-xs text-slate-500 mt-1">
          Monitor calculated warranty durations, active protections, and upcoming expirations across all assets.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Policies"
          value={stats.total_warranties}
          icon={ShieldCheck}
          color="slate"
          onClick={() => setFilter('all')}
        />
        <StatCard
          title="Active Coverage"
          value={stats.active_warranties}
          icon={ShieldCheck}
          color="green"
          onClick={() => setFilter('active')}
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiring_soon}
          subtitle="Within 30 Days"
          icon={AlertTriangle}
          color="amber"
          onClick={() => setFilter('expiring_soon')}
        />
        <StatCard
          title="Expired Coverage"
          value={stats.expired_warranties}
          icon={AlertOctagon}
          color="rose"
          onClick={() => setFilter('expired')}
        />
      </div>

      {/* Controls & Search */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or brand..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-1 w-full sm:w-auto overflow-x-auto">
          {['all', 'active', 'expiring_soon', 'expired'].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition flex-shrink-0 ${
                filter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'expiring_soon' ? 'Expiring Soon' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Warranty List Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredList.length > 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Coverage Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Validity Dates</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <Link to={`/products/${w.product_id}`} className="font-bold text-slate-900 hover:text-blue-600 block">
                        {w.product_name}
                      </Link>
                      <span className="text-[11px] text-slate-400">{w.product_brand}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {w.warranty_type}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {w.duration_months} Months
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="block font-medium">{w.start_date}</span>
                      <span className="text-[10px] text-slate-400">to {w.end_date}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {w.remaining_days < 0 ? (
                        <span className="text-rose-600 font-bold">Expired</span>
                      ) : (
                        <div>
                          <span className={`font-bold ${w.remaining_days <= 30 ? 'text-amber-600' : 'text-slate-900'}`}>
                            {w.remaining_days} days
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={w.status} remainingDays={w.remaining_days} size="xs" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openEditModal(w)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          title="Edit Warranty Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`/api/v1/evidence/products/${w.product_id}/pdf`}
                          download
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Generate Evidence PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-600">No warranties found matching this filter.</p>
        </div>
      )}

      {/* Edit Warranty Modal */}
      {editModalWarranty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Update Warranty Details</h3>
            <p className="text-xs text-slate-500 mb-4">{editModalWarranty.product_name}</p>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration (Months)</label>
                  <input
                    type="number"
                    value={editForm.duration_months}
                    onChange={(e) => setEditForm({ ...editForm, duration_months: parseInt(e.target.value) || 12 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Warranty Type</label>
                  <select
                    value={editForm.warranty_type}
                    onChange={(e) => setEditForm({ ...editForm, warranty_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Extended">Extended</option>
                    <option value="Store">Store</option>
                    <option value="Lifetime">Lifetime</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Provider Contact</label>
                <input
                  type="text"
                  value={editForm.provider_contact}
                  onChange={(e) => setEditForm({ ...editForm, provider_contact: e.target.value })}
                  placeholder="e.g. 1-800-MY-APPLE or support.sony.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Coverage Details / Scope</label>
                <textarea
                  rows={2}
                  value={editForm.coverage_details}
                  onChange={(e) => setEditForm({ ...editForm, coverage_details: e.target.value })}
                  placeholder="Parts & labor, accidental damage..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalWarranty(null)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {savingEdit ? 'Updating...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

