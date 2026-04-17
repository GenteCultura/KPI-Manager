import React, { useState } from 'react';
import { Settings as SettingsIcon, Users, Shield, Bell, Globe, HelpCircle } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { NotificationSettingsView } from './NotificationSettingsView';
import { FAQView } from './FAQView';
import { User } from '../types';

interface SettingsProps {
  users: User[];
  onEditUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  onInactivateUser: (id: string) => void;
  onOpenAuditTrail: (user: User) => void;
  onAddUser: () => void;
  currentUser: User | null;
}

export const Settings = ({ users, onEditUser, onDeleteUser, onInactivateUser, onOpenAuditTrail, onAddUser, currentUser }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState<'users' | 'security' | 'notifications' | 'system' | 'faq'>('users');

  const tabs = [
    { id: 'users', label: 'Usuários', icon: Users, adminOnly: true },
    { id: 'security', label: 'Segurança', icon: Shield, adminOnly: true },
    { id: 'notifications', label: 'Notificações', icon: Bell, adminOnly: true },
    { id: 'system', label: 'Sistema', icon: Globe, adminOnly: true },
    { id: 'faq', label: 'FAQ & Ajuda', icon: HelpCircle },
  ];

  const filteredTabs = tabs.filter(tab => !tab.adminOnly || currentUser?.accessLevel === 'Admin');

  // If current active tab is restricted, switch to first available
  useState(() => {
    if (currentUser?.accessLevel !== 'Admin' && activeTab !== 'faq') {
      setActiveTab('faq');
    }
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm ring-1 ring-slate-200">
          <SettingsIcon className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Configurações</h2>
          <p className="text-slate-400 text-sm font-light mt-1">Ajuste as preferências e gerencie o sistema.</p>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/60 bg-white p-2 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[10px] font-medium uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <tab.icon className={`h-4 w-4 shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-slate-300'}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'users' && (
            <UserManagement 
              users={users} 
              onEdit={onEditUser} 
              onDelete={onDeleteUser} 
              onInactivate={onInactivateUser}
              onOpenAuditTrail={onOpenAuditTrail}
              onAdd={onAddUser}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'security' && (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-12 shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-200 mx-auto mb-6 border border-slate-100">
                <Shield className="h-8 w-8 opacity-30" />
              </div>
              <h3 className="text-sm font-medium text-slate-800 uppercase tracking-widest">Segurança</h3>
              <p className="text-[10px] font-light text-slate-400 mt-3 tracking-wide max-w-xs mx-auto">
                Em breve: Gerenciamento de senhas, autenticação em duas etapas e logs de segurança.
              </p>
            </div>
          )}
          {activeTab === 'notifications' && (
            <NotificationSettingsView />
          )}
          {activeTab === 'system' && (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-12 shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-200 mx-auto mb-6 border border-slate-100">
                <Globe className="h-8 w-8 opacity-30" />
              </div>
              <h3 className="text-sm font-medium text-slate-800 uppercase tracking-widest">Sistema</h3>
              <p className="text-[10px] font-light text-slate-400 mt-3 tracking-wide max-w-xs mx-auto">
                Em breve: Personalização da marca, fuso horário e integrações externas.
              </p>
            </div>
          )}
          {activeTab === 'faq' && (
            <FAQView />
          )}
        </div>
      </div>
    </div>
  );
};
