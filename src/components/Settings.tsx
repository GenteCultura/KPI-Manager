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
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'system', label: 'Sistema', icon: Globe },
    { id: 'faq', label: 'FAQ & Ajuda', icon: HelpCircle },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-white shadow-lg shadow-gray-200">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Configurações</h2>
          <p className="text-sm text-gray-500">Ajuste as preferências e gerencie o sistema.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <tab.icon className={`h-5 w-5 shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`} />
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
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm text-center">
              <Shield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900">Configurações de Segurança</h3>
              <p className="text-sm text-gray-500 mt-2">Em breve: Gerenciamento de senhas, autenticação em duas etapas e logs de segurança.</p>
            </div>
          )}
          {activeTab === 'notifications' && (
            <NotificationSettingsView />
          )}
          {activeTab === 'system' && (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm text-center">
              <Globe className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900">Configurações do Sistema</h3>
              <p className="text-sm text-gray-500 mt-2">Em breve: Personalização da marca, fuso horário e integrações externas.</p>
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
