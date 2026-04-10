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
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {logs.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum histórico encontrado.</p>
          </div>
        ) : (
          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
            {logs.map((log) => (
              <div key={log.id} className="relative flex items-start gap-6">
                <div className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-gray-100 shadow-sm z-10">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 pt-1 ml-12">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{getActionLabel(log.action)}</span>
                      <span className="text-xs text-gray-500">• por {log.changedBy}</span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  {log.changes && log.changes.length > 0 && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-2">
                      {log.changes.map((change, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 text-xs">
                          <span className="font-bold text-gray-500 uppercase tracking-wider">{getFieldLabel(change.field)}</span>
                          <div className="sm:col-span-2 flex items-center gap-2">
                            <span className="text-gray-400 line-through truncate max-w-[100px]">{String(change.oldValue)}</span>
                            <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
                            <span className="font-medium text-indigo-600 truncate">{String(change.newValue)}</span>
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
