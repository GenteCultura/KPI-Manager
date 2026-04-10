import { useState, useMemo } from 'react';
import { Search, Filter, Download, X, Calendar, ChevronLeft, ChevronRight, BarChart3, AlertCircle, CheckCircle2, Clock, Info, Edit2, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { MasterIndicator, DEPARTMENTS, MASTER_INDICATORS_MOCK, KPIStatus, KPI, User, InventoryIndicator, KPIStatus as FaroStatus } from '../types';
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
        period: '2025.1', // Mock period
        target: kpi.unit === 'Moeda' ? `R$ ${target.toLocaleString()}` : kpi.unit === 'Porcentagem' ? `${target}%` : `${target}`,
        actual: kpi.unit === 'Moeda' ? `R$ ${actual.toLocaleString()}` : kpi.unit === 'Porcentagem' ? `${actual}%` : `${actual}`,
        status: status as any,
        category: kpi.category,
        frequency: kpi.frequency,
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
        period: 'Inventário',
        target: inv.target,
        actual: 'N/A',
        status: inv.status === 'Ativo' ? 'No Prazo' : 'Alerta',
        category: inv.category,
        frequency: inv.frequency,
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
        return <Badge variant="success" className="bg-emerald-500 text-white border-none"><CheckCircle2 className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Atingiu a Meta':
        return <Badge variant="info" className="bg-amber-600 text-white border-none"><Clock className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Abaixo da Meta':
        return <Badge variant="danger" className="bg-rose-500 text-white border-none"><AlertCircle className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Meta Batida':
        return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'No Prazo':
        return <Badge variant="info"><Clock className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Alerta':
        return <Badge variant="warning"><Info className="mr-1 h-3 w-3" /> {status}</Badge>;
      case 'Atrasado':
        return <Badge variant="danger"><AlertCircle className="mr-1 h-3 w-3" /> {status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
            <BarChart3 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Todos os Indicadores</h1>
            <p className="text-slate-500 font-medium">Consulta mestre de KPIs e acompanhamento de metas corporativas.</p>
          </div>
        </div>
        <Button variant="outline" className="!h-12 gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 !rounded-2xl px-6 font-bold shadow-sm" onClick={handleExport}>
          <Download className="h-5 w-5" />
          Exportar Lista
        </Button>
      </div>

      {/* Advanced Filters Bar */}
      <div className="rounded-[2rem] border border-gray-100 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Área / Departamento</label>
            <select
              className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            >
              <option value="">Todos os Departamentos</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Responsável</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Nome do responsável..."
                className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/50 pl-12 pr-4 py-2 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                value={filters.responsible}
                onChange={(e) => setFilters({ ...filters, responsible: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-1 2xl:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Período (Início/Fim)</label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/50 pl-11 pr-3 text-xs font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/50 pl-11 pr-3 text-xs font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Status</label>
            <select
              className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as KPIStatus })}
            >
              <option value="">Todos os Status</option>
              <option value="No Prazo">No Prazo</option>
              <option value="Atrasado">Atrasado</option>
              <option value="Meta Batida">Meta Batida</option>
              <option value="Alerta">Alerta</option>
            </select>
          </div>

          <div className="flex items-end gap-3 md:col-span-2 xl:col-span-1 2xl:col-span-1">
            <Button variant="primary" className="flex-1 !h-12 !rounded-2xl font-bold shadow-lg shadow-indigo-100" onClick={() => setCurrentPage(1)}>
              Filtrar
            </Button>
            <Button variant="ghost" className="!h-12 !w-12 !p-0 !rounded-2xl hover:bg-slate-100" onClick={clearFilters} title="Limpar Filtros">
              <X className="h-6 w-6 text-slate-400" />
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-xl shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-gray-100">
              <tr>
                <th className="px-6 py-6 w-32">Código</th>
                <th className="px-6 py-6 min-w-[200px]">Indicador</th>
                <th className="px-6 py-6">Área</th>
                <th className="px-6 py-6">Responsável</th>
                <th className="px-6 py-6">Período</th>
                <th className="px-6 py-6">Meta</th>
                <th className="px-6 py-6 text-center">Realizado</th>
                <th className="px-6 py-6 text-center">Status</th>
                <th className="px-6 py-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentIndicators.map((ind) => (
                <tr key={ind.id} className="group hover:bg-indigo-50/20 transition-all duration-300">
                  <td className="px-6 py-6">
                    <span className="font-mono text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100/50 whitespace-nowrap">
                      {ind.code}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <span className="font-bold text-slate-900 block group-hover:text-indigo-600 transition-colors truncate max-w-[250px]" title={ind.name}>{ind.name}</span>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {ind.category && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 shrink-0">
                          {ind.category}
                        </span>
                      )}
                      {ind.frequency && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">
                          {ind.frequency}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-slate-500 font-medium whitespace-nowrap">{ind.department}</span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-[10px] font-black text-slate-500 border border-gray-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shrink-0">
                        {ind.responsible.charAt(0)}
                      </div>
                      <span className="text-slate-700 font-bold whitespace-nowrap">{ind.responsible}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest whitespace-nowrap">{ind.period}</span>
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-slate-900 font-black whitespace-nowrap">{ind.target}</span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className="text-indigo-600 font-black whitespace-nowrap">{ind.actual}</span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex justify-center">
                      {getStatusBadge(ind.status)}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <div className="flex justify-end gap-1">
                      {currentUser?.accessLevel === 'Admin' && (
                        <button 
                          onClick={() => {
                            onOpenAuditTrail({ id: ind.id, name: ind.name });
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm hover:shadow transition-all"
                          title="Trilha de Auditoria"
                        >
                          <Clock className="h-4 w-4" />
                        </button>
                      )}
                      {(currentUser?.accessLevel === 'Admin' || currentUser?.permissions?.canEditResults) && (
                        <button 
                          onClick={() => {
                            const kpi = kpis.find(k => k.id === ind.id);
                            if (kpi) onEdit(kpi);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm hover:shadow transition-all"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {currentUser?.accessLevel === 'Admin' && (
                        <button 
                          onClick={() => {
                            setItemToDeleteId(ind.id);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm hover:shadow transition-all"
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
                  <td colSpan={9} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <div className="h-20 w-20 rounded-3xl bg-gray-50 flex items-center justify-center shadow-inner">
                        <Search className="h-10 w-10 opacity-20" />
                      </div>
                      <span className="text-sm font-bold text-slate-400">Nenhum indicador encontrado com estes filtros.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/30 px-8 py-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Mostrando <span className="text-slate-900">{currentIndicators.length}</span> de <span className="text-slate-900">{displayIndicators.length}</span> indicadores
            </span>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="h-10 w-10 !p-0 !rounded-xl border-gray-200"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-10 w-10 rounded-xl text-xs font-black transition-all ${
                      currentPage === page 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                        : 'text-slate-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200'
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
                className="h-10 w-10 !p-0 !rounded-xl border-gray-200"
              >
                <ChevronRight className="h-5 w-5" />
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
