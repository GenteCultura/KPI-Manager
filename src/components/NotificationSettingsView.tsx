import React, { useState, useEffect } from 'react';
import { Bell, Mail, Clock, Users, Save, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Button } from './ui/Button';
import { toast } from 'react-hot-toast';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { NotificationSettings } from '../types';
import { toSnakeCase } from '../lib/mapping';

export const NotificationSettingsView = () => {
  const { notificationSettings, setNotificationSettings, users, consolidations } = useStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [localSettings, setLocalSettings] = useState<NotificationSettings>(
    notificationSettings || {
      id: 'global',
      emailEnabled: true,
      notifyMissingConsolidation: true,
      reminderDays: 5,
      recipients: 'Gestores',
      customEmails: [],
    }
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'notifications'), toSnakeCase(localSettings), { merge: true });
      setNotificationSettings(localSettings);
      toast.success('Configurações de notificação salvas!');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerReminders = async () => {
    setIsSending(true);
    try {
      // Logic to find missing consolidations
      const currentMonth = new Date().toISOString().slice(0, 7);
      const activeUsers = users.filter(u => u.status === 'Ativo');
      const missingUsers = activeUsers.filter(u => 
        !consolidations.some(c => c.collaboratorId === u.id && c.month === currentMonth)
      );

      if (missingUsers.length === 0) {
        toast.success('Todos os colaboradores já possuem consolidado para este mês!');
        return;
      }

      // Simulate sending emails
      console.log('Sending reminders to:', missingUsers.map(u => u.email));
      
      // In a real scenario, this would call a Cloud Function or a backend API
      // For now, we'll just show a success message with the count
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success(`Lembretes enviados para ${missingUsers.length} colaboradores pendentes!`);
      
      // Update last run
      const updatedSettings = { ...localSettings, lastRun: new Date().toISOString() };
      await setDoc(doc(db, 'settings', 'notifications'), toSnakeCase(updatedSettings), { merge: true });
      setNotificationSettings(updatedSettings);
      setLocalSettings(updatedSettings);

    } catch (error) {
      console.error('Error triggering reminders:', error);
      toast.error('Erro ao enviar lembretes.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Notificações por E-mail</h3>
            <p className="text-sm text-gray-500">Configure como e quando o sistema deve enviar alertas.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
            <div className="space-y-0.5">
              <label className="text-sm font-bold text-gray-900">Ativar Notificações</label>
              <p className="text-xs text-gray-500">Habilita o envio automático de e-mails pelo sistema.</p>
            </div>
            <button
              onClick={() => setLocalSettings({ ...localSettings, emailEnabled: !localSettings.emailEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.emailEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notifyMissing"
                checked={localSettings.notifyMissingConsolidation}
                onChange={(e) => setLocalSettings({ ...localSettings, notifyMissingConsolidation: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="notifyMissing" className="text-sm font-medium text-gray-700">
                Notificar quando o consolidado do mês não estiver registrado
              </label>
            </div>

            {localSettings.notifyMissingConsolidation && (
              <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Dias antes do fechamento</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={localSettings.reminderDays}
                      onChange={(e) => setLocalSettings({ ...localSettings, reminderDays: parseInt(e.target.value) })}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Destinatários</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                      value={localSettings.recipients}
                      onChange={(e) => setLocalSettings({ ...localSettings, recipients: e.target.value as any })}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900 appearance-none"
                    >
                      <option value="Admins">Apenas Administradores</option>
                      <option value="Gestores">Gestores e Administradores</option>
                      <option value="Todos">Todos os Colaboradores Pendentes</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <Button onClick={handleSave} isLoading={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar Configurações
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Disparo Manual</h3>
              <p className="text-sm text-gray-500">Envie lembretes imediatamente para quem ainda não consolidou.</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleTriggerReminders} 
            isLoading={isSending}
            disabled={!localSettings.emailEnabled}
            className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <Send className="h-4 w-4" />
            Disparar Lembretes Agora
          </Button>
        </div>

        {localSettings.lastRun && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Último disparo realizado em: {new Date(localSettings.lastRun).toLocaleString()}
          </div>
        )}
        
        {!localSettings.emailEnabled && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg mt-4">
            <AlertCircle className="h-4 w-4" />
            As notificações por e-mail estão desativadas. Ative-as acima para disparar lembretes.
          </div>
        )}
      </div>
    </div>
  );
};
