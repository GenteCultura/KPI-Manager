import React from 'react';
import { Modal } from './ui/Modal';
import { AuditLog } from '../types';
import { Clock, User as UserIcon, ArrowRight, Plus, Edit2, Trash2 } from 'lucide-react';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  logs: AuditLog[];
}

export const AuditTrailModal = ({ isOpen, onClose, title, logs }: AuditTrailModalProps) => {
  const getActionIcon = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE': return <Plus className="h-4 w-4 text-emerald-600" />;
      case 'UPDATE': return <Edit2 className="h-4 w-4 text-indigo-600" />;
      case 'DELETE': return <Trash2 className="h-4 w-4 text-red-600" />;
    }
  };

  const getActionLabel = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE': return 'Criação';
      case 'UPDATE': return 'Atualização';
      case 'DELETE': return 'Exclusão';
    }
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      name: 'Nome',
      target: 'Meta',
      weight: 'Peso',
      status: 'Status',
      responsibleName: 'Responsável',
      responsibleId: 'ID Responsável',
      diretoriaId: 'Diretoria',
      departmentId: 'Departamento',
      gerenciaId: 'Gerência',
      servicoId: 'Serviço',
      teamId: 'Time',
      startDate: 'Data Início',
      endDate: 'Data Fim',
      polarity: 'Polaridade',
      type: 'Tipo',
      targetRole: 'Cargo Alvo',
      code: 'Código',
      department: 'Departamento',
      description: 'Descrição',
      unit: 'Unidade',
      frequency: 'Frequência',
      ownerId: 'Proprietário',
      actual: 'Valor Atual'
    };
    return labels[field] || field;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Trilha de Auditoria: ${title}`}>
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-200 mx-auto mb-4 border border-slate-100">
              <Clock className="h-7 w-7 opacity-30" />
            </div>
            <p className="text-[10px] font-light text-slate-400 tracking-wide">Nenhum histórico encontrado.</p>
          </div>
        ) : (
          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="relative flex items-start gap-6">
                <div className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm z-10">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 pt-1 ml-12">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-800 uppercase tracking-widest">{getActionLabel(log.action)}</span>
                      <span className="text-[10px] font-light text-slate-400">por {log.changedBy}</span>
                    </div>
                    <span className="text-[9px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase tracking-tighter">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  {log.changes && log.changes.length > 0 && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-4 space-y-3">
                      {log.changes.map((change, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 text-[10px]">
                          <span className="font-medium text-slate-400 uppercase tracking-[0.15em]">{getFieldLabel(change.field)}</span>
                          <div className="sm:col-span-2 flex items-center gap-3">
                            <span className="text-slate-300 line-through truncate max-w-[120px] font-light">{String(change.oldValue)}</span>
                            <ArrowRight className="h-3 w-3 text-slate-200 shrink-0" />
                            <span className="font-normal text-slate-700 truncate bg-white px-2 py-0.5 rounded border border-slate-100">{String(change.newValue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
