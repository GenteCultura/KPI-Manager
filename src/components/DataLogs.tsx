import React, { useState, useMemo } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText, 
  User as UserIcon,
  ChevronDown,
  Clock,
  Layout
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { DataLog, DataLogType } from '../types';
import { Input, Badge } from './ui/Input';
import { motion, AnimatePresence } from 'framer-motion';

export const DataLogs = () => {
  const { dataLogs, users } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DataLogType | 'ALL'>('ALL');
  const [entityFilter, setEntityFilter] = useState<DataLog['entity'] | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState('');

  const filteredLogs = useMemo(() => {
    return dataLogs.filter(log => {
      const matchesSearch = 
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        (log.fileName && log.fileName.toLowerCase().includes(search.toLowerCase())) ||
        log.performedBy.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = typeFilter === 'ALL' || log.type === typeFilter;
      const matchesEntity = entityFilter === 'ALL' || log.entity === entityFilter;
      const matchesDate = !dateFilter || log.timestamp.startsWith(dateFilter);

      return matchesSearch && matchesType && matchesEntity && matchesDate;
    });
  }, [dataLogs, search, typeFilter, entityFilter, dateFilter]);

  const stats = useMemo(() => {
    const imports = dataLogs.filter(l => l.type === 'IMPORT').length;
    const exports = dataLogs.filter(l => l.type === 'EXPORT').length;
    const errors = dataLogs.filter(l => l.status === 'ERROR').length;
    
    return { imports, exports, errors };
  }, [dataLogs]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
            <Database className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Logs de Dados</h1>
            <p className="text-slate-500 font-medium">Histórico de importações e exportações do sistema.</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Upload className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Importações</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tighter text-slate-900">{stats.imports}</span>
            <span className="text-xs font-medium text-slate-500 mt-1">Arquivos processados</span>
          </div>
        </div>

        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Download className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Exportações</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tighter text-slate-900">{stats.exports}</span>
            <span className="text-xs font-medium text-slate-500 mt-1">Relatórios gerados</span>
          </div>
        </div>

        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-50 rounded-lg">
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Erros</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tighter text-slate-900">{stats.errors}</span>
            <span className="text-xs font-medium text-slate-500 mt-1">Falhas registradas</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-base p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar log..." 
              className="pl-10 !rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select 
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="ALL">Todos os Tipos</option>
              <option value="IMPORT">Importação</option>
              <option value="EXPORT">Exportação</option>
            </select>
          </div>
          <div className="relative">
            <Layout className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select 
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value as any)}
            >
              <option value="ALL">Todas as Entidades</option>
              <option value="KPI">KPIs</option>
              <option value="USUARIO">Usuários</option>
              <option value="INVENTARIO">Inventário</option>
              <option value="CONSOLIDACAO">Consolidação</option>
              <option value="ORGANIZACAO">Organização</option>
            </select>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              type="date"
              className="pl-10 !rounded-xl"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-8 py-5">Ação / Entidade</th>
                <th className="px-8 py-5">Arquivo</th>
                <th className="px-8 py-5">Registros</th>
                <th className="px-8 py-5">Realizado por</th>
                <th className="px-8 py-5">Data / Hora</th>
                <th className="px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredLogs.map((log) => (
                  <motion.tr 
                    key={log.id} 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-indigo-50/30 transition-colors duration-200"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${
                          log.type === 'IMPORT' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {log.type === 'IMPORT' ? <Upload className="h-5 w-5" /> : <Download className="h-5 w-5" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{log.action}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{log.entity}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {log.fileName ? (
                        <div className="flex items-center gap-2 text-slate-600">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-medium truncate max-w-[150px]">{log.fileName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-slate-700">{log.rowCount || 0}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {log.performedBy.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-slate-700">{log.performedBy}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">
                          {new Date(log.timestamp).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {log.status === 'SUCCESS' ? (
                        <Badge variant="success" className="gap-1 font-black uppercase tracking-widest text-[9px]">
                          <CheckCircle2 className="h-3 w-3" /> Sucesso
                        </Badge>
                      ) : log.status === 'PARTIAL' ? (
                        <Badge variant="warning" className="gap-1 font-black uppercase tracking-widest text-[9px] bg-amber-100 text-amber-700 border-amber-200">
                          <AlertCircle className="h-3 w-3" /> Parcial
                        </Badge>
                      ) : (
                        <Badge variant="danger" className="gap-1 font-black uppercase tracking-widest text-[9px]">
                          <XCircle className="h-3 w-3" /> Erro
                        </Badge>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center shadow-inner">
                        <Clock className="h-10 w-10 opacity-20" />
                      </div>
                      <span className="text-sm font-bold text-slate-400">Nenhum log encontrado.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
