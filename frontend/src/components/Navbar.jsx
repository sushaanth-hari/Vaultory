import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Bell, Send, User, LogOut, Menu, ExternalLink } from 'lucide-react';

export default function Navbar({ onMobileMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Mobile Menu */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onMobileMenuClick}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-slate-900 tracking-tight leading-none">Vaultory</span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide">OWNERSHIP & WARRANTY</span>
              </div>
            </Link>
          </div>

          {/* Right: Quick Telegram Status, Profile & Actions */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Telegram Notification Status Pill */}
            <Link
              to="/telegram-settings"
              className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                user?.telegram_chat_id 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-blue-500" />
              <span>{user?.telegram_chat_id ? 'Telegram Active' : 'Connect Telegram'}</span>
            </Link>

            {/* User Profile */}
            <Link 
              to="/profile"
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 transition"
              title="View Profile"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {user?.full_name || 'My Account'}
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                  {user?.email}
                </span>
              </div>
            </Link>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

