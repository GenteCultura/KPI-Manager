import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Target, 
  Weight, 
  Network,
  History,
  CheckCircle2,
  Info,
  Edit2,
  Trash2,
  Filter,
  X,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { KPI, InventoryIndicator, User, AuditLog, KPIStatus, MasterIndicator } from '../types';
import { Button } from './ui/Button';
import { Badge } from './ui/Input';
import { calculateKPIStatus } from '../utils/calculationEngine';

interface StructureListProps {
  kpis: KPI[];
  users: User[];
  inventoryIndicators: InventoryIndicator[];
  auditLogs: AuditLog[];
  onEdit: (kpi: KPI | InventoryIndicator) => void;
  onDeleteKPI: (id: string) => void;
  onDeleteInventory: (id: string) => void;
  onOpenAuditTrail: (item: { id: string, name: string }) => void;
  currentUser: User | null;
}

export const StructureList = ({ 
  kpis, 
  users, 
  inventoryIndicators, 
  auditLogs, 
  onEdit, 
  onDeleteKPI, 
  onDeleteInventory, 
  onOpenAuditTrail, 
  currentUser 
}: StructureListProps) => {
  const { diretorias, gerencias, servicos, teams } = useStore();
  const [search, setSearch] = useState('');
  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);
  const [filterDiretoria, setFilterDiretoria] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGerencia, setFilterGerencia] = useState('');
  const [filterServico, setFilterServico] = useState('');
  const [filterTeam, setFilterTeam] = useState('');

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const departments = useMemo(() => {
    const depts = new Set(users.map(u => u.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [users]);

  const structureData = useMemo(() => {
    const collaboratorMap = new Map<string, { 
      user: User; 
      indicators: (KPI | InventoryIndicator)[];
    }>();

    // Group indicators by responsible/owner
    const allIndicators = [
      ...kpis.filter(k => k.status === 'Ativo'), 
      ...inventoryIndicators.filter(i => i.status === 'Ativo')
    ];

    allIndicators.forEach(ind => {
      const responsibleId = 'ownerId' in ind ? ind.ownerId : ind.responsibleId;
      const user = users.find(u => u.id === responsibleId);
      
      if (user) {
        if (!collaboratorMap.has(user.id)) {
          collaboratorMap.set(user.id, { user, indicators: [] });
        }
        collaboratorMap.get(user.id)!.indicators.push(ind);
      }
    });

    // Convert map to array and apply filters
    return Array.from(collaboratorMap.values())
      .filter(({ user, indicators }) => {
        const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
                             indicators.some(i => i.name.toLowerCase().includes(search.toLowerCase()));
        
        const matchesDept = !filterDepartment || user.department === filterDepartment || user.departmentId === filterDepartment;
        const matchesDiretoria = !filterDiretoria || user.diretoriaId === filterDiretoria;
        const matchesGerencia = !filterGerencia || user.gerenciaId === filterGerencia;
        const matchesServico = !filterServico || user.servicoId === filterServico;
        const matchesTeam = !filterTeam || user.teamId === filterTeam;
        
        return matchesSearch && matchesDept && matchesDiretoria && matchesGerencia && matchesServico && matchesTeam;
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [kpis, inventoryIndicators, users, search, filterDepartment, filterDiretoria, filterGerencia, filterServico, filterTeam]);

  const getIndicatorAuditSummary = (indicatorId: string) => {
    const logs = auditLogs.filter(log => log.targetId === indicatorId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const creationLog = logs.find(log => log.action === 'CREATE');
    const targetChanges = logs.filter(log => log.action === 'UPDATE' && log.changes?.some(c => c.field === 'target' || c.field === 'targetValue'));
    const weightChanges = logs.filter(log => log.action === 'UPDATE' && log.changes?.some(c => c.field === 'weight'));
    const teamChanges = logs.filter(log => log.action === 'UPDATE' && log.changes?.some(c => c.field === 'teamId' || c.field === 'team_id' || c.field === 'department'));

    return {
      createdAt: creationLog ? new Date(creationLog.timestamp).toLocaleDateString('pt-BR') : 'N/A',
      hasTargetChange: targetChanges.length > 0,
      hasWeightChange: weightChanges.length > 0,
      hasTeamChange: teamChanges.length > 0,
      lastChange: logs[0] ? new Date(logs[0].timestamp).toLocaleDateString('pt-BR') : null,
      totalChanges: logs.length
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Superou a Meta':
      case 'Meta Batida':
        return <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-100 uppercase text-[8px] tracking-widest font-black shrink-0 px-2 py-0.5"><CheckCircle2 className="mr-1 h-2.5 w-2.5" /> {status}</Badge>;
      case 'Atingiu a Meta':
      case 'No Prazo':
        return <Badge variant="info" className="bg-amber-50 text-amber-600 border-amber-100 uppercase text-[8px] tracking-widest font-black shrink-0 px-2 py-0.5"><Clock className="mr-1 h-2.5 w-2.5" /> {status}</Badge>;
      case 'Abaixo da Meta':
      case 'Atrasado':
      case 'Alerta':
        return <Badge variant="danger" className="bg-rose-50 text-rose-600 border-rose-100 uppercase text-[8px] tracking-widest font-black shrink-0 px-2 py-0.5"><AlertCircle className="mr-1 h-2.5 w-2.5" /> {status}</Badge>;
      default:
        return <Badge className="bg-slate-50 text-slate-400 border-slate-100 uppercase text-[8px] tracking-widest font-black shrink-0 px-2 py-0.5">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <Network className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Lista de Estrutura</h1>
            <p className="text-slate-400 text-[10px] font-light mt-1 uppercase tracking-widest">Estrutura de indicadores agrupada por colaborador e trilha de auditoria.</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="BUSCAR COLABORADOR OU INDICADOR..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer shadow-sm"
              value={filterDiretoria}
              onChange={(e) => setFilterDiretoria(e.target.value)}
            >
              <option value="">TODAS AS DIRETORIAS</option>
              {diretorias.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer shadow-sm"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
            >
              <option value="">TODAS AS ÁREAS</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer shadow-sm"
              value={filterGerencia}
              onChange={(e) => setFilterGerencia(e.target.value)}
            >
              <option value="">TODAS AS GERÊNCIAS</option>
              {gerencias.filter(g => !filterDepartment || g.departmentId === filterDepartment || departments.find(d => d === filterDepartment)).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer shadow-sm"
              value={filterServico}
              onChange={(e) => setFilterServico(e.target.value)}
            >
              <option value="">TODOS OS SERVIÇOS</option>
              {servicos.filter(s => !filterGerencia || s.gerenciaId === filterGerencia).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-11 pr-4 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none cursor-pointer shadow-sm"
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
            >
              <option value="">TODAS AS EQUIPES</option>
              {teams.filter(t => !filterServico || t.servicoId === filterServico).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>

          <div className="flex justify-end items-center md:col-span-2 lg:col-span-3 xl:col-span-4">
            <button 
              onClick={() => { 
                setSearch(''); 
                setFilterDiretoria(''); 
                setFilterDepartment(''); 
                setFilterGerencia(''); 
                setFilterServico(''); 
                setFilterTeam(''); 
              }}
              className="text-[10px] font-medium text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <X className="h-3.5 w-3.5" />
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Collaborator Structure List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {structureData.map(({ user, indicators }) => (
            <motion.div 
              key={user.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300"
            >
              {/* Collaborator Header */}
              <button
                onClick={() => toggleUser(user.id)}
                className="flex w-full items-center justify-between p-6 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-6">
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-1">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-200 text-slate-400">
                        <Users className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-medium tracking-tight text-slate-800">{user.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50 uppercase tracking-widest">
                        {user.department}
                      </span>
                      <span className="text-[10px] font-light text-slate-400 uppercase tracking-widest">{user.role}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-10">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Indicadores</span>
                    <span className="text-lg font-normal text-slate-800 tracking-tight">{indicators.length}</span>
                  </div>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center border transition-all ${
                    expandedUsers.includes(user.id) ? 'bg-slate-800 border-slate-800 text-white rotate-180' : 'bg-white border-slate-100 text-slate-300'
                  }`}>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </button>

              {/* Indicators Detail */}
              <AnimatePresence>
                {expandedUsers.includes(user.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden border-t border-slate-50"
                  >
                    <div className="bg-slate-50/30 p-2 sm:p-8">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4">Indicador</th>
                              <th className="px-6 py-4">Meta / Peso</th>
                              <th className="px-6 py-4">Evolução do Indicador (Auditoria)</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {indicators.map((ind) => {
                              const audit = getIndicatorAuditSummary(ind.id);
                              const target = 'target' in ind ? (typeof ind.target === 'number' ? ind.target : 0) : 0;
                              const weight = ind.weight || 0;
                              
                              return (
                                <tr key={ind.id} className="group hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-5">
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-[9px] font-medium text-slate-400 font-mono tracking-tighter uppercase">{ind.code}</span>
                                      <span className="text-xs font-medium text-slate-800">{ind.name}</span>
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-slate-100 text-slate-500 text-[8px] border-slate-200/50 uppercase tracking-widest">{ind.polarity === 'Cima' ? 'Polaridade: ↑' : ind.polarity === 'Baixo' ? 'Polaridade: ↓' : 'Polaridade: ='}</Badge>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5">
                                    <div className="flex flex-col gap-3">
                                      <div className="flex items-center gap-3">
                                        <Target className="h-3 w-3 text-slate-300" />
                                        <span className="text-sm font-black text-slate-800">{target}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Weight className="h-3 w-3 text-slate-300" />
                                        <span className="text-sm font-black text-indigo-500">{weight}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Criado em</span>
                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-3 w-3 text-slate-300" />
                                          <span className="text-[10px] font-medium text-slate-600">{audit.createdAt}</span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Alertas de Mudança</span>
                                        <div className="flex flex-wrap gap-2">
                                          {audit.hasTargetChange && (
                                            <span className="h-4 w-4 rounded bg-amber-50 border border-amber-100 flex items-center justify-center text-[8px] font-bold text-amber-600" title="Mudança de Meta">M</span>
                                          )}
                                          {audit.hasWeightChange && (
                                            <span className="h-4 w-4 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600" title="Mudança de Peso">P</span>
                                          )}
                                          {audit.hasTeamChange && (
                                            <span className="h-4 w-4 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-600" title="Mudança de Time/Área">T</span>
                                          )}
                                          {!audit.hasTargetChange && !audit.hasWeightChange && !audit.hasTeamChange && (
                                            <span className="text-[9px] font-light text-slate-300">Nenhuma alteração</span>
                                          )}
                                        </div>
                                      </div>
                                      {audit.lastChange && (
                                        <div className="col-span-2 flex items-center gap-2 text-[9px] text-slate-400 mt-2">
                                          <History className="h-3 w-3" />
                                          <span>ÚLTIMA INTERAÇÃO: {audit.lastChange}</span>
                                          <span className="text-slate-200">|</span>
                                          <span>{audit.totalChanges} REGISTROS</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 text-center">
                                    <div className="flex justify-center">
                                      {getStatusBadge(ind.status)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                      <button 
                                        onClick={() => onOpenAuditTrail({ id: ind.id, name: ind.name })}
                                        className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 transition-all"
                                        title="Ver Histórico Completo"
                                      >
                                        <History className="h-4 w-4" />
                                      </button>
                                      <button 
                                        onClick={() => onEdit(ind as KPI)}
                                        className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 transition-all"
                                        title="Editar Indicador"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          if ('responsibleId' in ind) {
                                            onDeleteInventory(ind.id);
                                          } else {
                                            onDeleteKPI(ind.id);
                                          }
                                        }}
                                        className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 transition-all"
                                        title="Excluir Indicador"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
          {structureData.length === 0 && (
            <div className="flex flex-col items-center justify-center py-40 text-slate-300">
              <div className="h-20 w-20 rounded-[2rem] bg-slate-50 flex items-center justify-center border border-slate-100 mb-6 font-thin">
                <Search className="h-10 w-10 opacity-20" />
              </div>
              <p className="text-[10px] uppercase tracking-widest font-black">Nenhuma estrutura encontrada</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
