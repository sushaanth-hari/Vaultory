import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  PlusCircle, 
  ShieldCheck, 
  GitCommit, 
  Wrench, 
  Send, 
  User,
  Sparkles
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'My Products', path: '/products', icon: Package },
  { name: 'Add Product', path: '/add-product', icon: PlusCircle, badge: 'OCR AI' },
  { name: 'Warranties', path: '/warranties', icon: ShieldCheck },
  { name: 'Ownership Timeline', path: '/timeline', icon: GitCommit },
  { name: 'Repair History', path: '/repairs', icon: Wrench },
  { name: 'Telegram Alerts', path: '/telegram-settings', icon: Send },
  { name: 'User Profile', path: '/profile', icon: User },
];

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-16 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/80 transition-transform duration-200 ease-in-out lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full py-4 px-3 justify-between">
          {/* Main Navigation */}
          <nav className="space-y-1">
            <div className="px-3 pb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Navigation</p>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => `
                    flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150
                    ${isActive 
                      ? 'bg-slate-900 text-white shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'}
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom Card / System Information */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>AI & Evidence Core</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Tesseract OCR, OpenAI Structuring, OpenCV Diff & ReportLab Engine active.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

