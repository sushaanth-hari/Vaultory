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
  Zap,
  Copy,
  Check,
  Terminal,
  HelpCircle,
  Unlink,
  MessageSquare
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
    connect_link: '',
    is_configured: false
  });
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Bot Simulator State
  const [simText, setSimText] = useState('/start');
  const [simLoading, setSimLoading] = useState(false);
  const [simResponse, setSimResponse] = useState(null);

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

  const handleSyncStatus = async () => {
    setRefreshing(true);
    setFeedback({ type: '', message: '' });
    try {
      const [sRes, lRes] = await Promise.all([
        api.get('/notifications/settings'),
        api.get('/notifications/logs')
      ]);
      setSettings(sRes.data);
      setLogs(lRes.data);
      await refreshUser();
      if (sRes.data.telegram_chat_id) {
        setFeedback({ 
          type: 'success', 
          message: `Linked! Telegram Chat ID detected: ${sRes.data.telegram_chat_id}` 
        });
      } else {
        setFeedback({ 
          type: 'info', 
          message: 'No Telegram account linked yet. Open the bot and press START or send /link.' 
        });
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

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
      setFeedback({ type: 'error', message: 'Please connect your bot or enter your Telegram Chat ID first.' });
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

  const handleCopyCommand = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleRunSimulator = async (commandToRun) => {
    const textToExecute = commandToRun || simText;
    if (!textToExecute) return;
    setSimLoading(true);
    setSimResponse(null);

    try {
      const res = await api.post('/notifications/telegram/simulate-message', {
        text: textToExecute,
        chat_id: settings.telegram_chat_id || '9188525411',
        username: settings.telegram_username || user?.email?.split('@')[0] || 'vaultory_user'
      });
      setSimResponse(res.data);
      // If command linked or unlinked, refresh settings in background
      if (['start', 'link', 'unlink'].includes(res.data.command)) {
        fetchSettingsAndLogs();
        refreshUser();
      }
    } catch (err) {
      console.error('Simulation failed:', err);
      setSimResponse({
        status: 'error',
        reply_text: err.response?.data?.detail || 'Simulation error. Check backend logs.'
      });
    } finally {
      setSimLoading(false);
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
  const botUsername = settings.bot_username || 'VaultoryWarrantyBot';
  const directConnectLink = settings.connect_link || `https://t.me/${botUsername}?start=${user?.id || 1}`;
  const startCommand = `/start ${user?.id || 1}`;
  const linkCommand = `/link ${user?.email || 'my_email@example.com'}`;

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
            : (feedback.type === 'info' 
                ? 'bg-blue-50 border border-blue-200 text-blue-800' 
                : 'bg-rose-50 border border-rose-200 text-rose-800')
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Telegram Connection Hero Card */}
      <div className={`border rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 ${
        isConnected ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center space-x-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${
            isConnected ? 'bg-emerald-600' : 'bg-[#24A1DE]'
          }`}>
            <Send className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-base">
                Telegram Bot: @{botUsername}
              </h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {isConnected ? 'ONLINE & LINKED' : 'READY TO CONNECT'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isConnected 
                ? `Proactive alerts active for Chat ID: ${settings.telegram_chat_id} ${settings.telegram_username ? `(@${settings.telegram_username})` : ''}`
                : 'Click the button to open Telegram and link your account with one click.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Connect Button */}
          <a
            href={directConnectLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#24A1DE] hover:bg-[#1f8ec4] text-white rounded-xl text-xs font-bold shadow-sm transition hover:shadow"
            title="Open Telegram Bot in app or web"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Connect on Telegram</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>

          {/* Sync Connection Button */}
          <button
            onClick={handleSyncStatus}
            disabled={refreshing}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition disabled:opacity-50"
            title="Sync connection status from Telegram"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>

          {isConnected && (
            <button
              onClick={handleSendTest}
              disabled={testing}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Send Test Alert</span>
            </button>
          )}

          <button
            onClick={handleTriggerManualScan}
            disabled={scanning}
            className="inline-flex items-center space-x-1.5 px-3 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium transition disabled:opacity-50"
            title="Execute immediate APScheduler warranty scan"
          >
            {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">Scan Expirations</span>
          </button>
        </div>
      </div>

      {/* Two Columns: Setup Instructions & Settings Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Quick Connect Instructions */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Easy Account Linking</span>
            </h3>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold text-slate-800">One-Click Telegram Launch</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click <b>Connect on Telegram</b> above or search for <b>@{botUsername}</b> in your Telegram app.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Tap START or Send Link Command</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tap the <b>START</b> button in Telegram, or send either of these commands:
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg font-mono text-[11px] text-slate-800">
                      <span>{startCommand}</span>
                      <button 
                        onClick={() => handleCopyCommand(startCommand)}
                        className="text-slate-500 hover:text-slate-900 ml-2"
                        title="Copy command"
                      >
                        {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg font-mono text-[11px] text-slate-800">
                      <span className="truncate">{linkCommand}</span>
                      <button 
                        onClick={() => handleCopyCommand(linkCommand)}
                        className="text-slate-500 hover:text-slate-900 ml-2"
                        title="Copy command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Automatic Sync</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Your Vaultory account links instantly upon receiving the message. Click <b>Check Status</b> above to confirm.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Bot Commands Reference */}
          <div className="pt-4 border-t border-slate-100 bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-2">
            <p className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-600" />
              <span>Available Bot Commands</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <code className="font-bold text-blue-600">/warranties</code>
                <p className="text-[10px] text-slate-500">List all your warranties</p>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <code className="font-bold text-blue-600">/status</code>
                <p className="text-[10px] text-slate-500">Check alerts & account</p>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <code className="font-bold text-blue-600">/help</code>
                <p className="text-[10px] text-slate-500">View command guide</p>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <code className="font-bold text-rose-600">/unlink</code>
                <p className="text-[10px] text-slate-500">Disconnect Telegram</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Notification Preferences Form */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>Notification & Account Preferences</span>
            <span className="text-[11px] font-normal text-slate-400">Manual adjustments</span>
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
                placeholder="e.g. 9188525411"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">Automatically set when you click Connect, or entered manually.</p>
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

      {/* Interactive Telegram Bot Simulator */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Interactive Telegram Bot Tester</span>
            </h3>
            <p className="text-xs text-slate-500">
              Test how the bot replies to commands directly from your browser.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            LIVE SIMULATOR
          </span>
        </div>

        {/* Quick Command Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 mr-1">Quick Test:</span>
          {['/warranties', '/status', '/help', startCommand, linkCommand, '/unknown_cmd'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => {
                setSimText(cmd);
                handleRunSimulator(cmd);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono transition"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunSimulator();
              }}
              placeholder="Type /start, /warranties, /status, /help..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
            />
          </div>
          <button
            onClick={() => handleRunSimulator()}
            disabled={simLoading || !simText}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 flex items-center space-x-1.5"
          >
            {simLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Execute</span>
          </button>
        </div>

        {/* Simulator Output Window */}
        {simResponse && (
          <div className="mt-3 bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs space-y-2 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
              <span>Command: <b className="text-white">{simResponse.command || 'custom'}</b></span>
              <span>Status: <b className="text-emerald-400">{simResponse.status}</b></span>
            </div>
            <div 
              className="whitespace-pre-wrap leading-relaxed text-slate-200 text-[11px]"
              dangerouslySetInnerHTML={{ __html: simResponse.reply_text }}
            />
          </div>
        )}
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
