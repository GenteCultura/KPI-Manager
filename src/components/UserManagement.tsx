import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, Clock, Edit2, Trash2, ChevronLeft, ChevronRight, Users, Ban, Target } from 'lucide-react';
import { Button } from './ui/Button';
import { Input, Badge } from './ui/Input';
import { User, KPI, InventoryIndicator } from '../types';
import { useStore } from '../store/useStore';

interface UserManagementProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (id: string) => void;
  onInactivate: (id: string) => void;
  onOpenAuditTrail: (user: User) => void;
  onAdd: () => void;
  currentUser: User | null;
}

export const UserManagement = ({ users, onEdit, onDelete, onInactivate, onOpenAuditTrail, onAdd, currentUser }: UserManagementProps) => {
  const { kpis, inventoryIndicators } = useStore();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const getUserIndicatorCount = (userId: string) => {
    const kpiCount = kpis.filter(k => k.ownerId === userId).length;
    const inventoryCount = inventoryIndicators.filter(i => i.responsibleId === userId).length;
    return kpiCount + inventoryCount;
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.department.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm ring-1 ring-slate-200">
            <Users className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Gestão de Usuários</h2>
            <p className="text-slate-400 text-sm font-light mt-1">Gerencie os acessos e permissões do sistema.</p>
          </div>
        </div>
        <Button onClick={onAdd} className="!h-10 gap-2 !rounded-lg bg-slate-800 text-white hover:bg-slate-700 px-5 text-[10px] font-medium uppercase tracking-wider shadow-sm">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <Input
              placeholder="Buscar por nome, e-mail ou departamento..."
              className="h-10 pl-11 !rounded-xl border-slate-200 bg-slate-50/30 text-xs font-normal text-slate-600 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="!h-10 gap-2 !rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 px-4 text-[10px] font-medium uppercase tracking-wider shadow-sm">
              <Filter className="h-3.5 w-3.5" />
              Filtros
            </Button>
            <div className="h-6 w-px bg-slate-100" />
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
              {filteredUsers.length} usuários
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/30 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Departamento</th>
                  <th className="px-6 py-4">Admissão</th>
                  <th className="px-6 py-4">Nível de Acesso</th>
                  <th className="px-6 py-4 text-center">Indicadores</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentUsers.map((user) => (
                   <tr key={user.id} className="group hover:bg-slate-50/50 transition-all duration-200">
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-normal text-slate-800">{user.name}</span>
                        <span className="text-[10px] font-light text-slate-400">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-normal text-slate-700">{user.department}</span>
                        <span className="text-[10px] font-light text-slate-400">{user.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                        {user.hireDate ? new Date(user.hireDate).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`text-[9px] font-medium uppercase tracking-widest px-2 py-0.5 rounded border ${
                        user.accessLevel === 'Admin' 
                          ? 'bg-rose-50 text-rose-500 border-rose-100' 
                          : user.accessLevel === 'Gestor' 
                            ? 'bg-indigo-50 text-indigo-500 border-indigo-100' 
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {user.accessLevel}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-500 bg-slate-50 py-1 px-2.5 rounded-lg border border-slate-200/50 w-fit mx-auto">
                        <Target className="h-3 w-3 opacity-40" />
                        <span className="text-[10px] font-medium">{getUserIndicatorCount(user.id)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`text-[9px] font-medium uppercase tracking-widest px-2 py-0.5 rounded border ${
                        user.status === 'Ativo' 
                          ? 'bg-emerald-50 text-emerald-500 border-emerald-100' 
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {currentUser?.accessLevel === 'Admin' && (
                          <button onClick={() => onOpenAuditTrail(user)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Trilha de Auditoria">
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(currentUser?.accessLevel === 'Admin' || currentUser?.id === user.id) && (
                          <button onClick={() => onEdit(user)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Editar">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {currentUser?.accessLevel === 'Admin' && user.status === 'Ativo' && (
                          <button onClick={() => onInactivate(user.id)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Inativar">
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {currentUser?.accessLevel === 'Admin' && (
                          <button onClick={() => onDelete(user.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {currentUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-24 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-200 mx-auto mb-4 border border-slate-100">
                        <Users className="h-7 w-7 opacity-30" />
                      </div>
                      <p className="text-[10px] font-light text-slate-400 tracking-wide">Nenhum usuário encontrado.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 px-8 py-5">
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
                Página <span className="text-slate-800">{currentPage}</span> de <span className="text-slate-800">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="h-8 w-8 !p-0 !rounded-lg border-slate-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="h-8 w-8 !p-0 !rounded-lg border-slate-200"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
