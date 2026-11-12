import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Bell, 
  ExternalLink, 
  RefreshCw, 
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function TelegramSettings() {
  const { user, refreshUser } = useAuth();

  const [settings, setSettings] = useState({
    telegram_chat_id: '',
    telegram_username: '',
    telegram_notifications_enabled: false,
    notify_30_days: true,
    notify_7_days: true,
    notify_1_day: true,
    bot_username: 'VaultoryWarrantyBot',
    connect_link: ''
  });
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchSettingsAndLogs = async () => {
    try {
      setLoading(true);
      const [sRes, lRes] = await Promise.all([
        api.get('/notifications/settings'),
        api.get('/notifications/logs')
      ]);
      setSettings(sRes.data);
      setLogs(lRes.data);
    } catch (err) {
      console.error('Failed to load telegram settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndLogs();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await api.put('/notifications/settings', {
        telegram_chat_id: settings.telegram_chat_id,
        telegram_username: settings.telegram_username,
        telegram_notifications_enabled: settings.telegram_notifications_enabled,
        notify_30_days: settings.notify_30_days,
        notify_7_days: settings.notify_7_days,
        notify_1_day: settings.notify_1_day
      });
      setSettings(res.data);
      await refreshUser();
      setFeedback({ type: 'success', message: 'Telegram notification preferences saved successfully!' });
    } catch (err) {
      console.error('Save failed:', err);
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!settings.telegram_chat_id) {
      setFeedback({ type: 'error', message: 'Please enter and save your Telegram Chat ID first.' });
      return;
    }

    setTesting(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await api.post('/notifications/test', {});
      setFeedback({ type: 'success', message: res.data.message || 'Test notification sent to Telegram!' });
      fetchSettingsAndLogs();
    } catch (err) {
      console.error('Test message failed:', err);
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Telegram test message delivery failed.' });
    } finally {
      setTesting(false);
    }
  };

  const handleTriggerManualScan = async () => {
    setScanning(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await api.post('/notifications/trigger-scan');
      setFeedback({ 
        type: 'success', 
        message: `APScheduler scan completed! Dispatched ${res.data.notifications_dispatched} notification(s).` 
      });
      fetchSettingsAndLogs();
    } catch (err) {
      console.error('Scan trigger error:', err);
      setFeedback({ type: 'error', message: 'Failed to run scheduler check.' });
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isConnected = Boolean(settings.telegram_chat_id && settings.telegram_notifications_enabled);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Telegram Notification Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Connect your Telegram account to receive automated alerts 30 days, 7 days, and 1 day before any product warranty expires.
        </p>
      </div>

      {feedback.message && (
        <div className={`p-4 rounded-xl text-xs flex items-center space-x-2.5 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Connection Status Card */}
      <div className={`border rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isConnected ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-xs ${
            isConnected ? 'bg-emerald-600' : 'bg-slate-700'
          }`}>
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Telegram Status: {isConnected ? 'Connected & Active' : 'Not Connected'}
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {isConnected ? 'ONLINE' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isConnected 
                ? `Alerts sending to Chat ID: ${settings.telegram_chat_id} (@${settings.telegram_username || 'user'})`
                : 'Follow the steps below to connect your Telegram account.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isConnected && (
            <button
              onClick={handleSendTest}
              disabled={testing}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Send Test Alert</span>
            </button>
          )}

          <button
            onClick={handleTriggerManualScan}
            disabled={scanning}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            title="Execute immediate APScheduler warranty scan"
          >
            {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5 text-slate-500" />}
            <span>Check Expirations Now</span>
          </button>
        </div>
      </div>

      {/* Two Columns: Setup Guide & Settings Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Setup Instructions */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>How to Connect Your Telegram</span>
            </h3>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Start the Telegram Bot</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Open Telegram and search for <b>@{settings.bot_username || 'VaultoryWarrantyBot'}</b> or click the link below.
                  </p>
                  <a
                    href={settings.connect_link || `https://t.me/${settings.bot_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center space-x-1 text-blue-600 hover:underline font-semibold"
                  >
                    <span>Open in Telegram</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Obtain your Chat ID</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Send <code>/start</code> to the bot, or talk to <b>@userinfobot</b> to view your numerical Chat ID (e.g. <code>582910482</code>).
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Save and Verify</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Paste your Chat ID in the form, enable the notification toggle, and hit "Send Test Alert" to verify delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
            <p className="text-[11px] font-semibold text-slate-700">Duplicate Prevention Guarantee</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Vaultory records every notification in a persistent audit log so you will never receive duplicate reminders for the same warranty milestone.
            </p>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-4 pb-2 border-b border-slate-100">
            Notification Preferences
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Telegram Chat ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={settings.telegram_chat_id || ''}
                onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                placeholder="e.g. 582910482"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">Unique numeric identifier of your Telegram conversation with the bot.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Telegram Username (Optional)</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-xs">
                  @
                </span>
                <input
                  type="text"
                  value={settings.telegram_username || ''}
                  onChange={(e) => setSettings({ ...settings, telegram_username: e.target.value.replace('@', '') })}
                  placeholder="username"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-r-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>
            </div>

            {/* Master Toggle */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 text-xs">Enable Telegram Notifications</p>
                <p className="text-[11px] text-slate-500">Allow Vaultory to send automated messages to your Telegram bot.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.telegram_notifications_enabled}
                onChange={(e) => setSettings({ ...settings, telegram_notifications_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Threshold Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block font-semibold text-slate-700 text-xs mb-1">Reminder Intervals</label>
              
              <div className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 rounded-lg">
                <span className="text-slate-700 text-xs">30 Days before expiration</span>
                <input
                  type="checkbox"
                  checked={settings.notify_30_days}
                  onChange={(e) => setSettings({ ...settings, notify_30_days: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 rounded-lg">
                <span className="text-slate-700 text-xs">7 Days before expiration (Urgent)</span>
                <input
                  type="checkbox"
                  checked={settings.notify_7_days}
                  onChange={(e) => setSettings({ ...settings, notify_7_days: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 rounded-lg">
                <span className="text-slate-700 text-xs">1 Day before expiration (Final Notice)</span>
                <input
                  type="checkbox"
                  checked={settings.notify_1_day}
                  onChange={(e) => setSettings({ ...settings, notify_1_day: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Notification Logs Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Dispatched Notification Log</h3>
            <p className="text-xs text-slate-500">Audit history of automated and test messages delivered to your Telegram account.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">{logs.length} Logged</span>
        </div>

        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Message Preview</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 uppercase text-[10px]">
                      {log.notification_type}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">
                      {log.channel}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-sm truncate" title={log.message_preview}>
                      {log.message_preview}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <p className="text-xs">No notifications logged yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

