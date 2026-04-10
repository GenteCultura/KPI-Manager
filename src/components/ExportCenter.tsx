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
    teams: storeTeams
  } = useStore();
  const kpis = propKpis || storeKpis;
  const users = propUsers || storeUsers;
  const consolidations = propConsolidations || storeConsolidations;
  const inventoryIndicators = propInventory || storeInventory;
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState<ReportType>('KPIs');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  
  const getColumnsForReport = (type: ReportType) => {
    switch (type) {
      case 'KPIs':
        return [
          { id: 'code', label: 'Código' },
          { id: 'name', label: 'Nome' },
          { id: 'department', label: 'Departamento' },
          { id: 'responsible', label: 'Responsável' },
          { id: 'target', label: 'Meta' },
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
          { id: 'createdAt', label: 'Data de Criação' },
        ];
      case 'Inventory':
        return [
          { id: 'code', label: 'Código' },
          { id: 'name', label: 'Nome' },
          { id: 'responsibleName', label: 'Responsável' },
          { id: 'target', label: 'Meta' },
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

  const toggleDept = (dept: string) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter(d => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
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

    // Filter data based on selection (department)
    let dataToExport = rawData.filter(item => {
      if (reportType === 'KPIs' || reportType === 'Users' || reportType === 'Results' || reportType === 'Consolidations') {
        const dept = item.department || '';
        return selectedDepts.length === 0 || selectedDepts.includes(dept);
      }
      return true;
    });

    // Map data to selected columns
    const columns = getColumnsForReport(reportType);
    const mappedData = dataToExport.map(item => {
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
            <Download className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Central de Exportação</h1>
            <p className="text-slate-500 font-medium">Gere relatórios personalizados em múltiplos formatos.</p>
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
              { id: 5, label: 'Formato', icon: Download },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => !isExporting && setStep(s.id)}
                className={`flex items-center gap-4 rounded-2xl p-5 transition-all duration-300 ${
                  step === s.id
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50'
                    : step > s.id
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-white text-slate-400 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${
                  step === s.id ? 'bg-white/20' : step > s.id ? 'bg-emerald-100' : 'bg-slate-100'
                }`}>
                  {step > s.id ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Passo {s.id}</span>
                  <span className="font-bold">{s.label}</span>
                </div>
                {step === s.id && <ChevronRight className="ml-auto h-5 w-5 opacity-60" />}
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
                      { id: 'KPIs', label: 'Lista de Indicadores', desc: 'Metas, realizados e unidades' },
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
                    <p className="text-slate-500 font-medium leading-relaxed">Selecione quais departamentos devem ser incluídos no relatório.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {DEPARTMENTS.map((dept) => (
                      <button
                        key={dept}
                        onClick={() => toggleDept(dept)}
                        className={`flex items-center justify-center rounded-2xl border p-5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                          selectedDepts.includes(dept)
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:bg-white'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedDepts(selectedDepts.length === DEPARTMENTS.length ? [] : [...DEPARTMENTS])}
                    className="text-indigo-600 font-black uppercase tracking-widest text-[10px] hover:bg-indigo-50"
                  >
                    {selectedDepts.length === DEPARTMENTS.length ? 'Desmarcar Todos' : 'Selecionar Todos os Departamentos'}
                  </Button>
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
                  className="space-y-10"
                >
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900">Formato do Arquivo</h3>
                    <p className="text-slate-500 font-medium leading-relaxed">Escolha como deseja receber os dados consolidados.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { id: 'XLSX', label: 'Excel (.xlsx)', desc: 'Ideal para análise de dados' },
                      { id: 'CSV', label: 'CSV (.csv)', desc: 'Formato leve e universal' },
                      { id: 'PDF', label: 'PDF (.pdf)', desc: 'Relatório visual pronto' },
                    ].map((f) => (
                      <label
                        key={f.id}
                        className={`flex cursor-pointer flex-col gap-3 rounded-3xl border p-8 transition-all duration-300 ${
                          format === f.id
                            ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600 shadow-lg shadow-indigo-100'
                            : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200 hover:bg-white hover:shadow-xl hover:shadow-slate-200/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="format"
                          className="sr-only"
                          checked={format === f.id}
                          onChange={() => setFormat(f.id as any)}
                        />
                        <span className="text-lg font-black text-slate-900">{f.label}</span>
                        <span className="text-xs font-medium text-slate-500 leading-relaxed">{f.desc}</span>
                      </label>
                    ))}
                  </div>

                  <div className="pt-6">
                    {!isExporting && !isDone && (
                      <Button onClick={handleExport} className="w-full !h-20 gap-3 !rounded-3xl text-xl font-black shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <Download className="h-7 w-7" />
                        Gerar Arquivo Agora
                      </Button>
                    )}

                    {isExporting && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium text-indigo-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Consolidando dados...
                          </span>
                          <span className="font-bold text-gray-900">{progress}%</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
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
                        className="flex flex-col items-center gap-4 rounded-2xl bg-emerald-50 p-8 text-center border border-emerald-100"
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-emerald-900">Download concluído com sucesso!</h4>
                          <p className="text-sm text-emerald-700">Seu arquivo <span className="font-bold">{format}</span> já está disponível na sua pasta de downloads.</p>
                        </div>
                        <Button variant="outline" onClick={() => setIsDone(false)} className="mt-2 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                          Gerar Novo Relatório
                        </Button>
                      </motion.div>
                    )}
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
