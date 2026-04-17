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
      <div className="bg-white rounded-2xl border border-slate-200/60 p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Bell className="h-6 w-6 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="text-lg font-normal text-slate-800 uppercase tracking-wider">Centro de Notificações</h3>
            <p className="text-xs font-light text-slate-400 uppercase tracking-widest mt-1">Gerencie como o sistema se comunica com você.</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="flex items-center justify-between p-6 rounded-xl bg-slate-50/50 border border-slate-100">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-800 uppercase tracking-widest">Ativar Notificações Globais</label>
              <p className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Habilita o envio de e-mails e alertas agendados.</p>
            </div>
            <button
              onClick={() => setLocalSettings({ ...localSettings, emailEnabled: !localSettings.emailEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.emailEnabled ? 'bg-slate-800' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="p-6 rounded-xl border border-[#EFE2DE] bg-[#F9F4F2]/30">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-[#F9F4F2] flex items-center justify-center text-[#C57B67] shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-[#C57B67] uppercase tracking-widest">Lógica Calendar-Driven</h4>
                <p className="text-[10px] font-light text-slate-500 leading-relaxed mt-2 uppercase tracking-wide">
                  A inteligência de envio de notificações foi movida para o <span className="font-medium text-slate-800">Módulo de Calendário</span>. 
                  Os gatilhos estáticos foram desativados em favor de agendamentos dinâmicos baseados em eventos, prazos e reuniões.
                </p>
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="!h-9 !rounded-lg border-[#EFE2DE] text-[#C57B67] hover:bg-[#F9F4F2] text-[9px] uppercase tracking-widest"
                    onClick={() => window.location.hash = '#calendar'}
                  >
                    Ir para o Calendário
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-slate-100 bg-slate-50/30">
            <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-6">Configurações Avançadas (Admin)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-widest">Prioridade Padrão</label>
                  <select className="bg-transparent text-[10px] font-medium text-slate-800 uppercase tracking-widest outline-none">
                    <option>Média</option>
                    <option>Alta</option>
                    <option>Crítica</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-widest">Horário de Silêncio</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-light text-slate-400">22:00 - 07:00</span>
                    <button className="h-4 w-8 rounded-full bg-slate-200 relative">
                      <span className="absolute left-1 top-1 h-2 w-2 rounded-full bg-white" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-widest">Canais Ativos</label>
                  <div className="flex gap-3">
                    <span className="px-2 py-1 rounded bg-slate-100 text-[8px] font-medium text-slate-500 uppercase tracking-tighter">Email</span>
                    <span className="px-2 py-1 rounded bg-slate-100 text-[8px] font-medium text-slate-500 uppercase tracking-tighter opacity-40">Push</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-widest">Frequência de Alerta</label>
                  <select className="bg-transparent text-[10px] font-medium text-slate-800 uppercase tracking-widest outline-none text-right">
                    <option>Imediato</option>
                    <option>Resumo Diário</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <Button onClick={handleSave} isLoading={isSaving} className="!h-11 !rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[10px] uppercase tracking-widest px-8">
              Salvar Preferências
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
