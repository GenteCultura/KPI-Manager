import React, { useState, useRef, useMemo } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Save, 
  Info, 
  Users, 
  Layout, 
  Calculator,
  ChevronDown,
  Calendar,
  XCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { Button } from './ui/Button';
import { toast } from 'react-hot-toast';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  User, 
  InventoryIndicator, 
  ConsolidatedIndicator, 
  AccessLevel, 
  UserStatus, 
  InventoryStatus, 
  KPIPolarity,
  KPICategory,
  KPIFrequency
} from '../types';
import { toSnakeCase } from '../lib/mapping';
import { createDataLog } from '../lib/dataLog';
import { motion, AnimatePresence } from 'framer-motion';

type ImportType = 'users' | 'inventory' | 'results';

interface ImportRow {
  data: any[];
  status: 'pending' | 'valid' | 'invalid';
  errors: string[];
}

interface ImportPreview {
  type: ImportType;
  rows: ImportRow[];
  headers: string[];
}

export const BulkImport = () => {
  const [activeTab, setActiveTab] = useState<ImportType>('users');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: number; details: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    users, diretorias, departamentos, gerencias, teams,
    inventoryIndicators, consolidations
  } = useStore();

  // Top Filters
  const [filters, setFilters] = useState({
    diretoriaId: '',
    departmentId: '',
    gerenciaId: '',
    teamId: '',
    period: '' // Required for results import
  });

  const templates = {
    users: [
      'Nome', 'Email', 'Cargo', 'Matrícula', 'Diretoria', 'Departamento', 'Gerência', 'Time', 'Nível de Acesso', 'Status'
    ],
    inventory: [
      'Código (Ignorado)', 'Nome do Indicador', 'Tipo (Individual/Coletivo)', 'Cargo Alvo', 'Email do Responsável', 'Meta', 'Peso (%)', 'Categoria', 'Frequência', 'Polaridade'
    ],
    results: [
      'Código do Indicador', 'Nome do Indicador', 'Responsável', 'Valor Realizado'
    ]
  };

  const downloadTemplate = () => {
    let headers = templates[activeTab];
    let data: any[][] = [headers];

    // Smart Template Logic for Results
    if (activeTab === 'results') {
      // Filter indicators based on selected filters
      const filteredIndicators = inventoryIndicators.filter(ind => {
        // Fallback to user hierarchy if indicator fields are missing (for legacy data)
        const responsible = users.find(u => u.id === ind.responsibleId);
        const diretoriaId = ind.diretoriaId || responsible?.diretoriaId;
        const departmentId = ind.departmentId || responsible?.departmentId;
        const gerenciaId = ind.gerenciaId || responsible?.gerenciaId;
        const teamId = ind.teamId || responsible?.teamId;

        const matchesDiretoria = !filters.diretoriaId || diretoriaId === filters.diretoriaId;
        const matchesDept = !filters.departmentId || departmentId === filters.departmentId;
        const matchesGerencia = !filters.gerenciaId || gerenciaId === filters.gerenciaId;
        const matchesTeam = !filters.teamId || teamId === filters.teamId;
        return matchesDiretoria && matchesDept && matchesGerencia && matchesTeam;
      });

      filteredIndicators.forEach(ind => {
        data.push([ind.code, ind.name, ind.responsibleName, '']);
      });

      if (filteredIndicators.length === 0 && (filters.diretoriaId || filters.departmentId || filters.gerenciaId || filters.teamId)) {
        toast.error('Nenhum indicador encontrado para os filtros selecionados.');
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    
    const fileName = `modelo_${activeTab === 'users' ? 'colaboradores' : activeTab === 'inventory' ? 'inventario' : 'realizados'}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Modelo baixado com sucesso!');
  };

  const validateRows = (type: ImportType, headers: string[], data: any[][]): ImportRow[] => {
    return data.map((row, index) => {
      const errors: string[] = [];
      
      if (type === 'users') {
        const [name, email, role] = row;
        if (!name) errors.push('Nome é obrigatório');
        if (!email) errors.push('Email é obrigatório');
        else if (!String(email).includes('@')) errors.push('Email inválido');
        if (!role) errors.push('Cargo é obrigatório');
      }

      if (type === 'inventory') {
        const [, name, , , respEmail, target, weight] = row;
        if (!name) errors.push('Nome do indicador é obrigatório');
        if (!respEmail) errors.push('Email do responsável é obrigatório');
        else if (!users.some(u => u.email === respEmail)) errors.push(`Responsável "${respEmail}" não encontrado no sistema`);
        
        if (target === undefined || target === '') errors.push('Meta é obrigatória');
        if (weight === undefined || isNaN(Number(weight))) errors.push('Peso deve ser um número');
      }

      if (type === 'results') {
        const [code, , , actual] = row;
        if (!filters.period) errors.push('Selecione o Período nos filtros superiores antes de importar realizados');
        if (!code) errors.push('Código do indicador é obrigatório');
        else if (!inventoryIndicators.some(ind => ind.code === code)) errors.push(`Indicador com código "${code}" não existe no inventário`);
        
        if (actual === undefined || isNaN(Number(actual))) errors.push('Valor realizado deve ser um número');
      }

      return {
        data: row,
        status: errors.length > 0 ? 'invalid' : 'valid',
        errors
      };
    });
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length < 2) {
          toast.error('O arquivo está vazio ou contém apenas o cabeçalho.');
          return;
        }

        const headers = data[0] as string[];
        const rows = data.slice(1).filter(row => row.length > 0);

        const validatedRows = validateRows(activeTab, headers, rows);

        setPreview({
          type: activeTab,
          headers,
          rows: validatedRows
        });
        setImportResults(null);
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Erro ao processar o arquivo. Verifique o formato.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const processUsersImport = async (rows: ImportRow[]) => {
    let successCount = 0;
    let errorCount = 0;
    const details: string[] = [];

    for (const row of rows) {
      if (row.status === 'invalid') {
        errorCount++;
        details.push(`Linha ${rows.indexOf(row) + 2}: ${row.errors.join(', ')}`);
        continue;
      }

      try {
        const [name, email, role, registration, dirName, deptName, gerName, teamName, access, status] = row.data;

        const diretoria = diretorias.find(d => d.name === dirName);
        const department = departamentos.find(d => d.name === deptName);
        const gerencia = gerencias.find(g => g.name === gerName);
        const team = teams.find(t => t.name === teamName);

        const newUser: Partial<User> = {
          id: email.replace(/[.@]/g, '_'),
          name: String(name),
          email: String(email),
          role: String(role || ''),
          registrationNumber: registration ? String(registration) : undefined,
          diretoriaId: diretoria?.id,
          departmentId: department?.id,
          gerenciaId: gerencia?.id,
          teamId: team?.id,
          department: deptName || '',
          accessLevel: (access as AccessLevel) || 'Visualizador',
          status: (status as UserStatus) || 'Ativo',
          permissions: {
            canCreateIndicators: false,
            canEditResults: false,
            canViewOtherDepartments: false,
            allowedTeams: [],
            allowedAreas: [],
            onlyOwnIndicators: true
          }
        };

        await setDoc(doc(db, 'users', newUser.id!), toSnakeCase(newUser), { merge: true });
        successCount++;
      } catch (err: any) {
        errorCount++;
        details.push(`Linha ${rows.indexOf(row) + 2}: Erro no banco (${err.message})`);
      }
    }
    return { successCount, errorCount, details };
  };

  const processInventoryImport = async (rows: ImportRow[]) => {
    let successCount = 0;
    let errorCount = 0;
    const details: string[] = [];

    // Get current max ID for incremental generation
    let lastIdNum = 0;
    inventoryIndicators.forEach(ind => {
      const match = ind.code.match(/IND-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > lastIdNum) lastIdNum = num;
      }
    });

    for (const row of rows) {
      if (row.status === 'invalid') {
        errorCount++;
        details.push(`Linha ${rows.indexOf(row) + 2}: ${row.errors.join(', ')}`);
        continue;
      }

      try {
        const [, name, type, targetRole, respEmail, target, weight, category, frequency, polarity] = row.data;

        const responsible = users.find(u => u.email === respEmail);
        if (!responsible) throw new Error('Responsável não encontrado');

        lastIdNum++;
        const generatedCode = `IND-${String(lastIdNum).padStart(3, '0')}`;

        const newIndicator: Partial<InventoryIndicator> = {
          id: crypto.randomUUID(),
          code: generatedCode,
          name: String(name),
          type: (type as 'Individual' | 'Coletivo') || 'Individual',
          targetRole: String(targetRole || ''),
          responsibleId: responsible.id,
          responsibleName: responsible.name,
          responsibleRole: responsible.role,
          diretoriaId: responsible.diretoriaId,
          departmentId: responsible.departmentId,
          gerenciaId: responsible.gerenciaId,
          teamId: responsible.teamId,
          target: String(target || '0'),
          weight: Number(weight) || 0,
          category: (category as KPICategory) || 'Produtividade',
          frequency: (frequency as KPIFrequency) || 'Mensal',
          polarity: (polarity as KPIPolarity) || 'Cima',
          status: 'Ativo',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
        };

        await setDoc(doc(db, 'inventory_indicators', newIndicator.id!), toSnakeCase(newIndicator));
        successCount++;
      } catch (err: any) {
        errorCount++;
        details.push(`Linha ${rows.indexOf(row) + 2}: Erro no banco (${err.message})`);
      }
    }
    return { successCount, errorCount, details };
  };

  const processResultsImport = async (rows: ImportRow[]) => {
    let successCount = 0;
    let errorCount = 0;
    const details: string[] = [];

    for (const row of rows) {
      if (row.status === 'invalid') {
        errorCount++;
        details.push(`Linha ${rows.indexOf(row) + 2}: ${row.errors.join(', ')}`);
        continue;
      }

      try {
        const [code, , , actual] = row.data;
        const indicator = inventoryIndicators.find(ind => ind.code === code);
        if (!indicator) throw new Error(`Indicador ${code} não encontrado`);

        // Find or create consolidation for this period and user
        const period = filters.period;
        const userId = indicator.responsibleId;
        const consolidationId = `${userId}_${period}`;
        
        let consolidation = consolidations.find(c => c.id === consolidationId);

        if (!consolidation) {
          const user = users.find(u => u.id === userId);
          if (!user) throw new Error('Usuário responsável não encontrado');

          const newConsolidation: Partial<ConsolidatedIndicator> = {
            id: consolidationId,
            collaboratorId: userId,
            collaboratorName: user.name,
            name: `Índice de Desempenho`,
            totalTarget: '85',
            month: period,
            indicators: [{
              id: indicator.id,
              code: indicator.code,
              name: indicator.name,
              defaultWeight: indicator.weight,
              target: parseFloat(indicator.target) || 0,
              weight: indicator.weight,
              actual: Number(actual),
              unit: indicator.unit,
              polarity: indicator.polarity
            }],
            diretoriaId: user.diretoriaId,
            departmentId: user.departmentId,
            teamId: user.teamId,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'consolidations', consolidationId), toSnakeCase(newConsolidation));
        } else {
          const existingIndicator = consolidation.indicators.find(ind => ind.code === code);
          let updatedIndicators;

          if (existingIndicator) {
            updatedIndicators = consolidation.indicators.map(ind => 
              ind.code === code ? { ...ind, actual: Number(actual) } : ind
            );
          } else {
            updatedIndicators = [...consolidation.indicators, {
              id: indicator.id,
              code: indicator.code,
              name: indicator.name,
              defaultWeight: indicator.weight,
              target: parseFloat(indicator.target) || 0,
              weight: indicator.weight,
              actual: Number(actual),
              unit: indicator.unit,
              polarity: indicator.polarity
            }];
          }

          await updateDoc(doc(db, 'consolidations', consolidationId), {
            indicators: updatedIndicators.map(ind => toSnakeCase(ind)),
            updatedAt: new Date().toISOString()
          });
        }
        successCount++;
      } catch (err: any) {
        errorCount++;
        details.push(`Linha ${rows.indexOf(row) + 2}: Erro no banco (${err.message})`);
      }
    }
    return { successCount, errorCount, details };
  };

  const handleImport = async () => {
    if (!preview) return;
    setIsImporting(true);

    try {
      let result;
      if (preview.type === 'users') result = await processUsersImport(preview.rows);
      else if (preview.type === 'inventory') result = await processInventoryImport(preview.rows);
      else result = await processResultsImport(preview.rows);

      setImportResults({
        success: result.successCount,
        errors: result.errorCount,
        details: result.details
      });

      const logCategory = preview.type === 'users' ? 'COLABORADORES' : 
                          preview.type === 'inventory' ? 'INVENTARIO' : 'RESULTADOS';

      await createDataLog('IMPORT', logCategory, `Importação em Massa - ${preview.type}`, {
        rowCount: result.successCount,
        status: result.errorCount === 0 ? 'SUCCESS' : 'PARTIAL',
        details: `Sucesso: ${result.successCount}, Erros: ${result.errorCount}`
      });

      if (result.errorCount === 0) {
        toast.success('Importação concluída com sucesso!');
        setPreview(null);
      } else {
        toast.error('Importação concluída com erros. Verifique o log.');
      }
    } catch (error) {
      toast.error('Erro crítico na importação.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Filters */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
              <Upload className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Importação em Massa</h1>
              <p className="text-slate-500 font-medium">Gerencie dados em escala com eficiência e precisão.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={downloadTemplate} className="!h-12 gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 !rounded-2xl px-6 font-bold shadow-sm">
              <Download className="h-5 w-5" />
              Baixar Planilha Modelo
            </Button>
          </div>
        </div>

        {/* Top Filters Bar */}
        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Diretoria</label>
              <div className="relative">
                <select
                  className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                  value={filters.diretoriaId}
                  onChange={(e) => setFilters({ ...filters, diretoriaId: e.target.value })}
                >
                  <option value="">Todas as Diretorias</option>
                  {diretorias.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Departamento</label>
              <div className="relative">
                <select
                  className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                  value={filters.departmentId}
                  onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
                >
                  <option value="">Todos os Departamentos</option>
                  {departamentos
                    .filter(d => !filters.diretoriaId || d.diretoriaId === filters.diretoriaId)
                    .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Gerência</label>
              <div className="relative">
                <select
                  className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                  value={filters.gerenciaId}
                  onChange={(e) => setFilters({ ...filters, gerenciaId: e.target.value })}
                >
                  <option value="">Todas as Gerências</option>
                  {gerencias
                    .filter(g => !filters.departmentId || g.departmentId === filters.departmentId)
                    .map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Time</label>
              <div className="relative">
                <select
                  className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer pr-10"
                  value={filters.teamId}
                  onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
                >
                  <option value="">Todos os Times</option>
                  {teams
                    .filter(t => !filters.gerenciaId || t.gerenciaId === filters.gerenciaId)
                    .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Período (AAAA-MM)</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="month"
                  className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50/50 pl-11 pr-4 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  value={filters.period}
                  onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Type Selector */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1.5 no-scrollbar border border-slate-200/50 w-fit">
        {[
          { id: 'users', label: 'Colaboradores', icon: Users },
          { id: 'inventory', label: 'Inventário', icon: Layout },
          { id: 'results', label: 'Realizados', icon: Calculator }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as ImportType); setPreview(null); }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Drag & Drop Area */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative group cursor-pointer rounded-[2.5rem] border-4 border-dashed p-16 text-center transition-all duration-500 ${
            isDragging 
              ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' 
              : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/10'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
          <div className="space-y-6">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-indigo-50 text-indigo-600 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
              <Upload className="h-12 w-12" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Arraste seu arquivo aqui</h2>
              <p className="text-slate-500 font-medium mt-2">Ou clique para selecionar um arquivo do seu computador</p>
            </div>
            <div className="flex justify-center gap-4">
              <span className="px-4 py-2 rounded-full bg-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">XLSX</span>
              <span className="px-4 py-2 rounded-full bg-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">XLS</span>
              <span className="px-4 py-2 rounded-full bg-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">CSV</span>
            </div>
          </div>
        </div>
      )}

      {/* Preview & Logs */}
      {preview && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <span className="font-black text-slate-900 block">Pré-visualização de Dados</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{preview.rows.length} registros encontrados</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={isImporting} className="!rounded-xl font-bold">
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                isLoading={isImporting} 
                className="gap-2 !rounded-xl font-bold shadow-lg shadow-indigo-100"
                disabled={preview.rows.every(r => r.status === 'invalid')}
              >
                <Save className="h-4 w-4" />
                Confirmar Importação
              </Button>
            </div>
          </div>

          {/* Error Log Summary */}
          {preview.rows.some(r => r.status === 'invalid') && (
            <div className="p-6 bg-rose-50 border-b border-rose-100">
              <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Log de Inconsistências
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {preview.rows.filter(r => r.status === 'invalid').map((row, i) => (
                  <div key={i} className="text-xs font-medium text-rose-700 flex gap-2">
                    <span className="font-black shrink-0">Linha {preview.rows.indexOf(row) + 2}:</span>
                    <span>{row.errors.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100">Status</th>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {preview.rows.map((row, i) => (
                  <tr key={i} className={`hover:bg-indigo-50/20 transition-colors ${row.status === 'invalid' ? 'bg-rose-50/20' : ''}`}>
                    <td className="px-6 py-4">
                      {row.status === 'valid' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-rose-500" />
                      )}
                    </td>
                    {row.data.map((cell: any, j: number) => (
                      <td key={j} className="px-6 py-4 text-slate-600 font-bold whitespace-nowrap">{String(cell || '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
