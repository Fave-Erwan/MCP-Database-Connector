import React from 'react';
import { LayoutDashboard, ShieldCheck, ScrollText, Database } from 'lucide-react';

interface SidebarProps {
  setPage: (page: string) => void;
  currentPage: string;
}

export default function Sidebar({ setPage, currentPage }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'permissions', label: 'Permissions', icon: <ShieldCheck size={20} /> },
    { id: 'logs', label: 'Audit Logs', icon: <ScrollText size={20} /> },
  ];

  return (
    <div className="w-64 bg-gray-800 p-4 h-full border-r border-gray-700 flex flex-col">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="bg-blue-600 p-2 rounded-lg text-white">
          <Database size={24} />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">MCP Connector</h2>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              currentPage === item.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto p-4 bg-gray-900/50 rounded-xl border border-gray-700">
        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Version</p>
        <p className="text-sm text-blue-400 font-mono">v1.0.0-dev</p>
      </div>
    </div>
  );
}