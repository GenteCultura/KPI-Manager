import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle,
  Calendar,
  User as UserIcon,
  Briefcase,
  Target,
  Weight,
  ChevronDown,
  Layout,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { InventoryIndicator, InventoryStatus, User, KPIPolarity, KPI, Team, KPICategory, KPIFrequency } from '../types';
import { toSnakeCase } from '../lib/mapping';
import { Button } from './ui/Button';
import { Input, Badge } from './ui/Input';
import { Modal } from './ui/Modal';
import { toast } from 'react-hot-toast';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createAuditLog, getChanges } from '../lib/audit';
import { createDataLog } from '../lib/dataLog';

import { DeleteConfirmationModal } from './DeleteConfirmationModal';

import { read, utils } from 'xlsx';
import { Download } from 'lucide-react';

const STATUS_OPTIONS: InventoryStatus[] = ['Em Planejamento', 'Ativo', 'Concluído', 'Cancelado'];
const POLARITY_OPTIONS: KPIPolarity[] = ['Cima', 'Baixo', 'Igual'];
const ROLE_OPTIONS = ['Analista', 'Coordenador', 'Diretor', 'Gerente', 'Especialista'];

export const IndicatorInventory = ({ 
  indicators: propIndicators, 
  kpis: propKpis, 
  currentUser,
  onOpenAuditTrail
}: { 
  indicators?: InventoryIndicator[], 
  kpis?: KPI[], 
  currentUser: User | null,
  onOpenAuditTrail?: (item: { id: string, name: string }) => void
}) => {
  const { 
    inventoryIndicators: storeIndicators, 
    users, 
    kpis: storeKpis, 
    teams,
    diretorias,
    departamentos,
    gerencias,
    servicos
  } = useStore();
  const inventoryIndicators = propIndicators || storeIndicators;
  const kpis = propKpis || storeKpis;
  const [activeTab, setActiveTab] = useState<InventoryStatus | 'Todos'>('Todos');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    diretoriaId: '',
    departmentId: '',
    gerenciaId: '',
    servicoId: '',
    teamId: '',
    responsibleId: '',
    startDate: '',
    endDate: '',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [indicatorToDeleteId, setIndicatorToDeleteId] = useState<string | null>(null);
  const [editingIndicator, setEditingIndicator] = useState<InventoryIndicator | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const filteredIndicators = useMemo(() => {
    // Map KPIs to Inventory format
    const mappedKpis: InventoryIndicator[] = kpis.map(kpi => {
      const owner = users.find(u => u.id === kpi.ownerId);
      return {
        id: kpi.id,
        code: kpi.code,
        name: kpi.name,
        type: 'Individual',
        targetRole: owner ? owner.role : 'N/A',
        responsibleId: kpi.ownerId,
        responsibleName: owner ? owner.name : 'Não atribuído',
        responsibleRole: owner ? owner.role : 'Não definido',
        diretoriaId: kpi.diretoriaId,
        departmentId: kpi.departmentId,
        gerenciaId: kpi.gerenciaId,
        servicoId: kpi.servicoId,
        teamId: kpi.teamId,
        target: kpi.target ? String(kpi.target) : '0',
        weight: 10,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        status: 'Ativo',
        polarity: kpi.polarity || 'Cima'
      };
    });

    // Combine both
    let allIndicators = [...inventoryIndicators];
    mappedKpis.forEach(k => {
      if (!allIndicators.some(i => i.id === k.id || i.code === k.code)) {
        allIndicators.push(k);
      }
    });

    // Filter by ownership if permission is set
    if (currentUser?.permissions?.onlyOwnIndicators) {
      allIndicators = allIndicators.filter(ind => ind.responsibleId === currentUser.id);
    }

    return allIndicators.filter(ind => {
      const matchesTab = activeTab === 'Todos' || ind.status === activeTab;
      const matchesSearch = ind.name.toLowerCase().includes(search.toLowerCase()) || 
                           ind.code.toLowerCase().includes(search.toLowerCase());
      
      const matchesDiretoria = !filters.diretoriaId || ind.diretoriaId === filters.diretoriaId;
      const matchesDept = !filters.departmentId || ind.departmentId === filters.departmentId;
      const matchesGerencia = !filters.gerenciaId || ind.gerenciaId === filters.gerenciaId;
      const matchesServico = !filters.servicoId || ind.servicoId === filters.servicoId;
      const matchesTeam = !filters.teamId || ind.teamId === filters.teamId;
      const matchesResp = !filters.responsibleId || ind.responsibleId === filters.responsibleId;
      
      const matchesDate = (!filters.startDate || (ind.startDate && ind.startDate >= filters.startDate)) &&
                         (!filters.endDate || (ind.endDate && ind.endDate <= filters.endDate));

      return matchesTab && matchesSearch && matchesDiretoria && matchesDept && 
             matchesGerencia && matchesServico && matchesTeam && matchesResp && matchesDate;
    });
  }, [inventoryIndicators, kpis, users, activeTab, search, filters]);

  const clearFilters = () => {
    setFilters({
      diretoriaId: '',
      departmentId: '',
      gerenciaId: '',
      servicoId: '',
      teamId: '',
      responsibleId: '',
      startDate: '',
      endDate: '',
    });
    setSearch('');
    setActiveTab('Todos');
  };

  useEffect(() => {
    console.log('IndicatorInventory: currentUser:', currentUser);
  }, [currentUser]);

  const handleSave = async (indicator: InventoryIndicator) => {
    try {
      const isUpdate = !!editingIndicator;
      const oldData = isUpdate ? editingIndicator : null;
      
      // Clean object to handle empty strings as null
      const cleaned = { ...indicator };
      Object.keys(cleaned).forEach(key => {
        if ((cleaned as any)[key] === undefined || (cleaned as any)[key] === '') {
          (cleaned as any)[key] = null;
        }
      });

      const dbData = toSnakeCase(cleaned);
      console.log('Saving indicator to Firestore:', dbData);
      await setDoc(doc(db, 'inventory_indicators', cleaned.id), dbData, { merge: true });
      
      // Audit Log
      const changes = isUpdate ? getChanges(oldData as any, indicator, [
        'name', 'target', 'weight', 'status', 'responsibleName', 'responsibleId',
        'diretoriaId', 'departmentId', 'gerenciaId', 'servicoId', 'teamId',
        'startDate', 'endDate', 'polarity', 'type', 'targetRole'
      ]) : undefined;
      await createAuditLog(
        indicator.id,
        indicator.name,
        isUpdate ? 'UPDATE' : 'CREATE',
        changes
      );

      toast.success(editingIndicator ? 'Indicador atualizado!' : 'Indicador salvo no inventário!');
      setIsModalOpen(false);
      setEditingIndicator(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `inventory_indicators/${indicator.id}`);
      toast.error('Erro ao salvar indicador');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const indicator = inventoryIndicators.find(i => i.id === id);
      
      await deleteDoc(doc(db, 'inventory_indicators', id));
      
      // Audit Log
      if (indicator) {
        await createAuditLog(
          id,
          indicator.name,
          'DELETE'
        );
      }

      toast.success('Indicador removido');
    } catch (error) {
      console.error('Error deleting indicator:', error);
      toast.error('Erro ao remover indicador');
    }
  };

  const confirmDelete = (id: string) => {
    setIndicatorToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const getStatusColor = (status: InventoryStatus) => {
    switch (status) {
      case 'Em Planejamento': return 'info';
      case 'Ativo': return 'success';
      case 'Concluído': return 'neutral';
      case 'Cancelado': return 'danger';
      default: return 'neutral';
    }
  };

  const getStatusIcon = (status: InventoryStatus) => {
    switch (status) {
      case 'Em Planejamento': return <Clock className="h-3 w-3" />;
      case 'Ativo': return <CheckCircle2 className="h-3 w-3" />;
      case 'Concluído': return <Target className="h-3 w-3" />;
      case 'Cancelado': return <XCircle className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
            <Target className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Inventário de Indicadores</h1>
            <p className="text-slate-500 font-medium">Gerencie o ciclo de vida e planejamento dos seus KPIs.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(currentUser?.accessLevel === 'Admin' || currentUser?.permissions?.canCreateIndicators) && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsBulkModalOpen(true)}
                className="h-12 rounded-2xl border-slate-200 px-6 font-bold text-slate-600 hover:bg-slate-50"
              >
                <Download className="mr-2 h-5 w-5" />
                Importar
              </Button>
              <Button 
                onClick={() => { setEditingIndicator(null); setIsModalOpen(true); }}
                className="h-12 rounded-2xl bg-indigo-600 px-6 font-bold text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50 hover:bg-indigo-700"
              >
                <Plus className="mr-2 h-5 w-5" />
                Novo Indicador
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1.5 no-scrollbar border border-slate-200/50">
          {['Todos', ...STATUS_OPTIONS].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou código..."
            className="h-12 w-full rounded-2xl border border-slate-100 bg-white pl-12 pr-4 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Active Filter Badges */}
      {(filters.diretoriaId || filters.departmentId || filters.gerenciaId || filters.teamId || filters.responsibleId || filters.startDate || filters.endDate) && (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Filtros Ativos:</span>
          {filters.diretoriaId && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold">
              Diretoria: {diretorias.find(d => d.id === filters.diretoriaId)?.name}
              <button onClick={() => setFilters({ ...filters, diretoriaId: '', departmentId: '', gerenciaId: '', teamId: '' })} className="hover:text-indigo-800"><Layout className="h-3 w-3" /></button>
            </div>
          )}
          {filters.departmentId && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold">
              Depto: {departamentos.find(d => d.id === filters.departmentId)?.name}
              <button onClick={() => setFilters({ ...filters, departmentId: '', gerenciaId: '', teamId: '' })} className="hover:text-indigo-800"><Layout className="h-3 w-3" /></button>
            </div>
          )}
          {filters.gerenciaId && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold">
              Gerência: {gerencias.find(g => g.id === filters.gerenciaId)?.name}
              <button onClick={() => setFilters({ ...filters, gerenciaId: '', teamId: '' })} className="hover:text-indigo-800"><Layout className="h-3 w-3" /></button>
            </div>
          )}
          {filters.teamId && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold">
              Time: {teams.find(t => t.id === filters.teamId)?.name}
              <button onClick={() => setFilters({ ...filters, teamId: '' })} className="hover:text-indigo-800"><Layout className="h-3 w-3" /></button>
            </div>
          )}
          <button 
            onClick={clearFilters}
            className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-colors ml-2"
          >
            Limpar Tudo
          </button>
        </div>
      )}

      {/* Advanced Filters Bar */}
      <div className="rounded-[2rem] border border-slate-100 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/40">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Diretoria</label>
            <div className="relative">
              <select
                className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                value={filters.diretoriaId}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  diretoriaId: e.target.value,
                  departmentId: '',
                  gerenciaId: '',
                  teamId: ''
                })}
              >
                <option value="">Todas as Diretorias</option>
                {diretorias.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Departamento</label>
            <div className="relative">
              <select
                className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                value={filters.departmentId}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  departmentId: e.target.value,
                  gerenciaId: '',
                  teamId: ''
                })}
              >
                <option value="">Todos os Departamentos</option>
                {departamentos
                  .filter(d => !filters.diretoriaId || d.diretoriaId === filters.diretoriaId)
                  .map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Gerência</label>
            <div className="relative">
              <select
                className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                value={filters.gerenciaId}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  gerenciaId: e.target.value,
                  teamId: ''
                })}
              >
                <option value="">Todas as Gerências</option>
                {gerencias
                  .filter(g => !filters.departmentId || g.departmentId === filters.departmentId)
                  .map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Time / Equipe</label>
            <div className="relative">
              <select
                className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                value={filters.teamId}
                onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
              >
                <option value="">Todos os Times</option>
                {teams
                  .filter(t => !filters.gerenciaId || t.gerenciaId === filters.gerenciaId)
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Responsável</label>
            <div className="relative">
              <select
                className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                value={filters.responsibleId}
                onChange={(e) => setFilters({ ...filters, responsibleId: e.target.value })}
              >
                <option value="">Todos os Responsáveis</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Período</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 pl-9 pr-2 text-[10px] font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 pl-9 pr-2 text-[10px] font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-black uppercase tracking-widest text-[10px] gap-2"
            onClick={clearFilters}
          >
            <XCircle className="h-3 w-3" />
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">Indicador</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[200px]">Responsável</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Meta</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Peso</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredIndicators.map((indicator) => (
                  <motion.tr
                    key={indicator.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group transition-colors hover:bg-indigo-50/30"
                  >
                    <td className="px-6 py-6">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 whitespace-nowrap">{indicator.code}</span>
                        <span className="text-sm font-bold text-slate-900 truncate" title={indicator.name}>{indicator.name}</span>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{indicator.type}</span>
                          {indicator.category && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 shrink-0">
                              {indicator.category}
                            </span>
                          )}
                          {indicator.frequency && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">
                              {indicator.frequency}
                            </span>
                          )}
                          {(() => {
                            let unitName = '';
                            let unitType = '';
                            if (indicator.diretoriaId) { unitName = diretorias.find(d => d.id === indicator.diretoriaId)?.name || ''; unitType = 'Diretoria'; }
                            else if (indicator.departmentId) { unitName = departamentos.find(d => d.id === indicator.departmentId)?.name || ''; unitType = 'Depto'; }
                            else if (indicator.gerenciaId) { unitName = gerencias.find(g => g.id === indicator.gerenciaId)?.name || ''; unitType = 'Gerência'; }
                            else if (indicator.servicoId) { unitName = servicos.find(s => s.id === indicator.servicoId)?.name || ''; unitType = 'Serviço'; }
                            else if (indicator.teamId) { unitName = teams.find(t => t.id === indicator.teamId)?.name || ''; unitType = 'Time'; }

                            if (!unitName) return null;
                            return (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate" title={`${unitType}: ${unitName}`}>
                                {unitType}: {unitName}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold shrink-0">
                          {indicator.responsibleName.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-900 truncate">{indicator.responsibleName}</span>
                          <span className="text-xs font-medium text-slate-500 truncate">{indicator.responsibleRole}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col whitespace-nowrap">
                        <span className="text-sm font-black text-slate-900">{indicator.target}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meta Anual</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <Badge variant="neutral" className="bg-indigo-50 text-indigo-700 font-black border-indigo-100 whitespace-nowrap">
                        {indicator.weight}%
                      </Badge>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <Badge 
                        className={`font-black uppercase tracking-widest text-[10px] whitespace-nowrap ${
                          indicator.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' :
                          indicator.status === 'Em Planejamento' ? 'bg-amber-100 text-amber-700' :
                          indicator.status === 'Concluído' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {indicator.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {currentUser?.accessLevel === 'Admin' && onOpenAuditTrail && (
                          <button
                            onClick={() => {
                              onOpenAuditTrail({ id: indicator.id, name: indicator.name });
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 border border-slate-100 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-md"
                            title="Trilha de Auditoria"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingIndicator(indicator); setIsModalOpen(true); }}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 border border-slate-100 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-md"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setIndicatorToDeleteId(indicator.id); setIsDeleteModalOpen(true); }}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 border border-slate-100 shadow-sm transition-all hover:border-rose-200 hover:text-rose-600 hover:shadow-md"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filteredIndicators.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center shadow-inner">
                        <Search className="h-10 w-10 opacity-20" />
                      </div>
                      <span className="text-sm font-bold text-slate-400">Nenhum indicador encontrado.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <InventoryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave}
        users={users}
        teams={teams}
        diretorias={diretorias}
        departamentos={departamentos}
        gerencias={gerencias}
        servicos={servicos}
        initialData={editingIndicator}
      />

      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImport={async (indicators) => {
          for (const ind of indicators) {
            await handleSave(ind);
          }
          setIsBulkModalOpen(false);
        }}
        users={users}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => indicatorToDeleteId && handleDelete(indicatorToDeleteId)}
        title="Excluir Indicador"
        message="Tem certeza que deseja excluir este indicador do inventário"
        itemName={inventoryIndicators.find(i => i.id === indicatorToDeleteId)?.name}
      />
    </div>
  );
};

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (indicators: InventoryIndicator[]) => Promise<void>;
  users: User[];
}

const BulkImportModal = ({ isOpen, onClose, onImport, users }: BulkImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet) as any[];

      const indicators: InventoryIndicator[] = jsonData.map((row, index) => {
        const responsible = users.find(u => u.name.toLowerCase() === String(row.Responsavel || '').toLowerCase());
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
        
        return {
          id: crypto.randomUUID(),
          code: row.Codigo || `INV-${year}-${random}-${index}`,
          name: row.Nome || 'Indicador Importado',
          type: (row.Tipo as any) || 'Individual',
          targetRole: row.Cargo || 'Analista',
          responsibleId: responsible?.id || 'system',
          responsibleName: responsible?.name || row.Responsavel || 'Não definido',
          responsibleRole: responsible?.role || row.Cargo || 'Não definido',
          target: String(row.Meta || '0'),
          category: (row.Categoria as KPICategory) || 'Produtividade',
          frequency: (row.Frequencia as KPIFrequency) || 'Mensal',
          weight: Number(row.Peso || 0),
          startDate: row.DataInicio || new Date().toISOString().split('T')[0],
          endDate: row.DataFim || new Date().toISOString().split('T')[0],
          status: (row.Status as InventoryStatus) || 'Em Planejamento',
          polarity: (row.Polaridade as KPIPolarity) || 'Cima'
        };
      });

      await onImport(indicators);
      toast.success(`${indicators.length} indicadores importados com sucesso!`);

      // Log the import
      await createDataLog('IMPORT', 'INVENTARIO', 'Importação de Inventário', {
        fileName: file.name,
        rowCount: indicators.length,
        status: 'SUCCESS'
      });

      onClose();
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Erro ao processar arquivo. Verifique o formato.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importação em Massa">
      <div className="space-y-6">
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
            id="bulk-file-input"
          />
          <label htmlFor="bulk-file-input" className="cursor-pointer space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Download className="h-6 w-6" />
            </div>
            <div className="text-sm font-medium text-gray-900">
              {file ? file.name : 'Clique para selecionar ou arraste o arquivo'}
            </div>
            <p className="text-xs text-gray-500">Suporta XLSX, XLS e CSV</p>
          </label>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase text-gray-400">Modelo de Colunas</h4>
          <div className="rounded-lg bg-gray-50 p-3 text-[10px] font-mono text-gray-600">
            Nome, Meta, Peso, Responsavel, Cargo, DataInicio, DataFim, Status, Polaridade, Categoria, Frequencia
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={processFile} disabled={!file || isProcessing}>
            {isProcessing ? 'Processando...' : 'Iniciar Importação'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (indicator: InventoryIndicator) => Promise<void>;
  users: User[];
  teams: Team[];
  diretorias: any[];
  departamentos: any[];
  gerencias: any[];
  servicos: any[];
  initialData?: InventoryIndicator | null;
}

const InventoryModal = ({ 
  isOpen, onClose, onSave, users, teams, 
  diretorias, departamentos, gerencias, servicos,
  initialData 
}: InventoryModalProps) => {
  const [formData, setFormData] = useState<Partial<InventoryIndicator>>({
    name: '',
    type: 'Individual',
    diretoriaId: '',
    departmentId: '',
    gerenciaId: '',
    servicoId: '',
    teamId: '',
    targetRole: ROLE_OPTIONS[0],
    responsibleId: '',
    target: '',
    category: 'Produtividade',
    frequency: 'Mensal',
    weight: 0,
    startDate: '',
    endDate: '',
    status: 'Em Planejamento',
    polarity: 'Cima'
  });

  const [unitSelection, setUnitSelection] = useState<{type: string, id: string}>({type: '', id: ''});
  const [isSaving, setIsSaving] = useState(false);

  const generatedCode = useMemo(() => {
    if (initialData) return initialData.code;
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    return `INV-${year}-${random}`;
  }, [initialData, isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      if (initialData.diretoriaId) setUnitSelection({type: 'diretoria', id: initialData.diretoriaId});
      else if (initialData.departmentId) setUnitSelection({type: 'department', id: initialData.departmentId});
      else if (initialData.gerenciaId) setUnitSelection({type: 'gerencia', id: initialData.gerenciaId});
      else if (initialData.servicoId) setUnitSelection({type: 'servico', id: initialData.servicoId});
      else if (initialData.teamId) setUnitSelection({type: 'team', id: initialData.teamId});
      else setUnitSelection({type: '', id: ''});
    } else {
      setFormData({
        name: '',
        type: 'Individual',
        diretoriaId: '',
        departmentId: '',
        gerenciaId: '',
        servicoId: '',
        teamId: '',
        targetRole: ROLE_OPTIONS[0],
        responsibleId: '',
        target: '',
        weight: 0,
        startDate: '',
        endDate: '',
        status: 'Em Planejamento',
        polarity: 'Cima'
      });
      setUnitSelection({type: '', id: ''});
    }
    setIsSaving(false);
  }, [initialData, isOpen]);

  const handleUnitChange = (value: string) => {
    if (!value) {
      setUnitSelection({type: '', id: ''});
      setFormData({
        ...formData,
        diretoriaId: '',
        departmentId: '',
        gerenciaId: '',
        servicoId: '',
        teamId: ''
      });
      return;
    }

    const [type, id] = value.split(':');
    setUnitSelection({type, id});
    
    setFormData({
      ...formData,
      diretoriaId: type === 'diretoria' ? id : '',
      departmentId: type === 'department' ? id : '',
      gerenciaId: type === 'gerencia' ? id : '',
      servicoId: type === 'servico' ? id : '',
      teamId: type === 'team' ? id : ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    const responsible = users.find(u => u.id === formData.responsibleId);
    
    try {
      await onSave({
        id: initialData?.id || crypto.randomUUID(),
        code: generatedCode,
        name: formData.name!,
        type: formData.type || 'Individual',
        diretoriaId: formData.diretoriaId || '',
        departmentId: formData.departmentId || '',
        gerenciaId: formData.gerenciaId || '',
        servicoId: formData.servicoId || '',
        teamId: formData.teamId || '',
        targetRole: formData.targetRole!,
        responsibleId: formData.responsibleId!,
        responsibleName: responsible?.name || 'Não definido',
        responsibleRole: responsible?.role || 'Não definido',
        target: formData.target!,
        category: formData.category || 'Produtividade',
        frequency: formData.frequency || 'Mensal',
        weight: formData.weight!,
        startDate: formData.startDate!,
        endDate: formData.endDate!,
        status: formData.status!,
        polarity: formData.polarity!
      });
    } catch (error) {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Indicador" : "Novo Indicador no Inventário"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Código do Indicador</label>
            <Input value={generatedCode} readOnly className="bg-gray-50 font-mono text-gray-500" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Polaridade</label>
            <select 
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={formData.polarity}
              onChange={e => setFormData({...formData, polarity: e.target.value as KPIPolarity})}
            >
              {POLARITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Tipo de Indicador</label>
            <select 
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value as any})}
            >
              <option value="Individual">Individual</option>
              <option value="Coletivo">Coletivo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Gestão Organizacional (Vínculo)</label>
            <select 
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={unitSelection.type ? `${unitSelection.type}:${unitSelection.id}` : ""}
              onChange={e => handleUnitChange(e.target.value)}
            >
              <option value="">Nenhum vínculo (Geral)</option>
              
              {diretorias.length > 0 && (
                <optgroup label="Diretorias">
                  {diretorias.map(d => <option key={d.id} value={`diretoria:${d.id}`}>{d.name}</option>)}
                </optgroup>
              )}
              
              {departamentos.length > 0 && (
                <optgroup label="Departamentos">
                  {departamentos.map(d => <option key={d.id} value={`department:${d.id}`}>{d.name}</option>)}
                </optgroup>
              )}
              
              {gerencias.length > 0 && (
                <optgroup label="Gerências">
                  {gerencias.map(g => <option key={g.id} value={`gerencia:${g.id}`}>{g.name}</option>)}
                </optgroup>
              )}
              
              {servicos.length > 0 && (
                <optgroup label="Serviços">
                  {servicos.map(s => <option key={s.id} value={`servico:${s.id}`}>{s.name}</option>)}
                </optgroup>
              )}
              
              {teams.length > 0 && (
                <optgroup label="Times">
                  {teams.map(t => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-gray-400">Nome do Indicador</label>
          <Input 
            placeholder="Ex: Volume de Vendas Regional" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Categoria do Indicador</label>
            <select 
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value as KPICategory})}
            >
              <option value="Produtividade">Produtividade</option>
              <option value="Qualidade">Qualidade</option>
              <option value="Capacidade">Capacidade</option>
              <option value="Estratégico">Estratégico</option>
              <option value="Vaidade">Vaidade</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Frequência da Meta</label>
            <select 
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={formData.frequency}
              onChange={e => setFormData({...formData, frequency: e.target.value as KPIFrequency})}
            >
              <option value="Diário">Diário</option>
              <option value="Semanal">Semanal</option>
              <option value="Mensal">Mensal</option>
              <option value="Anual">Anual</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Status Inicial</label>
            <select 
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as InventoryStatus})}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Cargo Alvo</label>
            <select 
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={formData.targetRole}
              onChange={e => setFormData({...formData, targetRole: e.target.value})}
            >
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Meta</label>
            <div className="relative">
              <Target className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                placeholder="Ex: R$ 100k ou 95%" 
                className="pl-10"
                value={formData.target}
                onChange={e => setFormData({...formData, target: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Peso na Consolidação (%)</label>
            <div className="relative">
              <Weight className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                type="number"
                placeholder="Ex: 15" 
                className="pl-10"
                value={formData.weight}
                onChange={e => setFormData({...formData, weight: Number(e.target.value)})}
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Data de Início</label>
            <Input 
              type="date"
              value={formData.startDate}
              onChange={e => setFormData({...formData, startDate: e.target.value})}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400">Data de Fim</label>
            <Input 
              type="date"
              value={formData.endDate}
              onChange={e => setFormData({...formData, endDate: e.target.value})}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-gray-400">Colaborador Responsável</label>
          <select 
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
            value={formData.responsibleId}
            onChange={e => setFormData({...formData, responsibleId: e.target.value})}
            required
          >
            <option value="">Selecione um colaborador</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} type="button" disabled={isSaving}>Cancelar</Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : (initialData ? 'Atualizar Indicador' : 'Salvar no Inventário')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
