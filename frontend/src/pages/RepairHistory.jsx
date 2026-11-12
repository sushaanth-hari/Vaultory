import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';
import { 
  Wrench, 
  Plus, 
  DollarSign, 
  ShieldCheck, 
  FileText, 
  Calendar, 
  Trash2, 
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function RepairHistory() {
  const [repairs, setRepairs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // New Repair Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [serviceCenter, setServiceCenter] = useState('');
  const [repairDate, setRepairDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [warrantyCovered, setWarrantyCovered] = useState(false);
  const [status, setStatus] = useState('Completed');
  const [docFile, setDocFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchRepairsAndProducts = async () => {
    try {
      setLoading(true);
      const [rRes, pRes] = await Promise.all([
        api.get('/repairs'),
        api.get('/products')
      ]);
      setRepairs(rRes.data);
      setProducts(pRes.data);
      if (pRes.data.length > 0 && !selectedProductId) {
        setSelectedProductId(pRes.data[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load repair history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepairsAndProducts();
  }, []);

  const handleCreateRepair = async (e) => {
    e.preventDefault();
    if (!selectedProductId || !serviceCenter || !description) {
      alert('Please fill in product, service center and description.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('service_center', serviceCenter);
      formData.append('repair_date', repairDate);
      formData.append('description', description);
      formData.append('cost', cost ? parseFloat(cost) : 0.0);
      formData.append('currency', 'USD');
      formData.append('warranty_covered', warrantyCovered);
      formData.append('status', status);
      if (docFile) {
        formData.append('document', docFile);
      }

      await api.post(`/repairs/products/${selectedProductId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowModal(false);
      setServiceCenter('');
      setDescription('');
      setCost('');
      setWarrantyCovered(false);
      setDocFile(null);
      fetchRepairsAndProducts();
    } catch (err) {
      console.error('Error logging repair:', err);
      alert('Failed to log repair.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRepair = async (id) => {
    try {
      await api.delete(`/repairs/${id}`);
      setRepairs(repairs.filter(r => r.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete repair:', err);
      alert('Failed to delete repair.');
    }
  };

  // Metrics
  const totalRepairs = repairs.length;
  const totalCost = repairs.reduce((acc, r) => acc + (r.cost || 0), 0);
  const coveredCount = repairs.filter(r => r.warranty_covered).length;

  const filteredRepairs = repairs.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.product_name || '').toLowerCase().includes(s) ||
      (r.service_center || '').toLowerCase().includes(s) ||
      (r.description || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service & Repair History</h1>
          <p className="text-xs text-slate-500 mt-1">
            Log maintenance records, track out-of-pocket expenses, and attach service center invoices.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log New Repair</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Service Events"
          value={totalRepairs}
          icon={Wrench}
          color="blue"
        />
        <StatCard
          title="Total Expenses"
          value={`$${totalCost.toFixed(2)}`}
          icon={DollarSign}
          color="indigo"
        />
        <StatCard
          title="Warranty Covered"
          value={`${coveredCount} repairs`}
          subtitle="$0 Out-of-pocket"
          icon={ShieldCheck}
          color="green"
        />
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repairs, products, or service centers..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 hidden sm:block">
          {filteredRepairs.length} Record(s) Found
        </span>
      </div>

      {/* Repairs Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredRepairs.length > 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Service Center</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Cost</th>
                  <th className="py-3 px-4">Coverage</th>
                  <th className="py-3 px-4">Invoice</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRepairs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {r.repair_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link to={`/products/${r.product_id}`} className="font-bold text-slate-900 hover:text-blue-600 block">
                        {r.product_name}
                      </Link>
                      <span className="text-[11px] text-slate-400">{r.product_brand}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {r.service_center}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={r.description}>
                      {r.description}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ${r.cost.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        r.warranty_covered 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.warranty_covered ? 'Warranty ($0)' : 'Out-of-Pocket'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {r.document_url ? (
                        <a
                          href={r.document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline font-semibold inline-flex items-center space-x-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Doc</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {deleteConfirmId === r.id ? (
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleDeleteRepair(r.id)}
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
                          onClick={() => setDeleteConfirmId(r.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-600">No repair records found.</p>
        </div>
      )}

      {/* Log Repair Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Log Maintenance & Repair Event</h3>
            
            <form onSubmit={handleCreateRepair} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Product Asset</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Center / Repair Shop</label>
                <input
                  type="text"
                  required
                  value={serviceCenter}
                  onChange={(e) => setServiceCenter(e.target.value)}
                  placeholder="e.g. Official Apple Genius Bar, UBreakIFix"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Repair Date</label>
                  <input
                    type="date"
                    required
                    value={repairDate}
                    onChange={(e) => setRepairDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cost (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Description</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details of hardware replaced, software flashing, or labor performed..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="w_cov"
                  checked={warrantyCovered}
                  onChange={(e) => setWarrantyCovered(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="w_cov" className="text-xs text-slate-700 font-medium">
                  Fully covered under warranty ($0 out-of-pocket)
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Document / Invoice File</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setDocFile(e.target.files[0])}
                  className="w-full text-xs text-slate-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Repair Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

