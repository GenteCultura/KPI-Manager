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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200/50">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Gestão de Usuários</h2>
            <p className="text-sm text-slate-500">Gerencie os acessos e permissões do sistema.</p>
          </div>
        </div>
        <Button onClick={onAdd} className="gap-2 shadow-lg shadow-indigo-200/50">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="card-base p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome, e-mail ou departamento..."
              className="pl-10 !rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 !rounded-xl border-slate-200">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <span className="text-sm font-medium text-slate-500">
              {filteredUsers.length} usuários
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 text-xs font-bold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-6 py-5">Nome</th>
                  <th className="px-6 py-5">Departamento</th>
                  <th className="px-6 py-5">Admissão</th>
                  <th className="px-6 py-5">Nível de Acesso</th>
                  <th className="px-6 py-5 text-center">Indicadores</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  <th className="px-6 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentUsers.map((user) => (
                   <tr key={user.id} className="group hover:bg-gray-50/50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{user.name}</span>
                        <span className="text-xs font-medium text-slate-500">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">{user.department}</span>
                        <span className="text-xs font-medium text-slate-400">{user.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-500">
                        {user.hireDate ? new Date(user.hireDate).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.accessLevel === 'Admin' ? 'danger' : user.accessLevel === 'Gestor' ? 'info' : 'neutral'} className="font-bold">
                        {user.accessLevel}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-600 bg-gray-50 py-1 px-2 rounded-lg border border-gray-100 w-fit mx-auto">
                        <Target className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="text-xs font-extrabold">{getUserIndicatorCount(user.id)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={user.status === 'Ativo' ? 'success' : 'neutral'} className="font-bold">
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        {currentUser?.accessLevel === 'Admin' && (
                          <Button variant="ghost" size="sm" onClick={() => onOpenAuditTrail(user)} className="!p-2 hover:bg-gray-100 rounded-lg" title="Trilha de Auditoria">
                            <Clock className="h-4 w-4 text-slate-500" />
                          </Button>
                        )}
                        {(currentUser?.accessLevel === 'Admin' || currentUser?.id === user.id) && (
                          <Button variant="ghost" size="sm" onClick={() => onEdit(user)} className="!p-2 hover:bg-indigo-50 rounded-lg" title="Editar">
                            <Edit2 className="h-4 w-4 text-indigo-600" />
                          </Button>
                        )}
                        {currentUser?.accessLevel === 'Admin' && user.status === 'Ativo' && (
                          <Button variant="ghost" size="sm" onClick={() => onInactivate(user.id)} className="!p-2 hover:bg-amber-50 rounded-lg" title="Inativar">
                            <Ban className="h-4 w-4 text-amber-600" />
                          </Button>
                        )}
                        {currentUser?.accessLevel === 'Admin' && (
                          <Button variant="ghost" size="sm" onClick={() => onDelete(user.id)} className="!p-2 hover:bg-red-50 rounded-lg" title="Excluir">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {currentUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-slate-300 mx-auto mb-4">
                        <Users className="h-8 w-8" />
                      </div>
                      <p className="text-slate-500 font-medium">Nenhum usuário encontrado.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/30 px-6 py-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="!rounded-lg border-slate-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="!rounded-lg border-slate-200"
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
