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
  Filter,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { InventoryIndicator, InventoryStatus, User, KPIPolarity, KPI, Team, KPICategory, KPIFrequency, ScoringRule, BaseIndicator } from '../types';
import { toSnakeCase, toCamelCase } from '../lib/mapping';
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
  baseIndicators: propBaseIndicators,
  currentUser,
  onOpenAuditTrail
}: { 
  indicators?: InventoryIndicator[], 
  kpis?: KPI[], 
  baseIndicators?: BaseIndicator[],
  currentUser: User | null,
  onOpenAuditTrail?: (item: { id: string, name: string }) => void
}) => {
  const { 
    inventoryIndicators: storeIndicators, 
    users, 
    kpis: storeKpis, 
    baseIndicators: storeBaseIndicators,
    teams,
    diretorias,
    departamentos,
    gerencias,
    servicos
  } = useStore();
  const inventoryIndicators = propIndicators || storeIndicators;
  const kpis = propKpis || storeKpis;
  const baseIndicators = propBaseIndicators || storeBaseIndicators;
  const [activeTab, setActiveTab] = useState<InventoryStatus | 'Todos' | 'Templates'>('Todos');
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
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [indicatorToDeleteId, setIndicatorToDeleteId] = useState<string | null>(null);
  const [editingIndicator, setEditingIndicator] = useState<InventoryIndicator | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<BaseIndicator | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [quickAdd, setQuickAdd] = useState({
    name: '',
    responsibleId: '',
    travaZero: 70,
    rules: [{ id: crypto.randomUUID(), target: '', comparison: 'GreaterEqual' as ScoringRule['comparison'], weight: 0 }]
  });

  const handleQuickAdd = async () => {
    if (!quickAdd.name || !quickAdd.responsibleId || quickAdd.rules.some(r => !r.target)) {
      toast.error('Preencha o nome, responsável e a meta da regra');
      return;
    }

    const responsible = users.find(u => u.id === quickAdd.responsibleId);
    
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    const code = `INV-${year}-${random}`;

    const newIndicator: InventoryIndicator = {
      id: crypto.randomUUID(),
      code,
      name: quickAdd.name,
      type: 'Individual',
      targetRole: responsible?.role || 'Analista',
      responsibleId: quickAdd.responsibleId,
      responsibleName: responsible?.name || 'Não definido',
      responsibleRole: responsible?.role || 'Não definido',
      diretoriaId: responsible?.diretoriaId,
      departmentId: responsible?.departmentId,
      gerenciaId: responsible?.gerenciaId,
      servicoId: responsible?.servicoId,
      teamId: responsible?.teamId,
      target: quickAdd.rules[0].target,
      weight: quickAdd.rules.reduce((acc, r) => acc + r.weight, 0),
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      status: 'Em Planejamento',
      polarity: 'Cima',
      scoringType: 'Range',
      rules: quickAdd.rules,
      travaZero: quickAdd.travaZero
    };

    try {
      await setDoc(doc(db, 'inventory_indicators', newIndicator.id), toSnakeCase(newIndicator));
      toast.success('Indicador adicionado ao inventário!');
      setQuickAdd({
        name: '',
        responsibleId: '',
        travaZero: 70,
        rules: [{ id: crypto.randomUUID(), target: '', comparison: 'GreaterEqual', weight: 0 }]
      });
    } catch (error) {
      console.error('Error in quick add:', error);
      toast.error('Erro ao adicionar indicador');
    }
  };

  const addQuickRule = () => {
    setQuickAdd(prev => ({
      ...prev,
      rules: [...prev.rules, { id: crypto.randomUUID(), target: '', comparison: 'GreaterEqual', weight: 0 }]
    }));
  };

  const updateQuickRule = (id: string, field: keyof ScoringRule, value: any) => {
    setQuickAdd(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === id ? { ...r, [field]: value } : r)
    }));
  };

  const removeQuickRule = (id: string) => {
    if (quickAdd.rules.length <= 1) return;
    setQuickAdd(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== id)
    }));
  };

  const filteredIndicators = useMemo(() => {
    if (activeTab === 'Templates') {
      return baseIndicators.filter(tpl => {
        const matchesSearch = tpl.name.toLowerCase().includes(search.toLowerCase()) || 
                             tpl.code.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      });
    }

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
        polarity: kpi.polarity || 'Cima',
        scoringType: kpi.scoringType,
        scoringRanges: kpi.scoringRanges,
        travaZero: kpi.travaZero,
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
      
      // Hierarchical Filtering Logic
      let matchesOrg = true;

      // If a specific level is selected, it matches if the indicator's own ID matches 
      // OR if any of its sub-units resolve to that parent unit.

      // Diretoria
      if (filters.diretoriaId) {
        matchesOrg = matchesOrg && (ind.diretoriaId === filters.diretoriaId);
      }

      // Departamento
      if (filters.departmentId) {
        let indDeptId = ind.departmentId;
        if (!indDeptId && ind.gerenciaId) {
          indDeptId = gerencias.find(g => g.id === ind.gerenciaId)?.departmentId || null;
        }
        if (!indDeptId && ind.servicoId) {
          const s = servicos.find(sv => sv.id === ind.servicoId);
          if (s?.gerenciaId) {
            indDeptId = gerencias.find(g => g.id === s.gerenciaId)?.departmentId || null;
          }
        }
        if (!indDeptId && ind.teamId) {
          const t = teams.find(tm => tm.id === ind.teamId);
          if (t?.deptId) indDeptId = t.deptId;
          else if (t?.gerenciaId) indDeptId = gerencias.find(g => g.id === t.gerenciaId)?.departmentId || null;
        }
        matchesOrg = matchesOrg && (indDeptId === filters.departmentId);
      }

      // Gerência
      if (filters.gerenciaId) {
        let indGerId = ind.gerenciaId;
        if (!indGerId && ind.servicoId) {
          indGerId = servicos.find(sv => sv.id === ind.servicoId)?.gerenciaId || null;
        }
        if (!indGerId && ind.teamId) {
          const t = teams.find(tm => tm.id === ind.teamId);
          if (t?.gerenciaId) indGerId = t.gerenciaId;
          else if (t?.servicoId) indGerId = servicos.find(sv => sv.id === t.servicoId)?.gerenciaId || null;
        }
        matchesOrg = matchesOrg && (indGerId === filters.gerenciaId);
      }

      // Servico
      if (filters.servicoId) {
        let indServId = ind.servicoId;
        if (!indServId && ind.teamId) {
          indServId = teams.find(tm => tm.id === ind.teamId)?.servicoId || null;
        }
        matchesOrg = matchesOrg && (indServId === filters.servicoId);
      }

      // Team
      if (filters.teamId) {
        matchesOrg = matchesOrg && (ind.teamId === filters.teamId);
      }

      const matchesResp = !filters.responsibleId || ind.responsibleId === filters.responsibleId;
      
      const matchesDate = (!filters.startDate || (ind.startDate && ind.startDate >= filters.startDate)) &&
                         (!filters.endDate || (ind.endDate && ind.endDate <= filters.endDate));

      return matchesTab && matchesSearch && matchesOrg && matchesResp && matchesDate;
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
        'startDate', 'endDate', 'polarity', 'type', 'targetRole', 'travaZero'
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
      const isTemplate = activeTab === 'Templates';
      const collectionName = isTemplate ? 'base_indicators' : 'inventory_indicators';
      const itemToDelete = isTemplate 
        ? baseIndicators.find(b => b.id === id) 
        : inventoryIndicators.find(i => i.id === id);
      
      await deleteDoc(doc(db, collectionName, id));
      
      if (itemToDelete) {
        await createAuditLog(id, itemToDelete.name, 'DELETE');
      }

      toast.success(`${isTemplate ? 'Template' : 'Indicador'} removido`);
      setIsDeleteModalOpen(false);
      setIndicatorToDeleteId(null);
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao remover');
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
    <div className="flex flex-col gap-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <Briefcase className="h-7 w-7 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Inventário de Indicadores</h1>
            <p className="text-slate-400 text-[10px] font-light tracking-widest mt-1 uppercase">Catálogo completo de métricas e indicadores do sistema.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(currentUser?.accessLevel === 'Admin' || currentUser?.permissions?.canCreateIndicators) && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsBulkModalOpen(true)}
                className="!h-11 !rounded-xl border-slate-200 text-[10px] font-medium uppercase tracking-widest text-slate-600 hover:bg-slate-50 gap-2"
              >
                <Download className="h-4 w-4" /> Importar
              </Button>
              <Button 
                onClick={() => { setEditingIndicator(null); setIsModalOpen(true); }}
                className="!h-11 !rounded-xl bg-slate-800 text-white px-6 text-[10px] font-medium uppercase tracking-widest shadow-lg hover:bg-slate-700 transition-all gap-2"
              >
                <Plus className="h-4 w-4" /> Novo Indicador
              </Button>
              <Button 
                variant="outline"
                onClick={() => { setEditingTemplate(null); setIsTemplateModalOpen(true); }}
                className="!h-11 !rounded-xl border-slate-200 text-[10px] font-medium uppercase tracking-widest text-slate-600 hover:bg-slate-50 gap-2"
              >
                <Plus className="h-4 w-4" /> Novo Template
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1 rounded-2xl bg-slate-100/50 p-1.5 border border-slate-200/40">
          {['Todos', 'Templates', ...STATUS_OPTIONS].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`whitespace-nowrap rounded-xl px-6 py-2 text-[9px] font-medium uppercase tracking-[0.15em] transition-all ${
                activeTab === tab 
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            placeholder="BUSCAR..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[10px] font-medium uppercase tracking-widest text-slate-600 shadow-[0_2px_4px_rgba(0,0,0,0.02)] focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Advanced Filters Bar */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Diretoria</label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                value={filters.diretoriaId}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  diretoriaId: e.target.value,
                  departmentId: '',
                  gerenciaId: '',
                  teamId: ''
                })}
              >
                <option value="">Todas</option>
                {diretorias.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Departamento</label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                value={filters.departmentId}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  departmentId: e.target.value,
                  gerenciaId: '',
                  teamId: ''
                })}
              >
                <option value="">Todos</option>
                {departamentos
                  .filter(d => !filters.diretoriaId || d.diretoriaId === filters.diretoriaId)
                  .map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Gerência</label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                value={filters.gerenciaId}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  gerenciaId: e.target.value,
                  teamId: ''
                })}
              >
                <option value="">Todas</option>
                {gerencias
                  .filter(g => !filters.departmentId || g.departmentId === filters.departmentId)
                  .map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Time</label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                value={filters.teamId}
                onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
              >
                <option value="">Todos</option>
                {teams
                  .filter(t => !filters.gerenciaId || t.gerenciaId === filters.gerenciaId)
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Responsável</label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                value={filters.responsibleId}
                onChange={(e) => setFilters({ ...filters, responsibleId: e.target.value })}
              >
                <option value="">Todos</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-1 2xl:col-span-1">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Período</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Calendar className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300" />
                <input
                  type="date"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-8 pr-1 text-[9px] md:text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all cursor-pointer min-w-0"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="relative flex-1 min-w-0">
                <Calendar className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300" />
                <input
                  type="date"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-8 pr-1 text-[9px] md:text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all cursor-pointer min-w-0"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-slate-400 hover:text-slate-800 hover:bg-slate-50 text-[9px] font-medium uppercase tracking-[0.2em] gap-2.5 transition-all"
            onClick={clearFilters}
          >
            <XCircle className="h-3.5 w-3.5" />
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Quick Add Section */}
      {(currentUser?.accessLevel === 'Admin' || currentUser?.permissions?.canCreateIndicators) && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-10 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col gap-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-200/50 shadow-sm">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-normal tracking-tight text-slate-800 uppercase">Cadastro Rápido</h3>
                  <p className="text-[10px] font-light text-slate-400 uppercase tracking-widest mt-1">Adicione novos indicadores em segundos.</p>
                </div>
              </div>
              <Button 
                onClick={handleQuickAdd}
                className="bg-slate-800 text-white hover:bg-slate-700 text-[10px] font-medium uppercase tracking-widest px-8 h-12 rounded-xl shadow-md transition-all scale-100 hover:scale-[1.02] active:scale-[0.98]"
              >
                Salvar no Inventário
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="space-y-2">
                <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Nome do Indicador</label>
                <Input 
                  placeholder="EX: VOLUME DE VENDAS"
                  value={quickAdd.name}
                  onChange={e => setQuickAdd({...quickAdd, name: e.target.value})}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/30 focus:bg-white transition-all text-[10px] font-medium uppercase tracking-wider"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Responsável</label>
                <div className="relative">
                  <select 
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                    value={quickAdd.responsibleId}
                    onChange={e => setQuickAdd({...quickAdd, responsibleId: e.target.value})}
                  >
                    <option value="">SELECIONE UM COLABORADOR</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 ml-1">
                  <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Trava Zero (%)</label>
                  <div className="group relative">
                    <HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block w-56 p-3 bg-slate-800 text-white text-[9px] font-light rounded-xl shadow-2xl z-50 uppercase tracking-widest leading-relaxed">
                      Define o percentual mínimo de atingimento para pontuar. Abaixo deste valor, a pontuação é zero.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
                    </div>
                  </div>
                </div>
                <Input 
                  type="number"
                  placeholder="EX: 70"
                  value={quickAdd.travaZero}
                  onChange={e => setQuickAdd({...quickAdd, travaZero: Number(e.target.value)})}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/30 focus:bg-white transition-all text-[10px] font-medium uppercase tracking-wider"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Regras de Pontuação</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={addQuickRule}
                  className="text-slate-400 hover:text-slate-800 hover:bg-slate-50 font-medium text-[9px] uppercase tracking-[0.2em] gap-2.5 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova Regra
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {quickAdd.rules.map((rule, index) => (
                  <div key={rule.id} className="flex items-end gap-6 p-6 rounded-2xl bg-slate-50/30 border border-slate-200/50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1 space-y-2">
                      <label className="text-[8px] font-medium uppercase text-slate-400 tracking-[0.2em] ml-1">Meta</label>
                      <Input 
                        placeholder="VALOR"
                        value={rule.target}
                        onChange={e => updateQuickRule(rule.id, 'target', e.target.value)}
                        className="h-10 text-[10px] font-medium uppercase tracking-wider rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="w-48 space-y-2">
                      <label className="text-[8px] font-medium uppercase text-slate-400 tracking-[0.2em] ml-1">Condição</label>
                      <div className="relative">
                        <select 
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-4 text-[9px] font-medium uppercase tracking-widest text-slate-600 focus:border-slate-400 outline-none appearance-none pr-10"
                          value={rule.comparison}
                          onChange={e => updateQuickRule(rule.id, 'comparison', e.target.value)}
                        >
                          <option value="Greater">Maior que</option>
                          <option value="GreaterEqual">Maior ou Igual</option>
                          <option value="Less">Menor que</option>
                          <option value="LessEqual">Menor ou Igual</option>
                          <option value="Equal">Igual a</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                    <div className="w-32 space-y-2">
                      <label className="text-[8px] font-medium uppercase text-slate-400 tracking-[0.2em] ml-1">Peso</label>
                      <Input 
                        type="number"
                        placeholder="VALOR"
                        value={rule.weight}
                        onChange={e => updateQuickRule(rule.id, 'weight', Number(e.target.value))}
                        className="h-10 text-[10px] font-medium uppercase tracking-wider rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeQuickRule(rule.id)}
                      className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 w-32">Indicador</th>
                {activeTab !== 'Templates' ? (
                  <>
                    <th className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 min-w-[250px]">Responsável</th>
                    <th className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Meta</th>
                  </>
                ) : (
                  <>
                    <th className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 min-w-[250px]">Tipo / Grupo</th>
                    <th className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Configuração</th>
                  </>
                )}
                <th className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Peso</th>
                {activeTab !== 'Templates' && <th className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 text-center">Status</th>}
                <th className="px-8 py-5 text-right text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredIndicators.map((indicator) => {
                  const isTemplate = 'defaultWeight' in indicator;
                  return (
                    <motion.tr
                      key={indicator.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-8 py-6">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-slate-400 whitespace-nowrap">{isTemplate ? indicator.code : (indicator as any).code}</span>
                          <span className="text-xs font-normal text-slate-700 truncate group-hover:text-slate-900 transition-colors" title={indicator.name}>{indicator.name}</span>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 shrink-0">{isTemplate ? 'Template' : (indicator as any).type}</span>
                            {(indicator as any).category && (
                              <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 shrink-0">
                                {(indicator as any).category}
                              </span>
                            )}
                            {(indicator as any).scoringType && (
                              <div className="flex items-center gap-1">
                                <span className={`text-[8px] font-medium uppercase tracking-widest px-2 py-0.5 rounded border shrink-0 ${
                                  (indicator as any).scoringType === 'Binary' ? 'bg-slate-50 text-slate-400 border-slate-100' :
                                  (indicator as any).scoringType === 'Linear' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                                  'bg-slate-50 text-slate-600 border-slate-200'
                                }`}>
                                  {(indicator as any).scoringType === 'Binary' ? 'Binário' : (indicator as any).scoringType === 'Linear' ? 'Linear' : 'Faixas'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {isTemplate ? (
                         <>
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900">Tipo Base</span>
                              <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Modelo de Cálculo</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900">PADRÃO</span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Configurado</span>
                            </div>
                          </td>
                         </>
                      ) : (
                        <>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold shrink-0">
                                {(indicator as any).responsibleName?.charAt(0) || 'N'}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-slate-900 truncate">{(indicator as any).responsibleName}</span>
                                <span className="text-xs font-medium text-slate-500 truncate">{(indicator as any).responsibleRole}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col whitespace-nowrap">
                              <span className="text-sm font-black text-slate-900">{(indicator as any).target}</span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meta Anual</span>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-6">
                        <Badge variant="neutral" className="bg-indigo-50 text-indigo-700 font-black border-indigo-100 whitespace-nowrap">
                          {isTemplate ? indicator.defaultWeight : (indicator as any).weight}
                        </Badge>
                      </td>
                      {activeTab !== 'Templates' && (
                        <td className="px-6 py-6 text-center">
                          <Badge 
                            className={`font-black uppercase tracking-widest text-[10px] whitespace-nowrap ${
                              (indicator as any).status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' :
                              (indicator as any).status === 'Em Planejamento' ? 'bg-amber-100 text-amber-700' :
                              (indicator as any).status === 'Concluído' ? 'bg-indigo-100 text-indigo-700' :
                              'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {(indicator as any).status}
                          </Badge>
                        </td>
                      )}
                      <td className="px-6 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          {activeTab !== 'Templates' && currentUser?.accessLevel === 'Admin' && onOpenAuditTrail && (
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
                          {(currentUser?.accessLevel === 'Admin' || (currentUser?.permissions?.canCreateIndicators)) && (
                            <button
                              onClick={() => { 
                                if (isTemplate) {
                                  setEditingTemplate(indicator);
                                  setIsTemplateModalOpen(true);
                                } else {
                                  setEditingIndicator(indicator as any); 
                                  setIsModalOpen(true); 
                                }
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 border border-slate-100 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-md"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {(currentUser?.accessLevel === 'Admin' || (currentUser?.permissions?.canCreateIndicators)) && (
                            <button
                              onClick={() => { 
                                if (isTemplate) {
                                  // Add Template delete logic if needed
                                } else {
                                  confirmDelete(indicator.id);
                                }
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 border border-slate-100 shadow-sm transition-all hover:border-rose-200 hover:text-rose-600 hover:shadow-md"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
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
        baseIndicators={baseIndicators}
        initialData={editingIndicator}
      />

      <TemplateModal 
        isOpen={isTemplateModalOpen}
        onClose={() => { setIsTemplateModalOpen(false); setEditingTemplate(null); }}
        initialData={editingTemplate}
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

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: BaseIndicator | null;
}

const TemplateModal = ({ isOpen, onClose, initialData }: TemplateModalProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<BaseIndicator>>({
    code: '',
    name: '',
    defaultWeight: 10,
    polarity: 'Cima',
    scoringType: 'Linear',
    rules: [],
    travaZero: 70
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        code: `TPL-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        name: '',
        defaultWeight: 10,
        polarity: 'Cima',
        scoringType: 'Linear',
        rules: [],
        travaZero: 70
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    try {
      const id = initialData?.id || crypto.randomUUID();
      const templateData = {
        ...formData,
        id,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'base_indicators', id), toSnakeCase(templateData));
      toast.success(initialData ? 'Template atualizado' : 'Template criado');
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
    } finally {
      setIsSaving(false);
    }
  };

  const addRule = () => {
    const newRule: ScoringRule = {
      id: crypto.randomUUID(),
      target: '',
      comparison: 'GreaterEqual',
      weight: 0
    };
    setFormData(prev => ({
      ...prev,
      rules: [...(prev.rules || []), newRule]
    }));
  };

  const removeRule = (id: string) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).filter(r => r.id !== id)
    }));
  };

  const updateRule = (id: string, field: keyof ScoringRule, value: any) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).map(r => r.id === id ? { ...r, [field]: value } : r)
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Template" : "Novo Template de Indicador"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Código do Template</label>
            <Input 
              value={formData.code} 
              onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
              placeholder="EX: TPL-FIN-001"
              className="font-mono uppercase"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Polaridade Padrão</label>
            <select 
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={formData.polarity}
              onChange={e => setFormData({...formData, polarity: e.target.value as KPIPolarity})}
            >
              <option value="Cima">Maior é Melhor</option>
              <option value="Baixo">Menor é Melhor</option>
              <option value="Igual">Meta Nominal (Igual)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Nome do Indicador (Template)</label>
          <Input 
            placeholder="Ex: Absenteísmo, Volume de Produção..." 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Peso Sugerido (Padrão)</label>
            <Input 
              type="number"
              value={formData.defaultWeight}
              onChange={e => setFormData({...formData, defaultWeight: Number(e.target.value)})}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Trava Zero Padrão (%)</label>
            <Input 
              type="number"
              value={formData.travaZero}
              onChange={e => setFormData({...formData, travaZero: Number(e.target.value)})}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-gray-400 tracking-widest">Tipo de Pontuação Padrão</label>
          <select 
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
            value={formData.scoringType}
            onChange={e => setFormData({...formData, scoringType: e.target.value as any})}
          >
            <option value="Linear">Linear (Proporcional)</option>
            <option value="Binary">Binário (0 ou 100%)</option>
            <option value="Ranges">Faixas de Atingimento</option>
          </select>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Regras de Cálculo (Opcional)</h4>
            <Button type="button" variant="outline" size="sm" onClick={addRule} className="h-8 text-[10px] gap-2">
              <Plus className="h-3 w-3" /> Add Regra
            </Button>
          </div>

          <div className="space-y-2">
            {(formData.rules || []).map((rule) => (
              <div key={rule.id} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex-1">
                  <select 
                    className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-slate-900 outline-none"
                    value={rule.comparison}
                    onChange={e => updateRule(rule.id, 'comparison', e.target.value)}
                  >
                    <option value="GreaterEqual"> {'>='} </option>
                    <option value="LessEqual"> {'<='} </option>
                    <option value="Equal"> {'='} </option>
                  </select>
                </div>
                <div className="flex-[2]">
                  <Input 
                    placeholder="Meta"
                    value={rule.target}
                    onChange={e => updateRule(rule.id, 'target', e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="flex-[2]">
                  <Input 
                    type="number"
                    placeholder="Peso %"
                    value={rule.weight}
                    onChange={e => updateRule(rule.id, 'weight', Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
                <button 
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} type="button" disabled={isSaving}>Cancelar</Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando...' : (initialData ? 'Atualizar Template' : 'Criar Template')}
          </Button>
        </div>
      </form>
    </Modal>
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
          polarity: (row.Polaridade as KPIPolarity) || 'Cima',
          travaZero: Number(row.TravaZero || 70)
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
            Nome, Meta, Peso, Responsavel, Cargo, DataInicio, DataFim, Status, Polaridade, Categoria, Frequencia, TravaZero
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
  baseIndicators: BaseIndicator[];
  initialData?: InventoryIndicator | null;
}

const InventoryModal = ({ 
  isOpen, onClose, onSave, users, teams, 
  diretorias, departamentos, gerencias, servicos,
  baseIndicators,
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
    polarity: 'Cima',
    rules: [],
    travaZero: 70
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
        polarity: 'Cima',
        rules: [],
        travaZero: 70
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

  const addRule = () => {
    const newRule: ScoringRule = {
      id: crypto.randomUUID(),
      target: '',
      comparison: 'GreaterEqual',
      weight: 0
    };
    setFormData(prev => ({
      ...prev,
      rules: [...(prev.rules || []), newRule]
    }));
  };

  const removeRule = (id: string) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).filter(r => r.id !== id)
    }));
  };

  const updateRule = (id: string, field: keyof ScoringRule, value: any) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).map(r => r.id === id ? { ...r, [field]: value } : r)
    }));
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
        polarity: formData.polarity!,
        rules: formData.rules || [],
        travaZero: formData.travaZero
      });
    } catch (error) {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Indicador" : "Novo Indicador no Inventário"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {!initialData && (
          <div className="flex flex-col gap-1.5 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Usar Template Existente?</label>
            <select 
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
              onChange={(e) => {
                const tpl = baseIndicators.find(b => b.id === e.target.value);
                if (tpl) {
                  setFormData({
                    ...formData,
                    name: tpl.name,
                    weight: tpl.defaultWeight,
                    travaZero: tpl.travaZero,
                    polarity: tpl.polarity,
                    scoringType: tpl.scoringType,
                    rules: tpl.rules || []
                  });
                  toast.success(`Dados carregados do template: ${tpl.code}`);
                }
              }}
            >
              <option value="">-- SELECIONE UM TEMPLATE (OPCIONAL) --</option>
              {baseIndicators.map(tpl => (
                <option key={tpl.id} value={tpl.id}>{tpl.code} - {tpl.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Carrega automaticamente nome, peso, trava e regras.</p>
          </div>
        )}

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <label className="text-xs font-bold uppercase text-gray-400">Peso (Pontos)</label>
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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 ml-1">
              <label className="text-xs font-bold uppercase text-gray-400">Trava Zero (%)</label>
              <div className="group relative">
                <HelpCircle className="h-3 w-3 text-slate-300 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-[10px] font-medium rounded-lg shadow-xl z-50">
                  A Trava Zero define o percentual mínimo de atingimento para que o indicador comece a pontuar. Abaixo deste valor, a pontuação é zero.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
                </div>
              </div>
            </div>
            <div className="relative">
              <Target className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                type="number"
                placeholder="Ex: 70" 
                className="pl-10"
                value={formData.travaZero || ''}
                onChange={e => setFormData({...formData, travaZero: e.target.value ? Number(e.target.value) : undefined})}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h4 className="text-sm font-bold text-slate-900">Regras de Pontuação</h4>
              <p className="text-xs text-slate-500">Defina metas específicas e seus respectivos pesos</p>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addRule}
              className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </div>

          <div className="space-y-3">
            {(formData.rules || []).map((rule, index) => (
              <div key={rule.id} className="flex items-end gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in slide-in-from-top-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Meta</label>
                  <Input 
                    placeholder="Valor"
                    value={rule.target}
                    onChange={e => updateRule(rule.id, 'target', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="w-32 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Condição</label>
                  <select 
                    className="w-full h-9 rounded-lg border border-gray-300 bg-white px-2 text-xs text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                    value={rule.comparison}
                    onChange={e => updateRule(rule.id, 'comparison', e.target.value)}
                  >
                    <option value="Greater">Maior que</option>
                    <option value="GreaterEqual">Maior ou Igual</option>
                    <option value="Less">Menor que</option>
                    <option value="LessEqual">Menor ou Igual</option>
                    <option value="Equal">Igual a</option>
                  </select>
                </div>
                <div className="w-24 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Pontos</label>
                  <Input 
                    type="number"
                    placeholder="Valor"
                    value={rule.weight}
                    onChange={e => updateRule(rule.id, 'weight', Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </div>
                <button 
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {(formData.rules || []).length === 0 && (
              <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-sm text-slate-400">Nenhuma regra adicional definida.</p>
              </div>
            )}
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
