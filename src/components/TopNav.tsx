import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calculator, 
  BarChart3, 
  Calendar as CalendarIcon, 
  Settings, 
  Database,
  FileText,
  Network,
  Upload,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Layout,
  Bell,
  Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';

interface TopNavProps {
  currentView: string;
  onViewChange: (view: any) => void;
  currentUser: User | null;
  onLogout: () => void;
}

export const TopNav = ({ currentView, onViewChange, currentUser, onLogout }: TopNavProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAdmin = currentUser?.accessLevel === 'Admin';
  const isAuthenticated = !!currentUser;

  const navItems = isAuthenticated ? [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendar', label: 'Calendário', icon: CalendarIcon },
    { id: 'inventory', label: 'Inventário', icon: Layout },
    { id: 'master', label: 'Lista de Estrutura', icon: BarChart3 },
    { id: 'users', label: 'Usuários', icon: Users, adminOnly: true },
    { id: 'org', label: 'Organização', icon: Network },
    { id: 'consolidation', label: 'Consolidação', icon: Calculator },
    { id: 'export', label: 'Relatórios', icon: FileText },
    { id: 'import', label: 'Importação', icon: Upload, adminOnly: true },
    { id: 'logs', label: 'Logs', icon: Database, adminOnly: true },
  ] : [
    { id: 'landing', label: 'Dashboard Geral', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventário', icon: Boxes },
    { id: 'master', label: 'Estrutura', icon: BarChart3 },
  ];

  const filteredItems = navItems.filter(item => !('adminOnly' in item && item.adminOnly) || isAdmin);

  const handleNavClick = (viewId: string) => {
    onViewChange(viewId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-slate-200/60 shadow-sm">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div 
              className="flex cursor-pointer items-center gap-4"
              onClick={() => onViewChange('landing')}
            >
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
                <img 
                  src="https://lh3.googleusercontent.com/d/13IU9FF0E6phDCZnfsBP4pu6WLa58nemC" 
                  alt="Logo" 
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="hidden text-2xl font-light tracking-[0.2em] text-slate-800 uppercase sm:block">KAPY</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${
                    currentView === item.id 
                      ? 'text-slate-900 bg-slate-100/50' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className={`h-3.5 w-3.5 ${currentView === item.id ? 'text-slate-900' : 'text-slate-300'}`} />
                  {item.label}
                  {currentView === item.id && (
                    <motion.div 
                      layoutId="navUnderline"
                      className="absolute -bottom-4 left-2 right-2 h-0.5 bg-slate-900 rounded-full"
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {isAuthenticated ? (
              <>
                {/* Actions */}
                <div className="hidden sm:flex items-center gap-2">
                  <button 
                    onClick={() => onViewChange('settings')}
                    className={`p-2 rounded-xl transition-all ${currentView === 'settings' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all">
                    <Bell className="h-4 w-4" />
                  </button>
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                  <button
                    onClick={() => onViewChange('profile')}
                    className="flex items-center gap-3 text-left transition-opacity hover:opacity-80"
                  >
                    <div className="hidden text-right leading-none sm:block">
                      <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{currentUser?.name?.split(' ')[0]}</p>
                      <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{currentUser?.accessLevel}</p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                      {currentUser?.photoUrl ? (
                        <img src={currentUser.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                  
                  <button 
                    onClick={onLogout}
                    className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onViewChange('login')}
                  className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 transition-all"
                >
                  Entrar
                </button>
                <button 
                  onClick={() => onViewChange('login')}
                  className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  Começar Agora
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 lg:hidden"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-100 bg-white lg:hidden overflow-hidden"
          >
            <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                    currentView === item.id 
                      ? 'bg-slate-900 text-white' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-1">
                <button
                  onClick={() => handleNavClick('settings')}
                  className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </button>
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-widest text-rose-500 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sair do Sistema
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
