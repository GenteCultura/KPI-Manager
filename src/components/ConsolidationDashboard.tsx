import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, ComposedChart, Area, Cell
} from 'recharts';
import { Filter, Calendar, Layout, Users, TrendingUp, Target, Award, ChevronDown, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { User, ConsolidatedIndicator, Diretoria, Departamento, Team } from '../types';
import { calculateWeightedAchievement } from '../utils/calculationEngine';
import { Input } from './ui/Input';
import { motion, AnimatePresence } from 'framer-motion';

import { Skeleton, ChartSkeleton } from './ui/Skeleton';

interface ConsolidationDashboardProps {
  currentUser: User | null;
  isLoading?: boolean;
}

export const ConsolidationDashboard = ({ currentUser, isLoading = false }: ConsolidationDashboardProps) => {
  const { consolidations, diretorias, departamentos, teams, users } = useStore();
  
  // Filters
  const [monthFilter, setMonthFilter] = useState('');
  const [diretoriaFilter, setDiretoriaFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [collaboratorFilter, setCollaboratorFilter] = useState('');

  // RBAC Filtering
  const filteredConsolidations = useMemo(() => {
    return consolidations.filter(c => {
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
      const matchesTeam = !teamFilter || c.teamId === teamFilter;
      const matchesCollaborator = !collaboratorFilter || c.collaboratorId === collaboratorFilter;

      return matchesMonth && matchesDiretoria && matchesDept && matchesTeam && matchesCollaborator;
    });
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
        score: Math.round(avgScore * 10) / 10,
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
        score: Math.round(avgScore * 10) / 10,
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
        score: Math.round(avgScore * 10) / 10,
        count: teamConsolidations.length
      };
    }).filter(t => t.count > 0);
  }, [filteredConsolidations, teams]);

  const IDC_TARGET = 85;

  const stats = useMemo(() => {
    const scores = filteredConsolidations
      .map(c => calculateWeightedAchievement(c))
      .filter((s): s is number | null => s !== null) as number[];
    
    const totalScore = scores.reduce((sum, s) => sum + s, 0);
    const avgScore = scores.length > 0 ? totalScore / scores.length : 0;
    const aboveTarget = scores.filter(s => s >= IDC_TARGET).length;
    
    return {
      avg: Math.round(avgScore * 10) / 10,
      total: filteredConsolidations.length,
      aboveTarget,
      percentAbove: filteredConsolidations.length > 0 ? Math.round((aboveTarget / filteredConsolidations.length) * 100) : 0
    };
  }, [filteredConsolidations]);

  return (
    <div className="flex flex-col gap-6">
      {/* Filters Bar */}
      <div className="card-base p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-bold text-indigo-700">Filtros do Dashboard</span>
          </div>
          
          <div className="flex flex-wrap gap-3 flex-1">
            <div className="relative min-w-[150px]">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input 
                type="month"
                className="pl-10 !h-10 !rounded-xl text-sm"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>

            <div className="relative min-w-[180px]">
              <Layout className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select 
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none"
                value={diretoriaFilter}
                onChange={(e) => setDiretoriaFilter(e.target.value)}
              >
                <option value="">Todas as Diretorias</option>
                {diretorias.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[180px]">
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select 
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
              >
                <option value="">Todos os Times</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[180px]">
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select 
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none disabled:bg-slate-50 disabled:text-slate-400"
                value={currentUser?.permissions?.onlyOwnIndicators ? currentUser.id : collaboratorFilter}
                onChange={(e) => setCollaboratorFilter(e.target.value)}
                disabled={currentUser?.permissions?.onlyOwnIndicators}
              >
                <option value="">Todos os Colaboradores</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {(monthFilter || diretoriaFilter || teamFilter || collaboratorFilter) && (
              <button 
                onClick={() => {
                  setMonthFilter('');
                  setDiretoriaFilter('');
                  setTeamFilter('');
                  setCollaboratorFilter('');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-base p-6 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-none shadow-indigo-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Média Geral</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tighter">{stats.avg}</span>
            <span className="text-xs font-medium opacity-80 mt-1">Pontuação média consolidada</span>
          </div>
        </div>

        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Meta Batida</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tighter text-slate-900">{stats.percentAbove}%</span>
            <span className="text-xs font-medium text-slate-500 mt-1">{stats.aboveTarget} de {stats.total} colaboradores</span>
          </div>
        </div>

        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Award className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Consolidado</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tighter text-slate-900">{stats.total}</span>
            <span className="text-xs font-medium text-slate-500 mt-1">Índices processados no período</span>
          </div>
        </div>

        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Abrangência</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black tracking-tighter text-slate-900">{diretoriaData.length}</span>
            <span className="text-xs font-medium text-slate-500 mt-1">Diretorias com resultados</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart */}
        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Evolução Mensal</h3>
              <p className="text-xs text-slate-500">Média de desempenho ao longo do tempo</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-indigo-600" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">Score Médio</span>
            </div>
          </div>
          <div className="h-[400px] w-full">
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
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                    domain={[0, 120]}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="score" fill="#4f46e5" fillOpacity={0.1} stroke="none" isAnimationActive={false} />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#4f46e5" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Performance by Diretoria */}
        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ranking por Diretoria</h3>
              <p className="text-xs text-slate-500">Comparativo de resultados entre áreas</p>
            </div>
          </div>
          <div className="h-[400px] w-full">
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
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="score" 
                    fill="#4f46e5" 
                    radius={[0, 4, 4, 0]} 
                    barSize={20}
                    isAnimationActive={false}
                  >
                    {diretoriaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.score > IDC_TARGET ? '#10b981' : entry.score === IDC_TARGET ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Performance by Team */}
        <div className="card-base p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Desempenho por Time</h3>
              <p className="text-xs text-slate-500">Visão detalhada por equipes de trabalho</p>
            </div>
          </div>
          <div className="h-[400px] w-full">
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
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="score" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
