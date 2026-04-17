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
      'Código (Ignorado)', 'Nome do Indicador', 'Tipo (Individual/Coletivo)', 'Cargo Alvo', 'Email do Responsável', 'Meta', 'Peso (Pontos)', 'Categoria', 'Frequência', 'Polaridade', 'Trava Zero'
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
        const [, name, type, targetRole, respEmail, target, weight, category, frequency, polarity, travaZero] = row.data;

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
          travaZero: Number(travaZero) || 70,
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

    // Group rows by consolidationId to avoid race conditions
    const groups: { [id: string]: { actual: number; code: string; userId: string; period: string }[] } = {};
    
    for (const row of rows) {
      if (row.status === 'invalid') {
        errorCount++;
        details.push(`Linha ${rows.indexOf(row) + 2}: ${row.errors.join(', ')}`);
        continue;
      }
      
      const [code, , , actual] = row.data;
      const indicator = inventoryIndicators.find(ind => ind.code === code);
      if (!indicator) continue;

      const period = filters.period;
      const userId = indicator.responsibleId;
      const consolidationId = `${userId}_${period}`;
      
      if (!groups[consolidationId]) groups[consolidationId] = [];
      groups[consolidationId].push({ actual: Number(actual), code, userId, period });
    }

    for (const [consolidationId, updates] of Object.entries(groups)) {
      try {
        const { userId, period } = updates[0]; // Get from the first update in the group
        let consolidation = consolidations.find(c => c.id === consolidationId);

        if (!consolidation) {
          const user = users.find(u => u.id === userId);
          if (!user) throw new Error('Usuário responsável não encontrado');

          const newIndicators = updates.map(u => {
            const indicator = inventoryIndicators.find(ind => ind.code === u.code)!;
            return {
              id: indicator.id,
              code: indicator.code,
              name: indicator.name,
              defaultWeight: indicator.weight,
              target: parseFloat(indicator.target) || 0,
              weight: indicator.weight,
              actual: u.actual,
              unit: indicator.unit,
              polarity: indicator.polarity,
              travaZero: indicator.travaZero
            };
          });

          const newConsolidation: Partial<ConsolidatedIndicator> = {
            id: consolidationId,
            collaboratorId: userId,
            collaboratorName: user.name,
            name: `Índice de Desempenho`,
            totalTarget: '85',
            month: period,
            indicators: newIndicators,
            diretoriaId: user.diretoriaId,
            departmentId: user.departmentId,
            teamId: user.teamId,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'consolidations', consolidationId), toSnakeCase(newConsolidation));
        } else {
          let currentIndicators = [...consolidation.indicators];
          
          for (const u of updates) {
            const indicator = inventoryIndicators.find(ind => ind.code === u.code)!;
            const existingIndex = currentIndicators.findIndex(ind => ind.code === u.code);
            
            if (existingIndex >= 0) {
              currentIndicators[existingIndex] = { ...currentIndicators[existingIndex], actual: u.actual };
            } else {
              currentIndicators.push({
                id: indicator.id,
                code: indicator.code,
                name: indicator.name,
                defaultWeight: indicator.weight,
                target: parseFloat(indicator.target) || 0,
                weight: indicator.weight,
                actual: u.actual,
                unit: indicator.unit,
                polarity: indicator.polarity,
                travaZero: indicator.travaZero
              });
            }
          }

          await updateDoc(doc(db, 'consolidations', consolidationId), {
            indicators: currentIndicators.map(ind => toSnakeCase(ind)),
            updatedAt: new Date().toISOString()
          });
        }
        successCount += updates.length;
      } catch (err: any) {
        errorCount += updates.length;
        details.push(`Consolidação ${consolidationId}: Erro no banco (${err.message})`);
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
    <div className="flex flex-col gap-10 pb-12">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <Upload className="h-7 w-7 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Importação em Massa</h1>
            <p className="text-slate-400 text-[10px] font-light tracking-widest mt-1 uppercase">Gerencie dados em escala com eficiência e precisão.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={downloadTemplate} 
            className="!h-11 !rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 px-6 text-[10px] font-medium uppercase tracking-widest transition-all"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar Modelo
          </Button>
        </div>
      </div>

      {/* Top Filters Bar */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Diretoria</label>
            <div className="relative">
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer pr-10"
                value={filters.diretoriaId}
                onChange={(e) => setFilters({ ...filters, diretoriaId: e.target.value })}
              >
                <option value="">Todas</option>
                {diretorias.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
              >
                <option value="">Todos</option>
                {departamentos
                  .filter(d => !filters.diretoriaId || d.diretoriaId === filters.diretoriaId)
                  .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                onChange={(e) => setFilters({ ...filters, gerenciaId: e.target.value })}
              >
                <option value="">Todas</option>
                {gerencias
                  .filter(g => !filters.departmentId || g.departmentId === filters.departmentId)
                  .map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
                  .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Período (AAAA-MM)</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <input
                type="month"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-10 pr-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all"
                value={filters.period}
                onChange={(e) => setFilters({ ...filters, period: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Import Type Selector */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-slate-100/50 p-1.5 no-scrollbar border border-slate-200/40 w-fit">
        {[
          { id: 'users', label: 'Colaboradores', icon: Users },
          { id: 'inventory', label: 'Inventário', icon: Layout },
          { id: 'results', label: 'Realizados', icon: Calculator }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as ImportType); setPreview(null); }}
            className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-6 py-3 text-[10px] font-medium uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
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
          className={`relative group cursor-pointer rounded-3xl border-2 border-dashed p-20 text-center transition-all duration-300 ${
            isDragging 
              ? 'border-slate-400 bg-slate-50 scale-[0.99]' 
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/30'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
          <div className="space-y-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-200/50 group-hover:scale-105 transition-transform duration-300 shadow-sm">
              <Upload className="h-10 w-10" />
            </div>
            <div>
              <h2 className="text-xl font-normal text-slate-800 uppercase tracking-tight">Arraste seu arquivo aqui</h2>
              <p className="text-[10px] font-light text-slate-400 uppercase tracking-widest mt-2">Ou clique para selecionar do seu computador</p>
            </div>
            <div className="flex justify-center gap-4">
              <span className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[8px] font-medium text-slate-400 uppercase tracking-widest">XLSX</span>
              <span className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[8px] font-medium text-slate-400 uppercase tracking-widest">XLS</span>
              <span className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[8px] font-medium text-slate-400 uppercase tracking-widest">CSV</span>
            </div>
          </div>
        </div>
      )}

      {/* Preview & Logs */}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="p-8 bg-slate-50/30 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200/50 flex items-center justify-center text-slate-400 shadow-sm">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <span className="text-sm font-normal text-slate-800 uppercase tracking-tight block">Pré-visualização</span>
                <span className="text-[9px] font-light text-slate-400 uppercase tracking-widest">{preview.rows.length} registros encontrados</span>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={isImporting} className="!h-11 !rounded-xl text-[10px] font-medium uppercase tracking-widest">
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                isLoading={isImporting} 
                className="!h-11 !rounded-xl bg-slate-800 text-white px-8 text-[10px] font-medium uppercase tracking-widest shadow-lg"
                disabled={preview.rows.every(r => r.status === 'invalid')}
              >
                <Save className="h-4 w-4 mr-2" />
                Confirmar Importação
              </Button>
            </div>
          </div>

          {/* Error Log Summary */}
          {preview.rows.some(r => r.status === 'invalid') && (
            <div className="p-8 bg-rose-50/30 border-b border-rose-100">
              <h4 className="text-[10px] font-medium text-rose-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                <AlertCircle className="h-4 w-4" />
                Log de Inconsistências
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-3 custom-scrollbar">
                {preview.rows.filter(r => r.status === 'invalid').map((row, i) => (
                  <div key={i} className="text-[10px] font-light text-rose-600 flex gap-3 uppercase tracking-widest">
                    <span className="font-medium shrink-0">Linha {preview.rows.indexOf(row) + 2}:</span>
                    <span>{row.errors.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 sticky top-0 z-10">
                <tr>
                  <th className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Status</th>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="px-8 py-5 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {preview.rows.map((row, i) => (
                  <tr key={i} className={`hover:bg-slate-50/50 transition-colors ${row.status === 'invalid' ? 'bg-rose-50/10' : ''}`}>
                    <td className="px-8 py-5">
                      {row.status === 'valid' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-rose-400" />
                      )}
                    </td>
                    {row.data.map((cell: any, j: number) => (
                      <td key={j} className="px-8 py-5 text-[10px] font-light text-slate-600 uppercase tracking-widest whitespace-nowrap">{String(cell || '')}</td>
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
