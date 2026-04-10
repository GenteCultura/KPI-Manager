import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Calculator, 
  Download, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Network,
  Layout,
  Upload,
  User as UserIcon,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';
import { useStore } from '../store/useStore';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: any) => void;
  onLogout: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  currentUser: User | null;
}

export const Sidebar = ({ 
  currentView, 
  onViewChange, 
  onLogout, 
  isCollapsed, 
  setIsCollapsed,
  currentUser
}: SidebarProps) => {
  const { } = useStore();
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventário', icon: Layout },
    { id: 'master', label: 'Lista de Indicadores', icon: BarChart3 },
    { id: 'users', label: 'Gestão de Usuários', icon: Users, adminOnly: true },
    { id: 'org', label: 'Gestão Organizacional', icon: Network },
    { id: 'consolidation', label: 'Consolidação', icon: Calculator },
    { id: 'import', label: 'Importação', icon: Upload, adminOnly: true },
    { id: 'export', label: 'Exportação', icon: Download },
    { id: 'logs', label: 'Logs de Dados', icon: Database, adminOnly: true },
  ];

  const filteredMenuItems = menuItems.filter(item => !item.adminOnly || currentUser?.accessLevel === 'Admin');

  const [imgError, setImgError] = React.useState(false);

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 80 : 280 }}
      className="fixed left-0 top-0 z-50 flex h-screen flex-col border-r transition-all duration-300 bg-white border-gray-200 shadow-sm"
    >
      {/* Logo Area */}
      <div className="flex h-20 items-center justify-between px-6">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200/50">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">KPI Manager</span>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200/50">
            <LayoutDashboard className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 px-4 py-6">
        {filteredMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`group relative flex w-full items-center rounded-xl py-3 text-sm font-semibold transition-all duration-200 cursor-pointer ${
              isCollapsed ? 'justify-center px-0' : 'px-4 gap-3'
            } ${
              currentView === item.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/50'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className={`flex items-center justify-center shrink-0 transition-all duration-200 ${isCollapsed ? 'w-10' : 'w-5'}`}>
              <item.icon className={`h-5 w-5 transition-colors duration-200 ${currentView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
            </div>
            {!isCollapsed && <span className="truncate">{item.label}</span>}
            
            {isCollapsed && (
              <div className="absolute left-full ml-4 hidden rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white group-hover:block whitespace-nowrap shadow-xl">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="border-t p-4 space-y-1 border-slate-100">
        <button
          onClick={() => onViewChange('profile')}
          className={`group relative flex w-full items-center rounded-xl py-2 text-sm font-semibold transition-all duration-200 cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : 'px-4 gap-3'
          } ${
            currentView === 'profile'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <div className={`flex items-center justify-center shrink-0 transition-all duration-200 ${isCollapsed ? 'w-10' : 'w-8'}`}>
            <div className="relative h-8 w-8 shrink-0">
              {currentUser?.photoUrl && !imgError ? (
                <img 
                  src={currentUser.photoUrl} 
                  alt="" 
                  className="h-full w-full rounded-full object-cover border border-white/20" 
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={`flex h-full w-full items-center justify-center rounded-full ${currentView === 'profile' ? 'bg-white/20' : 'bg-slate-100'}`}>
                  <UserIcon className={`h-4 w-4 transition-colors duration-200 ${currentView === 'profile' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                </div>
              )}
            </div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col items-start overflow-hidden">
              <span className="truncate w-full text-left">{currentUser?.name || 'Meu Perfil'}</span>
              <span className={`text-[10px] font-medium truncate w-full ${currentView === 'profile' ? 'text-indigo-100' : 'text-slate-400'}`}>
                {currentUser?.role || 'Colaborador'}
              </span>
            </div>
          )}
        </button>

        <button
          onClick={() => onViewChange('settings')}
          className={`group relative flex w-full items-center rounded-xl py-3 text-sm font-semibold transition-all duration-200 ${
            isCollapsed ? 'justify-center px-0' : 'px-4 gap-3'
          } ${
            currentView === 'settings'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <div className={`flex items-center justify-center shrink-0 transition-all duration-200 ${isCollapsed ? 'w-10' : 'w-5'}`}>
            <Settings className={`h-5 w-5 transition-colors duration-200 ${currentView === 'settings' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
          </div>
          {!isCollapsed && <span>Configurações</span>}
        </button>
        <button
          onClick={onLogout}
          className={`group relative flex w-full items-center rounded-xl py-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-all duration-200 ${
            isCollapsed ? 'justify-center px-0' : 'px-4 gap-3'
          }`}
        >
          <div className={`flex items-center justify-center shrink-0 transition-all duration-200 ${isCollapsed ? 'w-10' : 'w-5'}`}>
            <LogOut className="h-5 w-5 text-red-400 group-hover:text-red-600" />
          </div>
          {!isCollapsed && <span>Sair do Sistema</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 flex h-6 w-6 items-center justify-center rounded-full border transition-all bg-white border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm"
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </motion.aside>
  );
};
