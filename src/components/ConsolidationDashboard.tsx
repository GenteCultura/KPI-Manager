import React, { useMemo, useState } from 'react';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, ComposedChart, Area, Cell
} from 'recharts';
import { Filter, Calendar, Layout, Users, TrendingUp, Target, Award, ChevronDown, Search, PieChart as PieIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { User, ConsolidatedIndicator, Diretoria, Departamento, Team } from '../types';
import { calculateWeightedAchievement, calculateKPIStatus } from '../utils/calculationEngine';
import { Input } from './ui/Input';
import { motion, AnimatePresence } from 'framer-motion';

import { Skeleton, ChartSkeleton } from './ui/Skeleton';

interface ConsolidationDashboardProps {
  currentUser: User | null;
  isLoading?: boolean;
}

export const ConsolidationDashboard = ({ currentUser, isLoading = false }: ConsolidationDashboardProps) => {
  const { consolidations, diretorias, departamentos, gerencias, servicos, teams, users } = useStore();
  
  // Filters
  const [monthFilter, setMonthFilter] = useState('');
  const [diretoriaFilter, setDiretoriaFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [gerenciaFilter, setGerenciaFilter] = useState('');
  const [servicoFilter, setServicoFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [collaboratorFilter, setCollaboratorFilter] = useState('');

  // RBAC Filtering
  const filteredConsolidations = useMemo(() => {
    const filtered = consolidations.filter(c => {
      // RBAC: onlyOwnIndicators
      if (currentUser?.permissions?.onlyOwnIndicators && c.collaboratorId !== currentUser.id) {
        return false;
      }
      
      // RBAC: allowedAreas
      if (currentUser?.permissions?.allowedAreas?.length && c.diretoriaId && !currentUser.permissions.allowedAreas.includes(c.diretoriaId)) {
        return false;
      }

      // RBAC: allowedTeams
      if (currentUser?.permissions?.allowedTeams?.length && c.teamId && !currentUser.permissions.allowedTeams.includes(c.teamId)) {
        return false;
      }

      // UI Filters
      const matchesMonth = !monthFilter || c.month === monthFilter;
      const matchesDiretoria = !diretoriaFilter || c.diretoriaId === diretoriaFilter;
      const matchesDept = !deptFilter || c.departmentId === deptFilter;
      const matchesGerencia = !gerenciaFilter || c.gerenciaId === gerenciaFilter;
      const matchesServico = !servicoFilter || c.servicoId === servicoFilter;
      const matchesTeam = !teamFilter || c.teamId === teamFilter;
      const matchesCollaborator = !collaboratorFilter || c.collaboratorId === collaboratorFilter;

      return matchesMonth && matchesDiretoria && matchesDept && matchesGerencia && matchesServico && matchesTeam && matchesCollaborator;
    });

    // Group by collaborator + month and take the most recent one
    const latestByCollabMonth = new Map<string, ConsolidatedIndicator>();
    
    [...filtered]
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      .forEach(c => {
        const key = `${c.collaboratorId}_${c.month}`;
        latestByCollabMonth.set(key, c);
      });
      
    return Array.from(latestByCollabMonth.values());
  }, [consolidations, currentUser, monthFilter, diretoriaFilter, deptFilter, teamFilter, collaboratorFilter]);

  // Chart Data: Evolution over months
  const evolutionData = useMemo(() => {
    const months = [...new Set(consolidations.map(c => c.month))].sort();
    return months.map(m => {
      const monthConsolidations = filteredConsolidations.filter(c => c.month === m);
      const avgScore = monthConsolidations.length > 0
        ? monthConsolidations.reduce((sum, c) => sum + calculateWeightedAchievement(c), 0) / monthConsolidations.length
        : 0;
      
      return {
        month: m,
        score: Math.round(avgScore * 100) / 100,
        count: monthConsolidations.length
      };
    });
  }, [filteredConsolidations, consolidations]);

  // Chart Data: Performance by Diretoria
  const diretoriaData = useMemo(() => {
    return diretorias.map(d => {
      const areaConsolidations = filteredConsolidations.filter(c => c.diretoriaId === d.id);
      const avgScore = areaConsolidations.length > 0
        ? areaConsolidations.reduce((sum, c) => sum + calculateWeightedAchievement(c), 0) / areaConsolidations.length
        : 0;
      
      return {
        name: d.name,
        score: Math.round(avgScore * 100) / 100,
        count: areaConsolidations.length
      };
    }).filter(d => d.count > 0);
  }, [filteredConsolidations, diretorias]);

  // Chart Data: Performance by Team
  const teamData = useMemo(() => {
    return teams.map(t => {
      const teamConsolidations = filteredConsolidations.filter(c => c.teamId === t.id);
      const avgScore = teamConsolidations.length > 0
        ? teamConsolidations.reduce((sum, c) => sum + calculateWeightedAchievement(c), 0) / teamConsolidations.length
        : 0;
      
      return {
        name: t.name,
        score: Math.round(avgScore * 100) / 100,
        count: teamConsolidations.length
      };
    }).filter(t => t.count > 0);
  }, [filteredConsolidations, teams]);

  // Chart Data: Status distribution of all indicators within consolidations
  const kpiStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      'Superou a Meta': 0,
      'Atingiu a Meta': 0,
      'Abaixo da Meta': 0,
    };

    filteredConsolidations.forEach(c => {
      c.indicators.forEach(ind => {
        const status = calculateKPIStatus(ind.actual, ind.target, ind.polarity || 'Cima');
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }
      });
    });

    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [filteredConsolidations]);

  const STATUS_COLORS: Record<string, string> = {
    'Superou a Meta': '#10b981',
    'Atingiu a Meta': '#f59e0b',
    'Abaixo da Meta': '#ef4444',
  };

  const IDC_TARGET = 85;

  const stats = useMemo(() => {
    const scores = filteredConsolidations
      .map(c => calculateWeightedAchievement(c))
      .filter((s): s is number | null => s !== null) as number[];
    
    const totalScore = scores.reduce((sum, s) => sum + s, 0);
    const avgScore = scores.length > 0 ? totalScore / scores.length : 0;
    const aboveTarget = scores.filter(s => s >= IDC_TARGET).length;
    
    return {
      avg: Math.round(avgScore * 100) / 100,
      total: filteredConsolidations.length,
      aboveTarget,
      percentAbove: filteredConsolidations.length > 0 ? Math.round((aboveTarget / filteredConsolidations.length) * 100) : 0
    };
  }, [filteredConsolidations]);

  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <TrendingUp className="h-7 w-7 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Consolidação</h1>
            <p className="text-slate-400 text-[10px] font-light tracking-widest mt-1 uppercase">Visão geral de performance e atingimento de metas.</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2.5 text-slate-400">
            <Filter className="h-4 w-4" />
            <span className="text-[10px] font-medium uppercase tracking-[0.15em]">Filtros</span>
          </div>
          
          <div className="flex flex-wrap gap-4 flex-1">
            <div className="relative min-w-[160px]">
              <Calendar className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <Input 
                type="month"
                className="h-10 pl-11 !rounded-xl border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>

            <div className="relative min-w-[200px]">
              <Layout className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <select 
                className="w-full h-10 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none"
                value={diretoriaFilter}
                onChange={(e) => setDiretoriaFilter(e.target.value)}
              >
                <option value="">Todas as Diretorias</option>
                {diretorias.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>

            <div className="relative min-w-[200px]">
              <Layout className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <select 
                className="w-full h-10 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">Todos os Departamentos</option>
                {departamentos
                  .filter(d => !diretoriaFilter || d.diretoriaId === diretoriaFilter)
                  .map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>

            <div className="relative min-w-[200px]">
              <Layout className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <select 
                className="w-full h-10 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none"
                value={gerenciaFilter}
                onChange={(e) => setGerenciaFilter(e.target.value)}
              >
                <option value="">Todas as Gerências</option>
                {gerencias
                  .filter(g => !deptFilter || g.departmentId === deptFilter)
                  .map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>

            <div className="relative min-w-[200px]">
              <Layout className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <select 
                className="w-full h-10 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none"
                value={servicoFilter}
                onChange={(e) => setServicoFilter(e.target.value)}
              >
                <option value="">Todos os Serviços</option>
                {servicos
                  .filter(s => !gerenciaFilter || s.gerenciaId === gerenciaFilter)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>

            <div className="relative min-w-[200px]">
              <Users className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <select 
                className="w-full h-10 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
              >
                <option value="">Todos os Times</option>
                {teams
                  .filter(t => {
                    if (servicoFilter) return t.servicoId === servicoFilter;
                    if (gerenciaFilter) return t.gerenciaId === gerenciaFilter;
                    return true;
                  })
                  .map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>

            <div className="relative min-w-[200px]">
              <Users className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
              <select 
                className="w-full h-10 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 focus:outline-none transition-all appearance-none disabled:bg-slate-50/50 disabled:text-slate-300"
                value={currentUser?.permissions?.onlyOwnIndicators ? currentUser.id : collaboratorFilter}
                onChange={(e) => setCollaboratorFilter(e.target.value)}
                disabled={currentUser?.permissions?.onlyOwnIndicators}
              >
                <option value="">Todos os Colaboradores</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>

            {(monthFilter || diretoriaFilter || deptFilter || gerenciaFilter || servicoFilter || teamFilter || collaboratorFilter) && (
              <button 
                onClick={() => {
                  setMonthFilter('');
                  setDiretoriaFilter('');
                  setDeptFilter('');
                  setGerenciaFilter('');
                  setServicoFilter('');
                  setTeamFilter('');
                  setCollaboratorFilter('');
                }}
                className="text-[10px] font-medium text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-all"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-800 p-8 text-white shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="p-2 bg-white/10 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] opacity-50">Média Geral</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-normal tracking-tight">{stats.avg} pts</span>
            <span className="text-[9px] font-light opacity-40 mt-2 uppercase tracking-[0.2em]">Desempenho consolidado</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-6">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
              <Target className="h-5 w-5 text-slate-400" />
            </div>
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Meta Batida</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-normal tracking-tight text-slate-800">{stats.percentAbove}%</span>
            <span className="text-[9px] font-light text-slate-400 mt-2 uppercase tracking-[0.2em]">{stats.aboveTarget} de {stats.total} colaboradores</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-6">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
              <Award className="h-5 w-5 text-slate-400" />
            </div>
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Total Consolidado</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-normal tracking-tight text-slate-800">{stats.total}</span>
            <span className="text-[9px] font-light text-slate-400 mt-2 uppercase tracking-[0.2em]">Índices processados</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-6">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
              <Users className="h-5 w-5 text-slate-400" />
            </div>
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">Abrangência</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-normal tracking-tight text-slate-800">{diretoriaData.length}</span>
            <span className="text-[9px] font-light text-slate-400 mt-2 uppercase tracking-[0.2em]">Diretorias com resultados</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Evolution Chart */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-sm font-medium text-slate-800 uppercase tracking-[0.15em]">Evolução Mensal</h3>
              <p className="text-[10px] font-light text-slate-400 mt-1 uppercase tracking-widest">Média de desempenho ao longo do tempo</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-slate-800" />
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Score Médio</span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <ComposedChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 400, fill: '#94a3b8' }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 400, fill: '#94a3b8' }}
                    domain={[0, 120]}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} pts`, 'Pontuação']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '10px' }}
                    labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  />
                  <Area type="monotone" dataKey="score" fill="#1e293b" fillOpacity={0.03} stroke="none" isAnimationActive={false} />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#1e293b" 
                    strokeWidth={2} 
                    dot={{ r: 3, fill: '#1e293b', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Performance by Diretoria */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-sm font-medium text-slate-800 uppercase tracking-[0.15em]">Ranking por Diretoria</h3>
              <p className="text-[10px] font-light text-slate-400 mt-1 uppercase tracking-widest">Comparativo de resultados entre áreas</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <BarChart data={diretoriaData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 400, fill: '#94a3b8' }}
                    width={100}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} pts`, 'Pontuação']}
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '10px' }}
                  />
                  <Bar 
                    dataKey="score" 
                    fill="#1e293b" 
                    radius={[0, 4, 4, 0]} 
                    barSize={16}
                    isAnimationActive={false}
                  >
                    {diretoriaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.score > IDC_TARGET ? '#10b981' : entry.score === IDC_TARGET ? '#f59e0b' : '#ef4444'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Performance by Team */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-sm font-medium text-slate-800 uppercase tracking-[0.15em]">Desempenho por Time</h3>
              <p className="text-[10px] font-light text-slate-400 mt-1 uppercase tracking-widest">Visão detalhada por equipes de trabalho</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <BarChart data={teamData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 400, fill: '#94a3b8' }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 400, fill: '#94a3b8' }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} pts`, 'Pontuação']}
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '10px' }}
                  />
                  <Bar 
                    dataKey="score" 
                    fill="#1e293b" 
                    radius={[4, 4, 0, 0]} 
                    barSize={32}
                    isAnimationActive={false}
                    fillOpacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status distribution of KPIs within consolidations */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-sm font-medium text-slate-800 uppercase tracking-[0.15em]">Status dos KPIs</h3>
              <p className="text-[10px] font-light text-slate-400 mt-1 uppercase tracking-widest">Distribuição de atingimento dos indicadores consolidados</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
              <PieIcon className="h-4 w-4 text-slate-400" />
            </div>
          </div>
          <div className="h-[350px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : kpiStatusData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <div className="h-20 w-20 rounded-full border-2 border-dashed border-slate-100 flex items-center justify-center">
                  <PieIcon className="h-8 w-8 text-slate-100" />
                </div>
                <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">Sem dados de indicadores</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <PieChart>
                  <Pie
                    data={kpiStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {kpiStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#94a3b8'} fillOpacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '10px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    formatter={(value) => <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-2">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
