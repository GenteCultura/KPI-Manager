import React, { useState } from 'react';
import { Download, Calendar, Filter, CheckSquare, FileText, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { Button } from './ui/Button';
import { KPI, User, ConsolidatedIndicator, InventoryIndicator, DEPARTMENTS } from '../types';
import { useStore } from '../store/useStore';
import { createDataLog } from '../lib/dataLog';
import { calculateWeightedAchievement } from '../utils/calculationEngine';

// Add type definition for jsPDF with autotable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const EXPORT_COLUMNS = [
  { id: 'code', label: 'Código do Indicador' },
  { id: 'name', label: 'Nome' },
  { id: 'department', label: 'Áreas' },
  { id: 'responsible', label: 'Responsável' },
  { id: 'description', label: 'Fórmulas de Cálculo' },
  { id: 'target', label: 'Metas' },
  { id: 'actual', label: 'Valores Realizados' },
  { id: 'ownerId', label: 'ID do Responsável' },
];

type ReportType = 'KPIs' | 'Users' | 'Consolidations' | 'Inventory' | 'Results';

interface ExportCenterProps {
  kpis?: KPI[];
  users?: User[];
  consolidations?: ConsolidatedIndicator[];
  inventoryIndicators?: InventoryIndicator[];
}

export const ExportCenter = ({ kpis: propKpis, users: propUsers, consolidations: propConsolidations, inventoryIndicators: propInventory }: ExportCenterProps) => {
  const { 
    kpis: storeKpis, 
    users: storeUsers, 
    consolidations: storeConsolidations, 
    inventoryIndicators: storeInventory,
    diretorias: storeDiretorias,
    teams: storeTeams,
    departamentos: storeDepartamentos,
    gerencias: storeGerencias,
    servicos: storeServicos
  } = useStore();
  const kpis = propKpis || storeKpis;
  const users = propUsers || storeUsers;
  const consolidations = propConsolidations || storeConsolidations;
  const inventoryIndicators = propInventory || storeInventory;
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState<ReportType>('KPIs');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDiretorias, setSelectedDiretorias] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedGerencias, setSelectedGerencias] = useState<string[]>([]);
  const [selectedServicos, setSelectedServicos] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [scopeTab, setScopeTab] = useState<'Diretoria' | 'Departamento' | 'Gerência' | 'Serviço' | 'Equipe'>('Departamento');

  const getFilteredData = () => {
    let rawData: any[] = [];
    if (reportType === 'KPIs') rawData = kpis;
    else if (reportType === 'Users') rawData = users;
    else if (reportType === 'Consolidations') {
      rawData = consolidations.map(c => {
        const collaborator = users.find(u => u.id === c.collaboratorId);
        return {
          ...c,
          department: collaborator?.department || '',
          diretoria: storeDiretorias.find(d => d.id === collaborator?.diretoriaId)?.name || '',
          team: storeTeams.find(t => t.id === collaborator?.teamId)?.name || ''
        };
      });
    }
    else if (reportType === 'Inventory') rawData = inventoryIndicators;
    else if (reportType === 'Results') {
      consolidations.forEach(c => {
        const collaborator = users.find(u => u.id === c.collaboratorId);
        c.indicators.forEach(ind => {
          rawData.push({
            ...ind,
            collaboratorName: c.collaboratorName,
            month: c.month,
            achievement: ind.target > 0 ? Math.round((ind.actual / ind.target) * 100) : 0,
            department: collaborator?.department || '',
            diretoria: storeDiretorias.find(d => d.id === collaborator?.diretoriaId)?.name || '',
            team: storeTeams.find(t => t.id === collaborator?.teamId)?.name || ''
          });
        });
      });
    }

    // Filter data based on selection (department and date)
    return rawData.filter(item => {
      // Date filtering
      if (startDate || endDate) {
        const itemDateStr = item.month || (item.timestamp ? item.timestamp.split('T')[0] : null);
        if (itemDateStr) {
          const itemDate = new Date(itemDateStr + (itemDateStr.length === 7 ? '-01' : ''));
          if (startDate) {
            const start = new Date(startDate);
            if (itemDate < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            if (itemDate > end) return false;
          }
        }
      }

      // Scope filtering (Hierarchical)
      if (selectedDiretorias.length > 0 || selectedDepts.length > 0 || selectedGerencias.length > 0 || selectedServicos.length > 0 || selectedTeams.length > 0) {
        const matchesScope = () => {
          // IDs from item
          const itmDirId = item.diretoriaId;
          const itmDeptId = item.departmentId;
          const itmGerId = item.gerenciaId;
          const itmServId = item.servicoId;
          const itmTeamId = item.teamId;

          // 1. Check Diretoria
          if (selectedDiretorias.length > 0) {
            if (itmDirId && selectedDiretorias.includes(itmDirId)) return true;
          }

          // 2. Check Departamento (including children)
          if (selectedDepts.length > 0) {
            let deptIdsOfItem = new Set<string>();
            if (itmDeptId) deptIdsOfItem.add(itmDeptId);
            if (itmGerId) {
              const g = storeGerencias.find(sg => sg.id === itmGerId);
              if (g?.departmentId) deptIdsOfItem.add(g.departmentId);
            }
            if (itmServId) {
              const s = storeServicos.find(ss => ss.id === itmServId);
              if (s?.gerenciaId) {
                const g = storeGerencias.find(sg => sg.id === s.gerenciaId);
                if (g?.departmentId) deptIdsOfItem.add(g.departmentId);
              }
            }
            if (itmTeamId) {
              const t = storeTeams.find(st => st.id === itmTeamId);
              if (t?.deptId) deptIdsOfItem.add(t.deptId);
              if (t?.gerenciaId) {
                const g = storeGerencias.find(sg => sg.id === t.gerenciaId);
                if (g?.departmentId) deptIdsOfItem.add(g.departmentId);
              }
            }
            // Check if any of these dept IDs match the selected department names (using backward compatibility or checking matched store items)
            for (const dId of Array.from(deptIdsOfItem)) {
              const d = storeDepartamentos.find(sd => sd.id === dId);
              if (d && selectedDepts.includes(d.name)) return true;
            }
          }

          // 3. Check Gerência
          if (selectedGerencias.length > 0) {
            let gerIdsOfItem = new Set<string>();
            if (itmGerId) gerIdsOfItem.add(itmGerId);
            if (itmServId) {
              const s = storeServicos.find(ss => ss.id === itmServId);
              if (s?.gerenciaId) gerIdsOfItem.add(s.gerenciaId);
            }
            if (itmTeamId) {
              const t = storeTeams.find(st => st.id === itmTeamId);
              if (t?.gerenciaId) gerIdsOfItem.add(t.gerenciaId);
            }
            for (const gId of Array.from(gerIdsOfItem)) {
              const g = storeGerencias.find(sg => sg.id === gId);
              if (g && selectedGerencias.includes(g.name)) return true;
            }
          }

          // 4. Check Serviço
          if (selectedServicos.length > 0) {
            let servIdsOfItem = new Set<string>();
            if (itmServId) servIdsOfItem.add(itmServId);
            if (itmTeamId) {
              const t = storeTeams.find(st => st.id === itmTeamId);
              if (t?.servicoId) servIdsOfItem.add(t.servicoId);
            }
            for (const sId of Array.from(servIdsOfItem)) {
              const s = storeServicos.find(ss => ss.id === sId);
              if (s && selectedServicos.includes(s.name)) return true;
            }
          }

          // 5. Check Equipe
          if (selectedTeams.length > 0) {
            if (itmTeamId) {
              const t = storeTeams.find(st => st.id === itmTeamId);
              if (t && selectedTeams.includes(t.name)) return true;
            }
          }

          return false;
        };

        if (!matchesScope()) return false;
      }
      return true;
    });
  };

  const getMappedData = (dataToExport: any[]) => {
    const columns = getColumnsForReport(reportType);
    return dataToExport.map(item => {
      const row: any = {};
      selectedColumns.forEach(colId => {
        const col = columns.find(c => c.id === colId);
        if (!col) return;

        if (colId === 'responsible' && reportType === 'KPIs') {
          const owner = users.find(u => u.id === item.ownerId);
          row[col.label] = owner ? owner.name : 'N/A';
        } else if (colId === 'responsibleName' && reportType === 'Inventory') {
          const owner = users.find(u => u.id === item.responsibleId);
          row[col.label] = owner ? owner.name : 'N/A';
        } else if (colId === 'points' && reportType === 'Consolidations') {
          row[col.label] = calculateWeightedAchievement(item);
        } else if (colId === 'status' && reportType === 'Consolidations') {
          const score = calculateWeightedAchievement(item);
          const target = parseFloat(item.totalTarget || '85');
          row[col.label] = score >= target ? 'Superou/Atingiu' : 'Abaixo da Meta';
        } else if (colId === 'diretoria' && (reportType === 'Consolidations' || reportType === 'Results')) {
          const collaborator = users.find(u => u.id === (item.collaboratorId || item.ownerId));
          row[col.label] = storeDiretorias.find(d => d.id === collaborator?.diretoriaId)?.name || '';
        } else if (colId === 'team' && (reportType === 'Consolidations' || reportType === 'Results')) {
          const collaborator = users.find(u => u.id === (item.collaboratorId || item.ownerId));
          row[col.label] = storeTeams.find(t => t.id === collaborator?.teamId)?.name || '';
        } else {
          row[col.label] = (item as any)[colId] || '';
        }
      });
      return row;
    });
  };
  
  const getColumnsForReport = (type: ReportType) => {
    switch (type) {
      case 'KPIs':
        return [
          { id: 'code', label: 'Código' },
          { id: 'name', label: 'Nome' },
          { id: 'department', label: 'Departamento' },
          { id: 'responsible', label: 'Responsável' },
          { id: 'target', label: 'Meta' },
          { id: 'travaZero', label: 'Trava Zero (%)' },
          { id: 'actual', label: 'Realizado' },
          { id: 'unit', label: 'Unidade' },
        ];
      case 'Users':
        return [
          { id: 'name', label: 'Nome' },
          { id: 'email', label: 'E-mail' },
          { id: 'department', label: 'Departamento' },
          { id: 'role', label: 'Cargo' },
          { id: 'accessLevel', label: 'Nível de Acesso' },
          { id: 'status', label: 'Status' },
        ];
      case 'Consolidations':
        return [
          { id: 'collaboratorName', label: 'Colaborador' },
          { id: 'name', label: 'Nome da Consolidação' },
          { id: 'month', label: 'Mês de Referência' },
          { id: 'points', label: 'Pontos' },
          { id: 'totalTarget', label: 'Meta Total' },
          { id: 'diretoria', label: 'Diretoria' },
          { id: 'department', label: 'Departamento' },
          { id: 'team', label: 'Equipe' },
          { id: 'status', label: 'Status de Performance' },
          { id: 'createdAt', label: 'Data de Criação' },
        ];
      case 'Inventory':
        return [
          { id: 'code', label: 'Código' },
          { id: 'name', label: 'Nome' },
          { id: 'responsibleName', label: 'Responsável' },
          { id: 'target', label: 'Meta' },
          { id: 'travaZero', label: 'Trava Zero (%)' },
          { id: 'weight', label: 'Peso' },
          { id: 'status', label: 'Status' },
        ];
      case 'Results':
        return [
          { id: 'code', label: 'Código' },
          { id: 'name', label: 'Nome do Indicador' },
          { id: 'collaboratorName', label: 'Colaborador' },
          { id: 'month', label: 'Mês' },
          { id: 'target', label: 'Meta' },
          { id: 'travaZero', label: 'Trava Zero (%)' },
          { id: 'weight', label: 'Peso' },
          { id: 'actual', label: 'Realizado' },
          { id: 'achievement', label: 'Atingimento %' },
          { id: 'diretoria', label: 'Diretoria' },
          { id: 'department', label: 'Departamento' },
          { id: 'team', label: 'Equipe' },
        ];
      default:
        return [];
    }
  };

  const [selectedColumns, setSelectedColumns] = useState<string[]>(getColumnsForReport('KPIs').map(c => c.id));
  const [format, setFormat] = useState<'XLSX' | 'CSV' | 'PDF'>('XLSX');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);

  const handleReportTypeChange = (type: ReportType) => {
    setReportType(type);
    setSelectedColumns(getColumnsForReport(type).map(c => c.id));
  };

  const toggleDiretoria = (id: string) => {
    if (selectedDiretorias.includes(id)) {
      setSelectedDiretorias(selectedDiretorias.filter(d => d !== id));
    } else {
      setSelectedDiretorias([...selectedDiretorias, id]);
    }
  };

  const toggleDept = (dept: string) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter(d => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  const toggleGerencia = (name: string) => {
    if (selectedGerencias.includes(name)) {
      setSelectedGerencias(selectedGerencias.filter(g => g !== name));
    } else {
      setSelectedGerencias([...selectedGerencias, name]);
    }
  };

  const toggleServico = (name: string) => {
    if (selectedServicos.includes(name)) {
      setSelectedServicos(selectedServicos.filter(s => s !== name));
    } else {
      setSelectedServicos([...selectedServicos, name]);
    }
  };

  const toggleTeam = (name: string) => {
    if (selectedTeams.includes(name)) {
      setSelectedTeams(selectedTeams.filter(t => t !== name));
    } else {
      setSelectedTeams([...selectedTeams, name]);
    }
  };

  const toggleColumn = (id: string) => {
    if (selectedColumns.includes(id)) {
      setSelectedColumns(selectedColumns.filter(c => c !== id));
    } else {
      setSelectedColumns([...selectedColumns, id]);
    }
  };

  const selectAllColumns = () => setSelectedColumns(getColumnsForReport(reportType).map(c => c.id));
  const deselectAllColumns = () => setSelectedColumns([]);

  const handleExport = () => {
    setIsExporting(true);
    setProgress(0);
    setIsDone(false);

    const dataToExport = getFilteredData();
    const mappedData = getMappedData(dataToExport);
    const columns = getColumnsForReport(reportType);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          
          // Perform actual file generation in a timeout to avoid setState in render
          setTimeout(() => {
            try {
              const fileName = `Relatorio_${reportType}_${new Date().toISOString().split('T')[0]}`;

              if (format === 'XLSX' || format === 'CSV') {
                const worksheet = XLSX.utils.json_to_sheet(mappedData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, reportType);
                
                if (format === 'XLSX') {
                  XLSX.writeFile(workbook, `${fileName}.xlsx`);
                } else {
                  XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: 'csv' });
                }
              } else if (format === 'PDF') {
                const doc = new jsPDF() as jsPDFWithAutoTable;
                doc.text(`Relatório de ${reportType}`, 14, 15);
                
                const headers = [selectedColumns.map(id => columns.find(c => c.id === id)?.label || '')];
                const body = mappedData.map(row => Object.values(row));

                doc.autoTable({
                  head: headers,
                  body: body,
                  startY: 20,
                  theme: 'striped',
                  headStyles: { fillColor: [79, 70, 229] }
                });
                
                doc.save(`${fileName}.pdf`);
              }

              setProgress(100);
              setIsExporting(false);
              setIsDone(true);
              toast.success('Relatório gerado com sucesso!');

              // Log the export
              createDataLog('EXPORT', 
                reportType === 'KPIs' ? 'INDICADORES' : 
                reportType === 'Users' ? 'COLABORADORES' : 
                reportType === 'Consolidations' ? 'CONSOLIDACAO' : 
                reportType === 'Results' ? 'RESULTADOS' : 'INVENTARIO',
                `Exportação de Relatório - ${reportType}`,
                {
                  fileName: `${fileName}.${format.toLowerCase()}`,
                  rowCount: mappedData.length,
                  status: 'SUCCESS',
                  details: `Formato: ${format}`
                }
              ).catch(console.error);
            } catch (error) {
              console.error('Export error:', error);
              toast.error('Erro ao gerar relatório');
              setIsExporting(false);
            }
          }, 0);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <FileText className="h-7 w-7 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Relatórios</h1>
            <p className="text-slate-400 text-[10px] font-light tracking-widest mt-1 uppercase">Gere relatórios personalizados em múltiplos formatos.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Stepper Navigation */}
        <div className="lg:col-span-4">
          <nav className="flex flex-col gap-3 sticky top-8">
            {[
              { id: 1, label: 'Tipo de Relatório', icon: FileText },
              { id: 2, label: 'Período', icon: Calendar },
              { id: 3, label: 'Escopo', icon: Filter },
              { id: 4, label: 'Colunas', icon: CheckSquare },
              { id: 5, label: 'Visualizar & Formato', icon: Download },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => !isExporting && setStep(s.id)}
                className={`flex items-center gap-4 rounded-2xl p-5 transition-all duration-300 ${
                  step === s.id
                    ? 'bg-slate-800 text-white shadow-xl'
                    : step > s.id
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-200 hover:bg-slate-50/30'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                  step === s.id ? 'bg-white/20' : step > s.id ? 'bg-emerald-100' : 'bg-slate-100'
                }`}>
                  {step > s.id ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[9px] font-medium uppercase tracking-widest opacity-60">Passo {s.id}</span>
                  <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
                </div>
                {step === s.id && <ChevronRight className="ml-auto h-4 w-4 opacity-60" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Step Content */}
        <div className="lg:col-span-8">
          <div className="min-h-[500px] rounded-[2.5rem] bg-white p-10 border border-slate-100 shadow-xl shadow-slate-200/40">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900">O que você deseja exportar?</h3>
                    <p className="text-slate-500 font-medium leading-relaxed">Selecione qual conjunto de dados você deseja exportar.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      { id: 'KPIs', label: 'Lista de Estrutura', desc: 'Metas, realizados e unidades' },
                      { id: 'Users', label: 'Lista de Usuários', desc: 'Cargos, departamentos e acessos' },
                      { id: 'Consolidations', label: 'Consolidações', desc: 'Resultados finais por colaborador' },
                      { id: 'Inventory', label: 'Inventário', desc: 'Indicadores em planejamento' },
                      { id: 'Results', label: 'Resultados por Mês', desc: 'Histórico detalhado de indicadores' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => handleReportTypeChange(type.id as ReportType)}
                        className={`flex flex-col items-start gap-2 rounded-3xl border p-8 text-left transition-all duration-300 ${
                          reportType === type.id
                            ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600 shadow-lg shadow-indigo-100'
                            : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200 hover:bg-white hover:shadow-xl hover:shadow-slate-200/40'
                        }`}
                      >
                        <span className="text-lg font-black text-slate-900">{type.label}</span>
                        <span className="text-sm font-medium text-slate-500">{type.desc}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900">Defina o Período</h3>
                    <p className="text-slate-500 font-medium leading-relaxed">Escolha o intervalo de datas para extração dos dados.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data de Início</label>
                      <input
                        type="date"
                        className="h-14 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-bold focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data de Fim</label>
                      <input
                        type="date"
                        className="h-14 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-bold focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900">Filtro de Escopo</h3>
                    <p className="text-slate-500 font-medium leading-relaxed">Selecione quais unidades organizacionais devem ser incluídas no relatório.</p>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-1 rounded-2xl bg-slate-100/50 p-1.5 border border-slate-200/40">
                      {['Diretoria', 'Departamento', 'Gerência', 'Serviço', 'Equipe'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setScopeTab(tab as any)}
                          className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-[0.15em] transition-all ${
                            scopeTab === tab 
                              ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                              : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {scopeTab === 'Diretoria' && storeDiretorias.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => toggleDiretoria(d.id)}
                          className={`flex items-center justify-center rounded-2xl border p-5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                            selectedDiretorias.includes(d.id)
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:bg-white'
                          }`}
                        >
                          {d.name}
                        </button>
                      ))}
                      {scopeTab === 'Departamento' && storeDepartamentos.map((dept) => (
                        <button
                          key={dept.id}
                          onClick={() => toggleDept(dept.name)}
                          className={`flex items-center justify-center rounded-2xl border p-5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                            selectedDepts.includes(dept.name)
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:bg-white'
                          }`}
                        >
                          {dept.name}
                        </button>
                      ))}
                      {scopeTab === 'Gerência' && storeGerencias.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => toggleGerencia(g.name)}
                          className={`flex items-center justify-center rounded-2xl border p-5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                            selectedGerencias.includes(g.name)
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:bg-white'
                          }`}
                        >
                          {g.name}
                        </button>
                      ))}
                      {scopeTab === 'Serviço' && storeServicos.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => toggleServico(s.name)}
                          className={`flex items-center justify-center rounded-2xl border p-5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                            selectedServicos.includes(s.name)
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:bg-white'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                      {scopeTab === 'Equipe' && storeTeams.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => toggleTeam(t.name)}
                          className={`flex items-center justify-center rounded-2xl border p-5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                            selectedTeams.includes(t.name)
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:bg-white'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-50">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedDiretorias([]);
                          setSelectedDepts([]);
                          setSelectedGerencias([]);
                          setSelectedServicos([]);
                          setSelectedTeams([]);
                        }}
                        className="text-rose-600 font-black uppercase tracking-widest text-[10px] hover:bg-rose-50"
                      >
                        Limpar Todos os Filtros
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-slate-900">Seleção de Colunas</h3>
                      <p className="text-slate-500 font-medium leading-relaxed">Escolha os campos que aparecerão no arquivo final.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={selectAllColumns} className="text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Selecionar Tudo</Button>
                      <Button variant="ghost" size="sm" onClick={deselectAllColumns} className="text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Limpar</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {getColumnsForReport(reportType).map((col) => (
                      <label
                        key={col.id}
                        className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-5 transition-all duration-300 ${
                          selectedColumns.includes(col.id)
                            ? 'border-indigo-200 bg-indigo-50/50 shadow-sm'
                            : 'border-slate-100 hover:border-indigo-100 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all ${
                          selectedColumns.includes(col.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'
                        }`}>
                          {selectedColumns.includes(col.id) && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedColumns.includes(col.id)}
                          onChange={() => toggleColumn(col.id)}
                        />
                        <span className="text-sm font-bold text-slate-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900">Prévia do Relatório</h3>
                    <p className="text-slate-500 font-medium leading-relaxed">Confira os dados antes de gerar o arquivo final.</p>
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                    <div className="max-h-[300px] overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                          <tr>
                            {selectedColumns.map(colId => (
                              <th key={colId} className="px-4 py-3 whitespace-nowrap">
                                {getColumnsForReport(reportType).find(c => c.id === colId)?.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {getMappedData(getFilteredData()).slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              {Object.values(row).map((val: any, vIdx) => (
                                <td key={vIdx} className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                                  {val}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {getFilteredData().length > 10 && (
                            <tr>
                              <td colSpan={selectedColumns.length} className="px-4 py-3 text-center text-[10px] text-slate-400 italic">
                                Mostrando apenas as primeiras 10 de {getFilteredData().length} linhas...
                              </td>
                            </tr>
                          )}
                          {getFilteredData().length === 0 && (
                            <tr>
                              <td colSpan={selectedColumns.length} className="px-4 py-8 text-center text-slate-400">
                                Nenhum dado encontrado para os filtros selecionados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-slate-50">
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Escolha o Formato</h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          { id: 'XLSX', label: 'Excel (.xlsx)' },
                          { id: 'CSV', label: 'CSV (.csv)' },
                          { id: 'PDF', label: 'PDF (.pdf)' },
                        ].map((f) => (
                          <label
                            key={f.id}
                            className={`flex cursor-pointer items-center justify-center rounded-xl border p-4 text-xs font-black tracking-widest transition-all duration-300 ${
                              format === f.id
                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-100 italic'
                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="format"
                              className="sr-only"
                              checked={format === f.id}
                              onChange={() => setFormat(f.id as any)}
                            />
                            {f.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4">
                      {!isExporting && !isDone && (
                        <Button 
                          onClick={handleExport} 
                          disabled={getFilteredData().length === 0}
                          className="w-full !h-20 gap-3 !rounded-3xl text-xl font-black shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Download className="h-7 w-7" />
                          Gerar Relatório Agora
                        </Button>
                      )}

                      {isExporting && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 font-medium text-indigo-600 text-xs">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Processando relatório...
                            </span>
                            <span className="font-bold text-slate-900">{progress}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              className="h-full bg-indigo-600"
                            />
                          </div>
                        </div>
                      )}

                      {isDone && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center gap-4 rounded-[2rem] bg-emerald-50 p-10 text-center border border-emerald-100"
                        >
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <CheckCircle2 className="h-10 w-10" />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-xl font-black text-emerald-900 uppercase tracking-widest">Sucesso!</h4>
                            <p className="text-xs text-emerald-700 font-medium">Seu relatório em <span className="font-black underline">{format}</span> foi gerado com sucesso.</p>
                          </div>
                          <Button variant="outline" onClick={() => setIsDone(false)} className="mt-4 border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-2xl h-12 uppercase tracking-widest text-[10px] font-black">
                            Criar Outro Relatório
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            {!isExporting && !isDone && (
              <div className="mt-12 flex items-center justify-between border-t border-gray-50 pt-8">
                <Button
                  variant="ghost"
                  disabled={step === 1}
                  onClick={() => setStep(step - 1)}
                  className="text-gray-500"
                >
                  Voltar
                </Button>
                {step < 5 && (
                  <Button onClick={() => setStep(step + 1)} className="gap-2">
                    Próximo Passo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
