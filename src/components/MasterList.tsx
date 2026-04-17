import { useState, useMemo } from 'react';
import { Search, Filter, Download, X, Calendar, ChevronLeft, ChevronRight, ChevronDown, BarChart3, AlertCircle, CheckCircle2, Clock, Info, Edit2, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { MasterIndicator, DEPARTMENTS, MASTER_INDICATORS_MOCK, KPIStatus, KPI, User, InventoryIndicator, KPIStatus as FaroStatus, ScoringRule } from '../types';
import { Button } from './ui/Button';
import { Input, Badge } from './ui/Input';
import { useStore } from '../store/useStore';
import { calculateKPIStatus } from '../utils/calculationEngine';

import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface MasterListProps {
  kpis: KPI[];
  users: User[];
  inventoryIndicators?: InventoryIndicator[];
  onEdit: (kpi: KPI) => void;
  onDeleteKPI: (id: string) => void;
  onDeleteInventory: (id: string) => void;
  onOpenAuditTrail: (item: { id: string, name: string }) => void;
  currentUser: User | null;
}

export const MasterList = ({ kpis, users, inventoryIndicators: propInventory, onEdit, onDeleteKPI, onDeleteInventory, onOpenAuditTrail, currentUser }: MasterListProps) => {
  const { inventoryIndicators: storeInventory } = useStore();
  const inventoryIndicators = propInventory || storeInventory;
  const [filters, setFilters] = useState({
    department: '',
    responsible: '',
    startDate: '',
    endDate: '',
    status: '' as KPIStatus | '',
  });

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
  const itemsPerPage = 8;

  const displayIndicators = useMemo(() => {
    // Map Firestore KPIs to MasterIndicator format for the table
    const mappedKpis: MasterIndicator[] = kpis.map(kpi => {
      const owner = users.find(u => u.id === kpi.ownerId);
      const actual = kpi.actual || 0;
      const target = kpi.target || 0;
      
      const status = kpi.kpiStatus || calculateKPIStatus(actual, target, kpi.polarity);

      return {
        id: kpi.id,
        code: kpi.code,
        name: kpi.name,
        department: kpi.department,
        responsible: owner ? owner.name : 'Não atribuído',
        responsibleId: kpi.ownerId,
        period: '2025.1', // Mock period
        target: kpi.unit === 'Moeda' ? `R$ ${target.toLocaleString()}` : kpi.unit === 'Porcentagem' ? `${target}%` : `${target}`,
        actual: kpi.unit === 'Moeda' ? `R$ ${actual.toLocaleString()}` : kpi.unit === 'Porcentagem' ? `${actual}%` : `${actual}`,
        status: status as any,
        category: kpi.category,
        frequency: kpi.frequency,
        scoringType: kpi.scoringType,
        rules: kpi.rules || [],
        travaZero: kpi.travaZero
      };
    });

    // Map Inventory Indicators to MasterIndicator format
    const mappedInventory: MasterIndicator[] = inventoryIndicators.map(inv => {
      const owner = users.find(u => u.id === inv.responsibleId);
      
      return {
        id: inv.id,
        code: inv.code,
        name: inv.name,
        department: owner ? owner.department : 'N/A',
        responsible: inv.responsibleName,
        responsibleId: inv.responsibleId,
        period: 'Inventário',
        target: inv.target,
        actual: 'N/A',
        status: inv.status === 'Ativo' ? 'No Prazo' : 'Alerta',
        category: inv.category,
        frequency: inv.frequency,
        travaZero: inv.travaZero
      };
    });

    // Combine both sources
    let allIndicators = [...mappedKpis];
    
    // Add inventory indicators that are not already in KPIs (by ID or Code)
    mappedInventory.forEach(inv => {
      if (!allIndicators.some(k => k.id === inv.id || k.code === inv.code)) {
        allIndicators.push(inv);
      }
    });

    // Filter by ownership if permission is set
    if (currentUser?.permissions?.onlyOwnIndicators) {
      allIndicators = allIndicators.filter(ind => {
        const kpi = kpis.find(k => k.id === ind.id);
        const inv = inventoryIndicators.find(i => i.id === ind.id);
        return (kpi && kpi.ownerId === currentUser.id) || (inv && inv.responsibleId === currentUser.id);
      });
    }

    // If still empty, use mock
    const finalIndicators = allIndicators.length > 0 ? allIndicators : MASTER_INDICATORS_MOCK;

    return finalIndicators.filter((ind) => {
      const matchesSearch = 
        ind.name.toLowerCase().includes(search.toLowerCase()) ||
        ind.code.toLowerCase().includes(search.toLowerCase());
      
      const matchesDept = !filters.department || ind.department === filters.department;
      const matchesResp = !filters.responsible || ind.responsible.toLowerCase().includes(filters.responsible.toLowerCase());
      const matchesStatus = !filters.status || ind.status === filters.status;
      
      return matchesSearch && matchesDept && matchesResp && matchesStatus;
    });
  }, [kpis, inventoryIndicators, users, search, filters]);

  const handleExport = () => {
    try {
      const fileName = `MasterList_KPIs_${new Date().toISOString().split('T')[0]}`;
      const worksheet = XLSX.utils.json_to_sheet(displayIndicators);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "KPIs");
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
      toast.success('Exportação concluída!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar dados');
    }
  };

  const totalPages = Math.ceil(displayIndicators.length / itemsPerPage);
  const currentIndicators = displayIndicators.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const clearFilters = () => {
    setFilters({
      department: '',
      responsible: '',
      startDate: '',
      endDate: '',
      status: '',
    });
    setSearch('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Superou a Meta':
        return <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-100 uppercase text-[9px] tracking-widest font-medium"><CheckCircle2 className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Atingiu a Meta':
        return <Badge variant="info" className="bg-amber-50 text-amber-600 border-amber-100 uppercase text-[9px] tracking-widest font-medium"><Clock className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Abaixo da Meta':
        return <Badge variant="danger" className="bg-rose-50 text-rose-600 border-rose-100 uppercase text-[9px] tracking-widest font-medium"><AlertCircle className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Meta Batida':
        return <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-100 uppercase text-[9px] tracking-widest font-medium"><CheckCircle2 className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'No Prazo':
        return <Badge variant="info" className="bg-slate-50 text-slate-600 border-slate-100 uppercase text-[9px] tracking-widest font-medium"><Clock className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Alerta':
        return <Badge variant="warning" className="bg-amber-50 text-amber-600 border-amber-100 uppercase text-[9px] tracking-widest font-medium"><Info className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Atrasado':
        return <Badge variant="danger" className="bg-rose-50 text-rose-600 border-rose-100 uppercase text-[9px] tracking-widest font-medium"><AlertCircle className="mr-1 h-3 w-3" /> {status}</Badge>;
      default:
        return <Badge className="bg-slate-50 text-slate-400 border-slate-100 uppercase text-[9px] tracking-widest font-medium">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Master List</h1>
            <p className="text-slate-400 text-[10px] font-light mt-1 uppercase tracking-widest">Consulta consolidada de KPIs e metas corporativas.</p>
          </div>
        </div>
        <Button variant="outline" className="!h-10 gap-2.5 border-slate-200 text-slate-500 hover:bg-slate-50 !rounded-xl px-6 text-[10px] font-medium uppercase tracking-widest shadow-sm transition-all" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          Exportar
        </Button>
      </div>

      {/* Advanced Filters Bar */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Área</label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              >
                <option value="">Todos</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Responsável</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="BUSCAR..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none transition-all"
                value={filters.responsible}
                onChange={(e) => setFilters({ ...filters, responsible: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-1 2xl:col-span-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Período</label>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Calendar className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                <input
                  type="date"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-3 text-[9px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all cursor-pointer"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                <input
                  type="date"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-3 text-[9px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all cursor-pointer"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Status</label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as KPIStatus })}
              >
                <option value="">Todos</option>
                <option value="No Prazo">No Prazo</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Meta Batida">Meta Batida</option>
                <option value="Alerta">Alerta</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
              </div>
            </div>
          </div>

          <div className="flex items-end gap-3 md:col-span-2 xl:col-span-1 2xl:col-span-1">
            <Button variant="primary" className="flex-1 !h-10 !rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-[10px] font-medium uppercase tracking-widest shadow-sm transition-all" onClick={() => setCurrentPage(1)}>
              Filtrar
            </Button>
            <Button variant="ghost" className="!h-10 !w-10 !p-0 !rounded-xl hover:bg-slate-50 border border-slate-200 transition-all" onClick={clearFilters} title="Limpar Filtros">
              <X className="h-4 w-4 text-slate-400" />
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/30 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 w-32">Código</th>
                <th className="px-8 py-5 min-w-[250px]">Indicador</th>
                <th className="px-8 py-5">Área</th>
                <th className="px-8 py-5">Responsável</th>
                <th className="px-8 py-5">Período</th>
                <th className="px-8 py-5">Meta</th>
                <th className="px-8 py-5 text-center">Trava</th>
                <th className="px-8 py-5 text-center">Realizado</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentIndicators.map((ind) => (
                <tr key={ind.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                  <td className="px-8 py-6">
                    <span className="font-mono text-[9px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200/50 whitespace-nowrap">
                      {ind.code}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-normal text-slate-700 block group-hover:text-slate-900 transition-colors truncate max-w-[300px]" title={ind.name}>{ind.name}</span>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {ind.category && (
                        <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 shrink-0">
                          {ind.category}
                        </span>
                      )}
                      {ind.frequency && (
                        <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 shrink-0">
                          {ind.frequency}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-light text-slate-500 uppercase tracking-wider whitespace-nowrap">{ind.department}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-medium text-slate-500 border border-slate-200 group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800 transition-all shrink-0">
                        {ind.responsible.charAt(0)}
                      </div>
                      <span className="text-xs font-normal text-slate-700 whitespace-nowrap">{ind.responsible}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-slate-400 font-medium text-[9px] uppercase tracking-[0.15em] whitespace-nowrap">{ind.period}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-medium text-slate-800 whitespace-nowrap">{ind.target}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {ind.travaZero !== undefined ? (
                      <span className="text-[9px] font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-tighter">
                        {ind.travaZero}%
                      </span>
                    ) : (
                      <span className="text-slate-200">-</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-xs font-medium text-slate-800 whitespace-nowrap">{ind.actual}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex justify-center">
                      {getStatusBadge(ind.status)}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      {currentUser?.accessLevel === 'Admin' && (
                        <button 
                          onClick={() => {
                            onOpenAuditTrail({ id: ind.id, name: ind.name });
                          }}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                          title="Trilha de Auditoria"
                        >
                          <Clock className="h-4 w-4" />
                        </button>
                      )}
                      {(currentUser?.accessLevel === 'Admin' || (currentUser?.permissions?.canEditResults && (!currentUser?.permissions?.onlyOwnIndicators || ind.responsibleId === currentUser.id))) && (
                        <button 
                          onClick={() => {
                            const kpi = kpis.find(k => k.id === ind.id);
                            if (kpi) onEdit(kpi);
                          }}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {(currentUser?.accessLevel === 'Admin' || (currentUser?.permissions?.canCreateIndicators && (!currentUser?.permissions?.onlyOwnIndicators || ind.responsibleId === currentUser.id))) && (
                        <button 
                          onClick={() => {
                            if (ind.period === 'Inventário') {
                              onDeleteInventory(ind.id);
                            } else {
                              onDeleteKPI(ind.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {currentIndicators.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-8 py-40 text-center">
                    <div className="flex flex-col items-center gap-6 text-slate-300">
                      <div className="h-20 w-20 rounded-[2rem] bg-slate-50 flex items-center justify-center border border-slate-100">
                        <Search className="h-10 w-10 opacity-10" />
                      </div>
                      <span className="text-[10px] font-light text-slate-400 uppercase tracking-[0.2em]">Nenhum indicador encontrado</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/20 px-10 py-6">
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">
              <span className="text-slate-800">{currentIndicators.length}</span> de <span className="text-slate-800">{displayIndicators.length}</span> itens
            </span>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="h-9 w-9 !p-0 !rounded-xl border-slate-200 transition-all disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 w-9 rounded-xl text-[10px] font-medium transition-all uppercase tracking-widest ${
                      currentPage === page 
                        ? 'bg-slate-800 text-white shadow-md scale-105' 
                        : 'text-slate-400 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="h-9 w-9 !p-0 !rounded-xl border-slate-200 transition-all disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          if (!itemToDeleteId) return;
          const isInventory = inventoryIndicators.some(i => i.id === itemToDeleteId);
          if (isInventory) {
            onDeleteInventory(itemToDeleteId);
          } else {
            onDeleteKPI(itemToDeleteId);
          }
          setIsDeleteModalOpen(false);
        }}
        title="Excluir Indicador"
        message="Tem certeza que deseja excluir este indicador"
        itemName={displayIndicators.find(i => i.id === itemToDeleteId)?.name}
      />
    </div>
  );
};
