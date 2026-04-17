import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, AlertCircle, CheckCircle2, Save, User as UserIcon, Calculator, Loader2, Target, TrendingUp, History, Eye, ArrowLeft, Filter, Calendar, ChevronDown, Layout, Upload, Users, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { BaseIndicator, SelectedIndicator, ConsolidatedIndicator, User, Area } from '../types';
import { toSnakeCase } from '../lib/mapping';
import { Button } from './ui/Button';
import { Input, Badge } from './ui/Input';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { calculateWeightedAchievement } from '../utils/calculationEngine';
import { createAuditLog, getChanges } from '../lib/audit';
import { createDataLog } from '../lib/dataLog';

import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { ConsolidationDashboard } from './ConsolidationDashboard';

export const IndicatorConsolidation = ({ users: propUsers, areas: propAreas, currentUser, isLoading = false }: { users?: User[], areas?: Area[], currentUser: User | null, isLoading?: boolean }) => {
  const { addConsolidation, consolidations, deleteConsolidation, users: storeUsers, areas: storeAreas, kpis, inventoryIndicators, diretorias } = useStore();
  const users = propUsers || storeUsers;
  const areas = propAreas || storeAreas;
  const [view, setView] = useState<'create' | 'history' | 'dashboard'>('create');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ConsolidatedIndicator | null>(null);
  
  const [selectedCollaborator, setSelectedCollaborator] = useState<User | null>(null);
  const [collaboratorSearch, setCollaboratorSearch] = useState('');
  const [isCollaboratorListOpen, setIsCollaboratorListOpen] = useState(false);
  
  const [consolidatedName, setConsolidatedName] = useState('Índice de Desempenho');
  const IDC_TARGET = 85;
  const [totalTarget, setTotalTarget] = useState(IDC_TARGET.toString());
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isOnVacation, setIsOnVacation] = useState(false);
  const [vacationStart, setVacationStart] = useState('');
  const [vacationEnd, setVacationEnd] = useState('');
  
  const [search, setSearch] = useState('');
  const [selectedIndicators, setSelectedIndicators] = useState<SelectedIndicator[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingConsolidationId, setEditingConsolidationId] = useState<string | null>(null);

  // History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyCollaboratorFilter, setHistoryCollaboratorFilter] = useState('');
  const [historyAreaFilter, setHistoryAreaFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'consolidation' | 'indicator'>('consolidation');

  // Auto-load existing consolidation when collaborator and month are selected
  React.useEffect(() => {
    if (selectedCollaborator && month && !editingConsolidationId && view === 'create') {
      const existing = consolidations.find(c => 
        c.collaboratorId === selectedCollaborator.id && 
        c.month === month
      );
      if (existing) {
        setEditingConsolidationId(existing.id);
        setConsolidatedName(existing.name);
        setTotalTarget(existing.totalTarget || '85');
        setIsOnVacation(!!existing.isOnVacation);
        setVacationStart(existing.vacationStart || '');
        setVacationEnd(existing.vacationEnd || '');
        setSelectedIndicators(existing.indicators);
        toast.success(`Carregando consolidação existente para ${month}`);
      }
    }
  }, [selectedCollaborator, month, consolidations, editingConsolidationId, view]);

  const filteredCollaborators = useMemo(() => {
    let filtered = users;
    if (currentUser?.permissions?.onlyOwnIndicators) {
      filtered = filtered.filter(u => u.id === currentUser.id);
    }
    return filtered.filter(u => 
      u.name.toLowerCase().includes(collaboratorSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(collaboratorSearch.toLowerCase())
    );
  }, [users, collaboratorSearch, currentUser]);

  const filteredHistory = useMemo(() => {
    return consolidations.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(historySearch.toLowerCase());
      const matchesCollaborator = !historyCollaboratorFilter || item.collaboratorName.toLowerCase().includes(historyCollaboratorFilter.toLowerCase());
      const matchesDiretoria = !historyAreaFilter || item.diretoriaId === historyAreaFilter;
      const matchesDate = !historyDateFilter || (item.createdAt && item.createdAt.startsWith(historyDateFilter));
      
      return matchesSearch && matchesCollaborator && matchesDiretoria && matchesDate;
    });
  }, [consolidations, historySearch, historyCollaboratorFilter, historyAreaFilter, historyDateFilter]);

  const [showAllIndicators, setShowAllIndicators] = useState(false);

  // Unified data source for indicators
  const allAvailableIndicators = useMemo(() => {
    const indicators: BaseIndicator[] = [];
    
    // Filter by selected collaborator if one is selected and 'showAll' is false
    let filteredKpis = (selectedCollaborator && !showAllIndicators)
      ? kpis.filter(k => k.ownerId === selectedCollaborator.id)
      : kpis;
    
    let filteredInventory = (selectedCollaborator && !showAllIndicators)
      ? inventoryIndicators.filter(i => i.responsibleId === selectedCollaborator.id)
      : inventoryIndicators;

    // Filter by ownership if permission is set
    if (currentUser?.permissions?.onlyOwnIndicators) {
      filteredKpis = filteredKpis.filter(k => k.ownerId === currentUser.id);
      filteredInventory = filteredInventory.filter(i => i.responsibleId === currentUser.id);
    }

    // Filter by validity date if month is selected
    if (month) {
      const selectedDate = new Date(month + '-01T00:00:00');
      const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

      filteredInventory = filteredInventory.filter(ind => {
        const start = new Date(ind.startDate);
        const end = new Date(ind.endDate);
        // Check if the indicator's validity range overlaps with the selected month
        return start <= monthEnd && end >= monthStart;
      });

      // KPIs usually don't have explicit validity dates in this model, 
      // but if they did, we would filter them here too.
    }

    // Add from KPIs (Master List)
    filteredKpis.forEach(kpi => {
      indicators.push({
        id: kpi.id,
        code: kpi.code,
        name: kpi.name,
        defaultWeight: 10, // Default weight if not specified
        polarity: kpi.polarity,
        scoringType: kpi.scoringType,
        scoringRanges: kpi.scoringRanges,
        rules: kpi.rules,
        travaZero: kpi.travaZero
      });
    });

    // Add from Inventory
    filteredInventory.forEach(inv => {
      if (!indicators.some(i => i.id === inv.id)) {
        indicators.push({
          id: inv.id,
          code: inv.code,
          name: inv.name,
          defaultWeight: inv.weight || 10,
          startDate: inv.startDate,
          endDate: inv.endDate,
          polarity: inv.polarity,
          scoringType: inv.scoringType,
          scoringRanges: inv.scoringRanges,
          rules: inv.rules,
          travaZero: inv.travaZero,
          rawTarget: inv.target
        });
      }
    });

    return indicators;
  }, [kpis, inventoryIndicators, selectedCollaborator, showAllIndicators, month]);

  const displayedSelectedIndicators = useMemo(() => {
    if (!month) return selectedIndicators;

    const selectedDate = new Date(month + '-01T00:00:00');
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

    return selectedIndicators.filter(ind => {
      // If it doesn't have validity dates (like KPIs), it's always valid
      if (!ind.startDate || !ind.endDate) return true;

      const start = new Date(ind.startDate);
      const end = new Date(ind.endDate);
      return start <= monthEnd && end >= monthStart;
    });
  }, [selectedIndicators, month]);

  const availableIndicators = useMemo(() => {
    return allAvailableIndicators.filter(ind => 
      !selectedIndicators.some(s => s.id === ind.id) &&
      (ind.name.toLowerCase().includes(search.toLowerCase()) || ind.code.toLowerCase().includes(search.toLowerCase()))
    );
  }, [search, selectedIndicators, allAvailableIndicators]);

  // Auto-populate indicators when collaborator is selected
  const handleSelectCollaborator = (user: User) => {
    setSelectedCollaborator(user);
    setIsCollaboratorListOpen(false);
    setCollaboratorSearch('');
    
    // Reset editing state when changing collaborator
    setEditingConsolidationId(null);
    setConsolidatedName('');
    setIsOnVacation(false);
    setVacationStart('');
    setVacationEnd('');

    // Find all indicators assigned to this user in both sources
    const userKpis = kpis.filter(k => k.ownerId === user.id);
    const userInv = inventoryIndicators.filter(i => i.responsibleId === user.id);

    const autoSelected: SelectedIndicator[] = [];

    userKpis.forEach(k => {
      autoSelected.push({
        id: k.id,
        code: k.code,
        name: k.name,
        defaultWeight: 10,
        weight: 10,
        actual: k.actual || 0,
        target: k.target || 100,
        polarity: k.polarity,
        scoringType: k.scoringType,
        scoringRanges: k.scoringRanges,
        rules: k.rules,
        travaZero: k.travaZero
      });
    });

    userInv.forEach(i => {
      if (!autoSelected.some(s => s.id === i.id)) {
        // Parse target if it's a string like "R$ 1.2M" or "99.5%"
        let targetVal = 100;
        if (typeof i.target === 'string') {
          const numeric = i.target.replace(/[^0-9.]/g, '');
          targetVal = parseFloat(numeric) || 100;
        }

        autoSelected.push({
          id: i.id,
          code: i.code,
          name: i.name,
          defaultWeight: i.weight || 10,
          weight: i.weight || 10,
          actual: 0,
          target: targetVal,
          polarity: i.polarity,
          scoringType: i.scoringType,
          scoringRanges: i.scoringRanges,
          rules: i.rules,
          travaZero: i.travaZero
        });
      }
    });

    if (autoSelected.length > 0) {
      // Normalize weights to sum to 100 if possible, or just set them
      const currentTotal = autoSelected.reduce((sum, s) => sum + s.weight, 0);
      if (currentTotal > 0) {
        autoSelected.forEach(s => {
          s.weight = Math.round((s.weight / currentTotal) * 100);
        });
        // Fix rounding error
        const newTotal = autoSelected.reduce((sum, s) => sum + s.weight, 0);
        if (newTotal !== 100 && autoSelected.length > 0) {
          autoSelected[0].weight += (100 - newTotal);
        }
      }
      setSelectedIndicators(autoSelected);
      toast.success(`${autoSelected.length} indicadores carregados para ${user.name}`);
    } else {
      setSelectedIndicators([]);
    }
  };

  const totalWeight = useMemo(() => {
    return displayedSelectedIndicators.reduce((sum, ind) => sum + ind.weight, 0);
  }, [displayedSelectedIndicators]);

  const currentScore = useMemo(() => {
    const tempConsolidation: ConsolidatedIndicator = {
      id: 'temp',
      collaboratorName: selectedCollaborator?.name || '',
      collaboratorId: selectedCollaborator?.id || '',
      name: consolidatedName,
      totalTarget,
      indicators: displayedSelectedIndicators,
      createdAt: new Date().toISOString(),
      month,
    };
    return calculateWeightedAchievement(tempConsolidation);
  }, [displayedSelectedIndicators, selectedCollaborator, consolidatedName, totalTarget, month]);

  const isWeightValid = totalWeight > 0;
  const canSave = currentUser?.accessLevel === 'Admin' || currentUser?.permissions?.canEditResults;

  const addIndicator = (ind: any) => {
    if (selectedIndicators.some(s => s.id === ind.id)) {
      toast.error('Este indicador já foi adicionado');
      return;
    }

    let targetVal = 100;
    if (ind.rawTarget) {
      const numeric = ind.rawTarget.replace(/[^0-9.]/g, '');
      targetVal = parseFloat(numeric) || 100;
    }

    setSelectedIndicators([...selectedIndicators, { 
      ...ind, 
      weight: ind.defaultWeight,
      actual: 0,
      target: targetVal,
      polarity: ind.polarity || 'Cima',
      scoringType: ind.scoringType || 'Binary',
      scoringRanges: ind.scoringRanges || [],
      rules: ind.rules || [],
      travaZero: ind.travaZero
    }]);
  };

  const removeIndicator = (id: string) => {
    setSelectedIndicators(selectedIndicators.filter(ind => ind.id !== id));
  };

  const updateIndicator = (id: string, updates: Partial<SelectedIndicator>) => {
    setSelectedIndicators(selectedIndicators.map(ind => 
      ind.id === id ? { ...ind, ...updates } : ind
    ));
  };

  const handleBulkImportActuals = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let count = 0;
        const newSelected = [...selectedIndicators];

        data.forEach(row => {
          const id = row.id || row.ID || row.Id;
          const actual = row.realizado || row.Realizado || row.actual || row.Actual;
          
          if (id) {
            const index = newSelected.findIndex(ind => ind.id === id || ind.code === id);
            if (index !== -1) {
              newSelected[index] = {
                ...newSelected[index],
                actual: parseFloat(actual) || 0,
                isNotAvailable: actual === 'N/D' || actual === 'ND'
              };
              count++;
            }
          }
        });

        setSelectedIndicators(newSelected);
        toast.success(`${count} valores atualizados via importação.`);

        // Log the import
        await createDataLog('IMPORT', 'CONSOLIDACAO', 'Importação de Realizados', {
          fileName: file.name,
          rowCount: count,
          status: 'SUCCESS'
        });
      } catch (error) {
        toast.error('Erro ao processar arquivo de importação.');
        console.error(error);
        
        await createDataLog('IMPORT', 'CONSOLIDACAO', 'Importação de Realizados', {
          fileName: file.name,
          status: 'ERROR',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleEdit = (item: ConsolidatedIndicator) => {
    setEditingConsolidationId(item.id);
    setConsolidatedName(item.name);
    setTotalTarget(item.totalTarget || '85');
    setMonth(item.month);
    setIsOnVacation(!!item.isOnVacation);
    setVacationStart(item.vacationStart || '');
    setVacationEnd(item.vacationEnd || '');
    
    const collaborator = users.find(u => u.id === item.collaboratorId);
    setSelectedCollaborator(collaborator || null);
    
    setSelectedIndicators(item.indicators);
    setView('create');
    toast.success(`Editando: ${item.name}`);
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error('Você não tem permissão para salvar consolidações');
      return;
    }

    if (!isWeightValid) {
      toast.error('A soma dos pesos deve ser exatamente 100');
      return;
    }

    if (!selectedCollaborator) {
      toast.error('Selecione um colaborador');
      return;
    }

    setIsSaving(true);
    const newConsolidation: ConsolidatedIndicator = {
      id: editingConsolidationId || crypto.randomUUID(),
      collaboratorName: selectedCollaborator.name,
      collaboratorId: selectedCollaborator.id,
      name: consolidatedName,
      totalTarget,
      indicators: displayedSelectedIndicators,
      diretoriaId: selectedCollaborator.diretoriaId,
      departmentId: selectedCollaborator.departmentId,
      teamId: selectedCollaborator.teamId,
      createdAt: new Date().toISOString(),
      month,
      isOnVacation,
      vacationStart: isOnVacation ? vacationStart : null,
      vacationEnd: isOnVacation ? vacationEnd : null,
    };

    // Clean object to handle any remaining undefined values
    const cleanedData = JSON.parse(JSON.stringify(newConsolidation, (key, value) => 
      value === undefined ? null : value
    ));

    try {
      const isUpdate = !!editingConsolidationId;
      const oldConsolidation = isUpdate ? consolidations.find(c => c.id === editingConsolidationId) : null;

      await setDoc(doc(db, 'consolidations', cleanedData.id), toSnakeCase(cleanedData), { merge: true });
      
      setSaveSuccess(true);
      toast.success(editingConsolidationId ? 'Consolidação atualizada com sucesso!' : 'Consolidação salva com sucesso!');
      
      // Audit Log
      const changes = isUpdate ? getChanges(oldConsolidation as any, newConsolidation as any, [
        'name', 'totalTarget', 'month', 'isOnVacation', 'vacationStart', 'vacationEnd'
      ]) : undefined;

      await createAuditLog(
        cleanedData.id,
        `Consolidação: ${cleanedData.name} (${cleanedData.collaborator_name})`,
        isUpdate ? 'UPDATE' : 'CREATE',
        changes
      );

      // Log the save
      await createDataLog('EXPORT', 'CONSOLIDACAO', editingConsolidationId ? 'Atualização de Consolidação' : 'Criação de Consolidação', {
        rowCount: displayedSelectedIndicators.length,
        status: 'SUCCESS',
        details: `Consolidação: ${consolidatedName} para ${selectedCollaborator.name}`
      });

      if (editingConsolidationId) {
        setEditingConsolidationId(null);
      }

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `consolidations/${cleanedData.id}`);
      
      await createDataLog('EXPORT', 'CONSOLIDACAO', editingConsolidationId ? 'Atualização de Consolidação' : 'Criação de Consolidação', {
        status: 'ERROR',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canSave) {
      toast.error('Você não tem permissão para excluir itens');
      return;
    }
    try {
      if (deleteType === 'consolidation') {
        await deleteDoc(doc(db, 'consolidations', id));
        
        toast.success('Consolidação excluída com sucesso!');
      } else {
        // Check if it's a KPI or Inventory Indicator
        const isInventory = inventoryIndicators.some(i => i.id === id);
        const item = isInventory ? inventoryIndicators.find(i => i.id === id) : kpis.find(k => k.id === id);
        
        const table = isInventory ? 'inventory_indicators' : 'kpis';
        await deleteDoc(doc(db, table, id));
        
        if (item) {
          await createAuditLog(id, item.name, 'DELETE');
        }
        
        toast.success('Indicador excluído do sistema!');
      }
      setIsDeleteModalOpen(false);
      setItemToDeleteId(null);
    } catch (error) {
      const table = deleteType === 'consolidation' ? 'consolidations' : (inventoryIndicators.some(i => i.id === id) ? 'inventory_indicators' : 'kpis');
      handleFirestoreError(error, OperationType.DELETE, `${table}/${id}`);
    }
  };

  const confirmDelete = (id: string) => {
    setItemToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  if (selectedHistoryItem) {
    const score = calculateWeightedAchievement(selectedHistoryItem);
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedHistoryItem(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Histórico
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100">
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedHistoryItem.name}</h2>
                <p className="text-sm text-gray-500">Visualizando detalhes da consolidação salva.</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nota Final</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-indigo-600">{score}</span>
                {score !== null && (
                  (() => {
                    let target = parseFloat(selectedHistoryItem.totalTarget);
                    if (isNaN(target) || selectedHistoryItem.totalTarget === '100%') {
                      target = IDC_TARGET;
                    }
                    if (score > target) return <Badge variant="success" className="font-bold bg-emerald-50 text-emerald-700 border-emerald-100">Superou a Meta</Badge>;
                    if (score === target) return <Badge variant="warning" className="font-bold bg-amber-50 text-amber-700 border-amber-100">Atingiu a Meta</Badge>;
                    return <Badge variant="danger" className="font-bold bg-rose-50 text-rose-700 border-rose-100">Não atingiu a Meta</Badge>;
                  })()
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Colaborador</label>
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
                <UserIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{selectedHistoryItem.collaboratorName}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Meta Total</label>
              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 border border-indigo-100">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-bold text-indigo-700">{selectedHistoryItem.totalTarget}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50/30">
            <h3 className="text-sm font-bold text-gray-900">Composição do Índice</h3>
          </div>
          <div className="p-4 space-y-4">
            {selectedHistoryItem.indicators.map((ind) => (
              <div key={ind.id} className="rounded-xl border border-gray-100 p-4 bg-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-indigo-600 font-mono">{ind.code}</span>
                    <h4 className="text-sm font-semibold text-gray-900">{ind.name}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Peso:</span>
                    <span className="text-sm font-bold text-indigo-600">{ind.weight}</span>
                  </div>
                </div>

                {ind.rules && ind.rules.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {ind.rules.map((r, i) => (
                      <span key={i} className="text-[8px] bg-amber-50 text-amber-600 px-1 rounded border border-amber-100 font-bold">
                        {r.comparison} {r.target}: {r.weight}%
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-2 border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Meta</span>
                    <span className="text-sm font-bold text-gray-700">{ind.target}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-2 border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Realizado</span>
                    <span className={`text-sm font-bold ${ind.actual >= ind.target ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {ind.actual}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div 
                      style={{ width: `${Math.min((ind.actual / (ind.target || 1)) * 100, 100)}%` }}
                      className={`h-full ${ind.actual >= ind.target ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${ind.actual >= ind.target ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {Math.round((ind.actual / (ind.target || 1)) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <Calculator className="h-7 w-7 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Gestão de Indicadores</h1>
            <p className="text-slate-400 text-[10px] font-light tracking-widest mt-1 uppercase">Consolide resultados e acompanhe o desempenho individual.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-sm">
        <button
          onClick={() => {
            setView('create');
            setEditingConsolidationId(null);
            setSelectedCollaborator(null);
            setSelectedIndicators([]);
            setConsolidatedName('Índice de Desempenho');
            setIsOnVacation(false);
          }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
            view === 'create' && !editingConsolidationId ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Plus className="h-4 w-4" /> Novo Índice
        </button>
        {editingConsolidationId && (
          <button
            onClick={() => setView('create')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
              view === 'create' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Edit2 className="h-4 w-4" /> Editando
          </button>
        )}
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
            view === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="h-4 w-4" /> Histórico
        </button>
        <button
          onClick={() => setView('dashboard')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
            view === 'dashboard' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layout className="h-4 w-4" /> Dashboard
        </button>
      </div>

      {view === 'dashboard' ? (
        <ConsolidationDashboard currentUser={currentUser} isLoading={isLoading} />
      ) : view === 'history' ? (
        <div className="flex flex-col gap-6">
          {/* History Filters */}
          <div className="card-base p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Buscar por indicador..." 
                  className="pl-10 !rounded-xl"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Filtrar colaborador..." 
                  className="pl-10 !rounded-xl"
                  value={historyCollaboratorFilter}
                  onChange={(e) => setHistoryCollaboratorFilter(e.target.value)}
                />
              </div>
              <div className="relative">
                <Layout className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select 
                  className="w-full h-10 pl-10 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none"
                  value={historyAreaFilter}
                  onChange={(e) => setHistoryAreaFilter(e.target.value)}
                >
                  <option value="">Todas as Diretorias</option>
                  {diretorias.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input 
                  type="date"
                  className="pl-10 !rounded-xl"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-6 py-5">Indicador Consolidado</th>
                    <th className="px-6 py-5">Colaborador</th>
                    <th className="px-6 py-5">Mês</th>
                    <th className="px-6 py-5">Área</th>
                    <th className="px-6 py-5">Status</th>
                    <th className="px-6 py-5 text-center">Nota Final</th>
                    <th className="px-6 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((item) => {
                    const diretoria = diretorias.find(d => d.id === item.diretoriaId);
                    return (
                      <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-sm">
                              <Calculator className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-slate-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700 font-medium">{item.collaboratorName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-bold">
                          {item.month || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 uppercase tracking-wider">
                            {diretoria ? diretoria.name : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {item.isOnVacation ? (
                            <Badge variant="warning" className="gap-1 font-bold">
                              <Calendar className="h-3 w-3" /> Férias
                            </Badge>
                          ) : (() => {
                            const score = calculateWeightedAchievement(item);
                            if (score === null) return null;
                            
                            // Parse target, handling legacy "100%" and defaulting to 85
                            let target = parseFloat(item.totalTarget);
                            if (isNaN(target) || item.totalTarget === '100%') {
                              target = IDC_TARGET;
                            }
                            
                            if (score > target) return <Badge variant="success" className="font-bold bg-emerald-50 text-emerald-700 border-emerald-100">Superou a Meta</Badge>;
                            if (score === target) return <Badge variant="warning" className="font-bold bg-amber-50 text-amber-700 border-amber-100">Atingiu a Meta</Badge>;
                            return <Badge variant="danger" className="font-bold bg-rose-50 text-rose-700 border-rose-100">Não atingiu a Meta</Badge>;
                          })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-lg font-black text-indigo-600 tracking-tight">{calculateWeightedAchievement(item)} pts</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedHistoryItem(item)}
                              className="h-9 w-9 !p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"
                              title="Visualizar"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEdit(item)}
                              className="h-9 w-9 !p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setItemToDeleteId(item.id);
                                setDeleteType('consolidation');
                                setIsDeleteModalOpen(true);
                              }}
                              className="h-9 w-9 !p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 mx-auto mb-4">
                          <History className="h-8 w-8" />
                        </div>
                        <p className="text-slate-500 font-medium">Nenhuma consolidação encontrada.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Area: Consolidated Indicator Info */}
          <div className="card-base p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-200/50">
                  <Calculator className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Consolidação de Indicadores</h2>
                  <p className="text-sm font-medium text-slate-500">Construa fórmulas visuais para índices de desempenho.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Nota Atual</span>
                  <span className="text-3xl font-black text-indigo-600 tracking-tighter leading-none">{currentScore} pts</span>
                </div>
                <div className="h-10 w-px bg-indigo-200/50 mx-2" />
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Peso (Soma)</span>
                  <span className={`text-xl font-bold tracking-tight leading-none ${isWeightValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {totalWeight}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Colaborador</label>
                <div className="relative">
                  <button 
                    onClick={() => setIsCollaboratorListOpen(!isCollaboratorListOpen)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 border border-slate-200 hover:border-indigo-400 hover:bg-white transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <UserIcon className="h-5 w-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      <span className="text-sm font-bold text-slate-900">
                        {selectedCollaborator ? selectedCollaborator.name : 'Selecionar...'}
                      </span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isCollaboratorListOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isCollaboratorListOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 right-0 top-full z-50 mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
                      >
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input 
                            placeholder="Buscar colaborador..." 
                            className="pl-10 !h-10 text-sm !rounded-xl"
                            value={collaboratorSearch}
                            onChange={(e) => setCollaboratorSearch(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                          {filteredCollaborators.map(u => (
                             <button
                               key={u.id}
                               onClick={() => handleSelectCollaborator(u)}
                               className="flex w-full flex-col items-start rounded-xl px-4 py-3 text-left hover:bg-indigo-50 transition-all duration-200 group"
                             >
                               <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600">{u.name}</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{u.department} • {u.role}</span>
                             </button>
                           ))}
                          {filteredCollaborators.length === 0 && (
                            <div className="py-8 text-center text-sm text-slate-400 font-medium italic">
                              Nenhum colaborador encontrado.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Mês de Referência</label>
                <Input 
                  type="month"
                  value={month} 
                  onChange={(e) => setMonth(e.target.value)}
                  className="!h-12 text-sm !rounded-xl !bg-slate-50 !border-slate-200 focus:!bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Nome da Consolidação</label>
                <Input 
                  value={consolidatedName} 
                  onChange={(e) => setConsolidatedName(e.target.value)}
                  className="!h-12 text-sm !rounded-xl !bg-slate-50 !border-slate-200 focus:!bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Meta Total</label>
                <div className="relative">
                  <CheckCircle2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-500 z-10" />
                  <Input 
                    value={totalTarget} 
                    onChange={(e) => setTotalTarget(e.target.value)}
                    className="!h-12 !pl-12 text-sm !rounded-xl !bg-slate-50 !border-slate-200 focus:!bg-white font-bold"
                  />
                </div>
              </div>
            </div>

          <div className="mt-6 flex flex-wrap items-end gap-6 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="vacation-check"
                checked={isOnVacation}
                onChange={(e) => setIsOnVacation(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="vacation-check" className="text-sm font-medium text-gray-700">Colaborador em Férias?</label>
            </div>
            
            {isOnVacation && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-wrap gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Início das Férias</label>
                  <Input 
                    type="date"
                    value={vacationStart}
                    onChange={(e) => setVacationStart(e.target.value)}
                    className="!h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Fim das Férias</label>
                  <Input 
                    type="date"
                    value={vacationEnd}
                    onChange={(e) => setVacationEnd(e.target.value)}
                    className="!h-8 text-xs"
                  />
                </div>
              </motion.div>
            )}
          </div>
      </div>

      {/* Main Content: Split Screen */}
      {!selectedCollaborator ? (
        <div className="flex flex-col items-center justify-center py-32 rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50">
          <div className="h-24 w-24 rounded-3xl bg-indigo-50 flex items-center justify-center mb-8 shadow-inner">
            <Users className="h-12 w-12 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">Selecione um Colaborador</h3>
          <p className="text-sm text-slate-500 max-w-md text-center font-medium leading-relaxed">
            Para iniciar a consolidação de indicadores, você deve primeiro selecionar um colaborador na lista acima. 
            Isso carregará automaticamente os indicadores sob sua responsabilidade.
          </p>
          <Button 
            variant="outline" 
            className="mt-8 gap-2 !rounded-xl !px-8 !py-6 border-slate-200 hover:border-indigo-400 hover:bg-white transition-all duration-300"
            onClick={() => setIsCollaboratorListOpen(true)}
          >
            <Search className="h-5 w-5" />
            Buscar Colaborador
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        
        {/* Left Column: Available Indicators */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col h-full card-base overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layout className="h-4 w-4 text-indigo-600" />
                  Banco de Indicadores
                </h3>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="show-all-indicators"
                    checked={showAllIndicators}
                    onChange={(e) => setShowAllIndicators(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="show-all-indicators" className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer tracking-wider">Mostrar Todos</label>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Buscar indicadores..." 
                  className="pl-10 !h-11 text-sm !rounded-xl !bg-white !border-slate-200"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 max-h-[600px] custom-scrollbar">
              <div className="space-y-3">
                {availableIndicators.map((ind) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={ind.id}
                    className="group flex items-center justify-between rounded-2xl border border-slate-50 p-4 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all duration-200"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-600 font-mono tracking-widest">{ind.code}</span>
                        {ind.scoringType && ind.scoringType !== 'Binary' && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                            {ind.scoringType === 'Linear' ? 'Linear' : 'Faixas'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-700 line-clamp-2 leading-snug">{ind.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button 
                        onClick={() => addIndicator(ind)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Adicionar à fórmula"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => {
                          setItemToDeleteId(ind.id);
                          setDeleteType('indicator');
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Excluir do sistema"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {availableIndicators.length === 0 && (
                  <div className="py-20 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300 mx-auto mb-4">
                      <Calculator className="h-6 w-6" />
                    </div>
                    <p className="text-slate-400 text-xs font-medium italic">Nenhum indicador disponível.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Indicators / Formula Builder */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex flex-col h-full card-base overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-600" />
                Indicadores Selecionados / Fórmula
              </h3>
              <div className="flex items-center gap-3">
                <div className="group relative">
                  <label className="flex items-center gap-2 cursor-pointer rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all duration-200 shadow-sm">
                    <Upload className="h-4 w-4" />
                    Importar Realizados
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleBulkImportActuals}
                    />
                  </label>
                  
                  {/* Import Help Box */}
                  <div className="absolute right-0 top-full z-50 mt-3 hidden w-72 rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl group-hover:block animate-in fade-in slide-in-from-top-2">
                    <h4 className="mb-3 text-xs font-bold text-slate-900 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-indigo-500" />
                      Instruções de Importação
                    </h4>
                    <p className="mb-4 text-[10px] text-slate-500 font-medium leading-relaxed">
                      O arquivo deve conter as seguintes colunas (cabeçalhos):
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-3 text-[10px] font-bold text-slate-700">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200" />
                        <span><strong>id</strong> ou <strong>ID</strong> (Código do indicador)</span>
                      </li>
                      <li className="flex items-center gap-3 text-[10px] font-bold text-slate-700">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200" />
                        <span><strong>realizado</strong> ou <strong>Realizado</strong> (Valor numérico absoluto)</span>
                      </li>
                    </ul>
                    <div className="mt-4 rounded-xl bg-indigo-50 p-3 text-[10px] font-bold text-indigo-700 border border-indigo-100">
                      Dica: Use "N/D" na coluna de realizado para marcar como indisponível.
                    </div>
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-200 mx-1" />
                <Button 
                  onClick={handleSave} 
                  disabled={!isWeightValid || !selectedCollaborator || selectedIndicators.length === 0}
                  className="!rounded-xl shadow-lg shadow-indigo-200/50 !px-6"
                >
                  Salvar
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[500px] custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {displayedSelectedIndicators.map((ind) => (
                  <motion.div
                    key={ind.id}
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -10 }}
                    className="relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-sm">
                            <Target className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-widest uppercase">
                                {ind.code}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {ind.rules && ind.rules.length > 0 ? 'Regras' : (ind.scoringType === 'Binary' ? 'Binário' : ind.scoringType === 'Linear' ? 'Linear' : 'Faixas')}
                              </span>
                              {ind.travaZero !== undefined && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                  Trava: {ind.travaZero}%
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">{ind.name}</h4>
                            {ind.rules && ind.rules.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ind.rules.map((r, i) => (
                                  <span key={i} className="text-[8px] bg-amber-50 text-amber-600 px-1 rounded border border-amber-100 font-bold">
                                    {r.comparison} {r.target}: {r.weight} pts
                                  </span>
                                ))}
                              </div>
                            ) : ind.scoringType === 'Range' && ind.scoringRanges && ind.scoringRanges.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ind.scoringRanges.map((r, i) => (
                                  <span key={i} className="text-[8px] bg-indigo-50 text-indigo-600 px-1 rounded border border-indigo-100 font-bold">
                                    {r.min}-{r.max}%: {r.points} pts
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peso (Pontos)</label>
                            <input 
                              type="number"
                              value={ind.weight}
                              onChange={(e) => updateIndicator(ind.id, { weight: parseInt(e.target.value) || 0 })}
                              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-indigo-600 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Target className="h-3 w-3 text-indigo-500" /> Meta
                            </label>
                            <input 
                              type="number"
                              value={ind.target}
                              onChange={(e) => updateIndicator(ind.id, { target: parseFloat(e.target.value) || 0 })}
                              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-indigo-500" /> Realizado
                              <span className="ml-1 text-[8px] lowercase font-normal">(valor absoluto)</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <select 
                                value={ind.isNotAvailable ? 'nd' : 'value'}
                                onChange={(e) => updateIndicator(ind.id, { isNotAvailable: e.target.value === 'nd' })}
                                className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                              >
                                <option value="value">Valor</option>
                                <option value="nd">N/D</option>
                              </select>
                              {!ind.isNotAvailable ? (
                                <input 
                                  type="number"
                                  value={ind.actual}
                                  onChange={(e) => updateIndicator(ind.id, { actual: parseFloat(e.target.value) || 0 })}
                                  className={`w-full h-10 rounded-xl border px-4 text-sm font-black focus:outline-none focus:ring-4 transition-all ${
                                    ind.actual >= ind.target 
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 focus:border-emerald-500 focus:ring-emerald-500/10' 
                                      : 'border-slate-200 bg-white text-slate-700 focus:border-indigo-500 focus:ring-indigo-500/10'
                                  }`}
                                />
                              ) : (
                                <div className="flex-1 h-10 flex items-center px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-400">
                                  Não Disponível
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-1">
                          <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((ind.actual / (ind.target || 1)) * 100, 100)}%` }}
                              className={`h-full rounded-full ${ind.actual >= ind.target ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]'}`}
                            />
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${ind.actual >= ind.target ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {ind.actual >= ind.target ? 'Meta Atingida' : 'Em andamento'}
                          </span>
                        </div>
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeIndicator(ind.id)}
                        className="h-10 w-10 !p-0 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {displayedSelectedIndicators.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-6 shadow-inner">
                    <Calculator className="h-10 w-10 text-slate-300" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Nenhum indicador selecionado</h4>
                  <p className="text-sm text-slate-500 max-w-[280px] font-medium leading-relaxed">
                    Adicione indicadores da lista à esquerda para começar a construir a fórmula para este mês.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/30">
              <div className="flex flex-col gap-4">
                {selectedIndicators.length > 0 && (
                  <div className="mb-4 p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo de Performance</h4>
                      <Badge variant={currentScore >= parseFloat(totalTarget || '85') ? 'success' : 'warning'} className="text-[9px] font-black uppercase tracking-widest">
                        {currentScore >= parseFloat(totalTarget || '85') ? 'Meta Atingida' : 'Abaixo da Meta'}
                      </Badge>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pontuação Atual</span>
                        <span className={`text-3xl font-black ${currentScore >= parseFloat(totalTarget || '85') ? 'text-emerald-600' : 'text-indigo-600'}`}>
                          {currentScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Meta do Mês</span>
                        <span className="text-lg font-black text-slate-700">{totalTarget}%</span>
                      </div>
                    </div>
                    <div className="mt-4 h-2 w-full rounded-full bg-slate-50 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((currentScore / parseFloat(totalTarget || '85')) * 100, 100)}%` }}
                        className={`h-full rounded-full ${currentScore >= parseFloat(totalTarget || '85') ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      />
                    </div>
                  </div>
                )}

                {!canSave && (
                  <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-700 border border-amber-100 shadow-sm shadow-amber-100/50">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                    <span>Você não tem permissão para salvar consolidações.</span>
                  </div>
                )}
                {canSave && !isWeightValid && (
                  <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-700 border border-red-100 shadow-sm shadow-red-100/50">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                    <span>A soma dos pesos deve ser maior que zero.</span>
                  </div>
                )}
                {canSave && isWeightValid && (
                  <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-700 border border-emerald-100 shadow-sm shadow-emerald-100/50">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    <span>Configuração de pesos válida! Você já pode salvar a consolidação.</span>
                  </div>
                )}
                <Button 
                  className="w-full !h-14 !rounded-2xl gap-3 shadow-xl shadow-indigo-200/50 text-base font-bold" 
                  disabled={!isWeightValid || isSaving || !canSave}
                  onClick={handleSave}
                >
                  {isSaving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : saveSuccess ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {isSaving ? 'Salvando...' : saveSuccess ? 'Consolidação Salva!' : 'Salvar Consolidação'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  )}

  <DeleteConfirmationModal
    isOpen={isDeleteModalOpen}
    onClose={() => setIsDeleteModalOpen(false)}
    onConfirm={() => itemToDeleteId && handleDelete(itemToDeleteId)}
    title={deleteType === 'consolidation' ? "Excluir Consolidação" : "Excluir Indicador"}
    message={deleteType === 'consolidation' ? "Tem certeza que deseja excluir esta consolidação" : "Tem certeza que deseja excluir este indicador do sistema"}
    itemName={
      deleteType === 'consolidation' 
        ? consolidations.find(c => c.id === itemToDeleteId)?.name 
        : [...kpis, ...inventoryIndicators].find(i => i.id === itemToDeleteId)?.name
    }
  />
</div>
);
};
