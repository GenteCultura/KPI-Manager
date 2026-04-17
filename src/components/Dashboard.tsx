import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Search, 
  Filter, 
  User as UserIcon, 
  ChevronDown, 
  Network, 
  Layout,
  TrendingUp,
  PieChart as PieChartIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Target
} from 'lucide-react';
import { KPI, User, ConsolidatedIndicator, Area, Team, KPIStatus, CalendarEvent } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { calculateWeightedAchievement, calculateKPIStatus } from '../utils/calculationEngine';
import { Button } from './ui/Button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  AreaChart,
  Area as RechartsArea,
  Legend
} from 'recharts';

import { Skeleton, ChartSkeleton } from './ui/Skeleton';

interface DashboardProps {
  kpis: KPI[];
  users: User[];
  consolidations: ConsolidatedIndicator[];
  areas?: Area[];
  teams?: Team[];
  isLoading?: boolean;
}

export const Dashboard = ({ kpis, users, consolidations, areas: propAreas, teams: propTeams, isLoading = false }: DashboardProps) => {
  const { areas: storeAreas, teams: storeTeams, diretorias, departamentos, gerencias, calendarEvents } = useStore();
  const areas = propAreas || storeAreas;
  const teams = propTeams || storeTeams;
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [selectedDiretoria, setSelectedDiretoria] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedGerencia, setSelectedGerencia] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const monthConsolidations = useMemo(() => {
    const filtered = consolidations.filter(c => c.month === selectedMonth);
    
    // Group by collaborator and take the most recent one
    const latestByCollab = new Map<string, ConsolidatedIndicator>();
    
    // Sort by createdAt ascending so the last one processed is the most recent
    [...filtered]
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      .forEach(c => {
        latestByCollab.set(c.collaboratorId, c);
      });
      
    return Array.from(latestByCollab.values());
  }, [consolidations, selectedMonth]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDiretoria = !selectedDiretoria || user.diretoriaId === selectedDiretoria;
      const matchesDept = !selectedDepartment || user.departmentId === selectedDepartment;
      const matchesGerencia = !selectedGerencia || user.gerenciaId === selectedGerencia;
      const matchesTeam = !selectedTeam || user.teamId === selectedTeam;
      
      return matchesSearch && matchesDiretoria && matchesDept && matchesGerencia && matchesTeam;
    });
  }, [users, searchTerm, selectedDiretoria, selectedDepartment, selectedGerencia, selectedTeam]);

  const filteredKpis = useMemo(() => {
    if (!selectedDiretoria && !selectedDepartment && !selectedGerencia && !selectedTeam) return kpis;
    
    return kpis.filter(kpi => {
      const owner = users.find(u => u.id === kpi.ownerId);
      if (!owner) return false;
      const matchesDiretoria = !selectedDiretoria || owner.diretoriaId === selectedDiretoria;
      const matchesDept = !selectedDepartment || owner.departmentId === selectedDepartment;
      const matchesGerencia = !selectedGerencia || owner.gerenciaId === selectedGerencia;
      const matchesTeam = !selectedTeam || owner.teamId === selectedTeam;
      return matchesDiretoria && matchesDept && matchesGerencia && matchesTeam;
    });
  }, [kpis, users, selectedDiretoria, selectedDepartment, selectedGerencia, selectedTeam]);

  // Chart Data: KPI Status Distribution
  const kpiStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      'Superou a Meta': 0,
      'Atingiu a Meta': 0,
      'Abaixo da Meta': 0,
      'Sem Dados': 0
    };

    filteredKpis.forEach(kpi => {
      let status: string | undefined = kpi.kpiStatus;
      
      // If status is missing, calculate it on the fly
      if (!status && kpi.actual !== undefined && kpi.target !== undefined) {
        status = calculateKPIStatus(kpi.actual, kpi.target, kpi.polarity || 'Cima');
      }
      
      const finalStatus = status || 'Sem Dados';
      
      if (statusCounts[finalStatus] !== undefined) {
        statusCounts[finalStatus]++;
      } else {
        statusCounts['Sem Dados']++;
      }
    });

    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0); // Only show statuses that have at least one KPI
  }, [filteredKpis]);

  const STATUS_COLORS: Record<string, string> = {
    'Superou a Meta': '#10b981',
    'Atingiu a Meta': '#f59e0b',
    'Abaixo da Meta': '#ef4444',
    'Sem Dados': '#94a3b8'
  };

  // Chart Data: Performance by Department
  const deptPerformanceData = useMemo(() => {
    const deptScores: Record<string, { total: number, count: number }> = {};
    
    monthConsolidations.forEach(c => {
      const score = calculateWeightedAchievement(c);
      if (score === null) return; // Skip vacation
      
      const user = users.find(u => u.id === c.collaboratorId);
      if (user) {
        const deptName = departamentos.find(d => d.id === user.departmentId)?.name || 'Outros';
        if (!deptScores[deptName]) deptScores[deptName] = { total: 0, count: 0 };
        deptScores[deptName].total += score;
        deptScores[deptName].count++;
      }
    });

    return Object.entries(deptScores)
      .map(([name, data]) => ({
        name,
        score: Math.round((data.total / data.count) * 100) / 100
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [monthConsolidations, users, departamentos]);

  // Chart Data: Monthly Trend (Last 6 months)
  const monthlyTrendData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }

    return months.map(m => {
      const mFiltered = consolidations.filter(c => c.month === m);
      
      // Deduplicate for this month
      const latestByCollab = new Map<string, ConsolidatedIndicator>();
      [...mFiltered]
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        .forEach(c => {
          latestByCollab.set(c.collaboratorId, c);
        });
      
      const mConsolidations = Array.from(latestByCollab.values());
      const validScores = mConsolidations
        .map(c => calculateWeightedAchievement(c))
        .filter((s): s is number => s !== null);
      
      const totalScore = validScores.reduce((acc, s) => acc + s, 0);
      const avgScore = validScores.length > 0 ? Math.round((totalScore / validScores.length) * 100) / 100 : 0;
      return {
        month: m.split('-')[1] + '/' + m.split('-')[0].slice(2),
        score: avgScore
      };
    });
  }, [consolidations]);

  const IDC_TARGET = 85; // Meta global de IDC

  const totalKpis = filteredKpis.length;
  const activeUsers = filteredUsers.length;
  const metTargets = filteredKpis.filter(kpi => (kpi.actual || 0) >= (kpi.target || 0) && (kpi.target || 0) > 0).length;
  
  const kpisWithActual = filteredKpis.filter(kpi => kpi.actual !== undefined && kpi.actual !== null).length;
  const kpiCompletionRate = totalKpis > 0 ? Math.round((kpisWithActual / totalKpis) * 100) : 0;

  const activeStatusUsers = filteredUsers.filter(u => u.status === 'Ativo').length;
  const activeRate = filteredUsers.length > 0 ? Math.round((activeStatusUsers / filteredUsers.length) * 100) : 0;

  const filteredMonthConsolidations = useMemo(() => {
    return monthConsolidations.filter(c => 
      filteredUsers.some(u => u.id === c.collaboratorId)
    );
  }, [monthConsolidations, filteredUsers]);

  const collaboratorsStatus = useMemo(() => {
    return filteredUsers.map(user => {
      const userConsolidation = monthConsolidations.find(c => c.collaboratorId === user.id);
      return {
        ...user,
        hasConsolidation: !!userConsolidation,
        score: userConsolidation ? calculateWeightedAchievement(userConsolidation) : null
      };
    });
  }, [filteredUsers, monthConsolidations]);

  const calculateTenureGroup = (hireDate?: string) => {
    if (!hireDate) return 'N/A';
    const hire = new Date(hireDate);
    const now = new Date();
    const diffMonths = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
    
    if (diffMonths < 6) return '< 6 meses';
    if (diffMonths < 12) return '6-12 meses';
    if (diffMonths < 24) return '1-2 anos';
    return '> 2 anos';
  };

  const idcoByTenure = useMemo(() => {
    const groups = ['< 6 meses', '6-12 meses', '1-2 anos', '> 2 anos'];
    return groups.map(group => {
      const groupUsers = filteredUsers.filter(u => calculateTenureGroup(u.hireDate) === group);
      const groupConsolidations = monthConsolidations.filter(c => 
        groupUsers.some(u => u.id === c.collaboratorId)
      );
      
      const totalScore = groupConsolidations.reduce((acc, c) => acc + calculateWeightedAchievement(c), 0);
      const avgScore = groupConsolidations.length > 0 ? Math.round((totalScore / groupConsolidations.length) * 100) / 100 : 0;
      
      return {
        group,
        avgScore,
        count: groupConsolidations.length,
        totalInGroup: groupUsers.length
      };
    });
  }, [filteredUsers, monthConsolidations]);

  const globalIdco = useMemo(() => {
    const scores = filteredMonthConsolidations
      .map(c => calculateWeightedAchievement(c))
      .filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
  }, [filteredMonthConsolidations]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return calendarEvents
      .filter(event => new Date(event.startDate) >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);
  }, [calendarEvents]);

  const stats = [
    { label: 'IDC Global', value: `${globalIdco} pts`, change: `Meta: ${IDC_TARGET} pts`, icon: LayoutDashboard, color: 'slate', trend: globalIdco >= IDC_TARGET ? 'up' : 'down' },
    { label: 'Total de KPIs', value: totalKpis.toString(), change: `${kpiCompletionRate}% Preenchido`, icon: BarChart3, color: 'slate', trend: 'up' },
    { label: 'Usuários Ativos', value: activeUsers.toString(), change: `${activeRate}% Ativos`, icon: Users, color: 'slate', trend: 'up' },
    { label: 'Taxa de Consolidação', value: `${activeUsers > 0 ? Math.round((filteredMonthConsolidations.length / activeUsers) * 100) : 0}%`, change: `${filteredMonthConsolidations.length} Concluídas`, icon: Activity, color: 'slate', trend: 'up' },
  ];

  const colorMap: Record<string, { bg: string, text: string, border: string, iconBg: string }> = {
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100', iconBg: 'bg-slate-500' },
    success: { bg: 'bg-[#F1F5F3]', text: 'text-[#8DA399]', border: 'border-[#E2E8E5]', iconBg: 'bg-[#8DA399]' },
    error: { bg: 'bg-[#F9F4F2]', text: 'text-[#C57B67]', border: 'border-[#EFE2DE]', iconBg: 'bg-[#C57B67]' },
    warning: { bg: 'bg-[#F7F4F0]', text: 'text-[#D4B483]', border: 'border-[#EFE9E0]', iconBg: 'bg-[#D4B483]' },
  };

  return (
    <div className="space-y-10 pb-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm ring-1 ring-slate-200">
            <LayoutDashboard className="h-6 w-6 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Dashboard Executivo</h1>
            <p className="text-slate-400 text-sm font-light mt-1">Análise de performance corporativa e indicadores de gestão.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-normal text-slate-600 outline-none bg-transparent border-none focus:ring-0 cursor-pointer"
            />
          </div>

          <Button 
            variant="outline" 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`!h-10 gap-2 !rounded-lg px-5 text-xs font-normal tracking-wide border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all ${isFilterOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter className="h-4 w-4" />
            Filtros Avançados
            <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] ml-1">Diretoria</label>
                <select 
                   className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50/30 px-4 text-xs font-normal text-slate-600 focus:border-slate-400 outline-none cursor-pointer transition-all"
                  value={selectedDiretoria}
                  onChange={(e) => {
                    setSelectedDiretoria(e.target.value);
                    setSelectedDepartment('');
                    setSelectedGerencia('');
                    setSelectedTeam('');
                  }}
                >
                  <option value="">Todas as Diretorias</option>
                  {diretorias.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] ml-1">Departamento</label>
                <select 
                  className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50/30 px-4 text-xs font-normal text-slate-600 focus:border-slate-400 outline-none cursor-pointer transition-all"
                  value={selectedDepartment}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    setSelectedGerencia('');
                    setSelectedTeam('');
                  }}
                >
                  <option value="">Todos os Departamentos</option>
                  {departamentos.filter(d => !selectedDiretoria || d.diretoriaId === selectedDiretoria).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] ml-1">Gerência</label>
                <select 
                  className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50/30 px-4 text-xs font-normal text-slate-600 focus:border-slate-400 outline-none cursor-pointer transition-all"
                  value={selectedGerencia}
                  onChange={(e) => {
                    setSelectedGerencia(e.target.value);
                    setSelectedTeam('');
                  }}
                >
                  <option value="">Todas as Gerências</option>
                  {gerencias.filter(g => !selectedDepartment || g.departmentId === selectedDepartment).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] ml-1">Time / Equipe</label>
                <select 
                  className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50/30 px-4 text-xs font-normal text-slate-600 focus:border-slate-400 outline-none cursor-pointer transition-all"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                >
                  <option value="">Todos os Times</option>
                  {teams.filter(t => !selectedGerencia || t.gerenciaId === selectedGerencia).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const colors = colorMap[stat.color] || colorMap.slate;
          return (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_4px_rgba(0,0,0,0.02)] group hover:border-slate-300 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.iconBg} text-white shadow-sm transition-transform duration-500`}>
                  <stat.icon className="h-5 w-5 stroke-[1.5]" />
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium uppercase tracking-wider border ${stat.trend === 'up' ? 'bg-[#F1F5F3] text-[#8DA399] border-[#E2E8E5]' : 'bg-[#F9F4F2] text-[#C57B67] border-[#EFE2DE]'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                  {stat.change}
                </div>
              </div>
              <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em]">{stat.label}</h3>
              <p className="text-2xl font-normal text-slate-800 mt-1 tracking-tight">{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Performance Trend Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-normal tracking-wide text-slate-800 uppercase">Evolução de Performance</h3>
              <p className="text-xs text-slate-400 font-light mt-1">Média global de IDCO nos últimos 6 meses.</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-400 border border-slate-100">
              <TrendingUp className="h-5 w-5 stroke-[1.5]" />
            </div>
          </div>
          <div className="h-[350px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : monthlyTrendData.length === 0 || monthlyTrendData.every(d => d.score === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
                <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-xs font-normal">Sem dados de evolução para exibir</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <AreaChart data={monthlyTrendData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.05}/>
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 400 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 400 }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', padding: '8px' }}
                    labelStyle={{ fontWeight: 500, color: '#475569', fontSize: '12px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <RechartsArea 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#64748b" 
                    strokeWidth={1.5} 
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* KPI Status Distribution */}
        <div className="rounded-xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-normal tracking-wide text-slate-800 uppercase">Status dos KPIs</h3>
              <p className="text-xs text-slate-400 font-light mt-1">Distribuição atual de metas.</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-400 border border-slate-100">
              <PieChartIcon className="h-5 w-5 stroke-[1.5]" />
            </div>
          </div>
          <div className="h-[300px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : kpiStatusData.length === 0 || kpiStatusData.every(d => d.value === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
                <PieChartIcon className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-xs font-normal">Sem KPIs para analisar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <PieChart>
                  <Pie
                    data={kpiStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {kpiStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#94a3b8'} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-[10px] font-normal text-slate-500 uppercase tracking-wider">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50/50 border border-slate-100">
              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Total KPIs</p>
              <p className="text-lg font-normal text-slate-700 mt-1">{totalKpis}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50/50 border border-slate-100">
              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Batidos</p>
              <p className="text-lg font-normal text-slate-700 mt-1">{metTargets}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Collaborator Status Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <div>
              <h3 className="text-lg font-normal tracking-wide text-slate-800 uppercase">Status por Colaborador</h3>
              <p className="text-xs text-slate-400 font-light mt-1">Acompanhamento de consolidações para {selectedMonth}</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input 
                type="text"
                placeholder="Buscar colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/30 pl-11 pr-4 text-xs font-normal text-slate-600 focus:border-slate-400 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {collaboratorsStatus.map((collab) => (
              <motion.div 
                key={collab.id} 
                layout
                className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/30 transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-sm font-normal transition-all duration-300 ${collab.hasConsolidation ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                    {collab.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-normal text-slate-700 group-hover:text-slate-900 transition-colors truncate">{collab.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">
                        {departamentos.find(d => d.id === collab.departmentId)?.name || 'N/A'}
                      </span>
                      <span className="h-0.5 w-0.5 rounded-full bg-slate-200" />
                      <span className="text-[9px] font-medium text-slate-500">{collab.role}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 shrink-0">
                  {collab.hasConsolidation ? (
                    <div className="flex flex-col items-end">
                      {collab.score === null ? (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-50 text-slate-400 border border-slate-100">
                          <Clock className="h-3 w-3" />
                          <span className="text-[9px] font-medium uppercase tracking-wider">Férias</span>
                        </div>
                      ) : (
                        <>
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-md border ${collab.score > IDC_TARGET ? 'bg-[#F1F5F3] text-[#8DA399] border-[#E2E8E5]' : collab.score === IDC_TARGET ? 'bg-[#F7F4F0] text-[#D4B483] border-[#EFE9E0]' : 'bg-[#F9F4F2] text-[#C57B67] border-[#EFE2DE]'}`}>
                            <span className="text-[9px] font-medium uppercase tracking-wider">
                              {collab.score > IDC_TARGET ? 'Superou' : collab.score === IDC_TARGET ? 'Atingiu' : 'Abaixo'}
                            </span>
                          </div>
                          <span className="text-[10px] font-normal text-slate-500 mt-1.5">Score: {collab.score}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#F9F4F2] text-[#C57B67] border border-[#EFE2DE]">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-[9px] font-medium uppercase tracking-wider">Pendente</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {collaboratorsStatus.length === 0 && (
              <div className="py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-50 text-slate-200 mx-auto mb-4 border border-slate-100">
                  <Users className="h-8 w-8" />
                </div>
                <p className="text-slate-400 font-light text-sm">Nenhum colaborador encontrado.</p>
              </div>
            )}
          </div>
        </div>

        {/* Side Panels */}
        <div className="space-y-8">
          {/* Department Performance Bar Chart */}
          <div className="rounded-xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <h3 className="text-lg font-normal tracking-wide text-slate-800 uppercase mb-8 flex items-center gap-3">
              <Network className="h-4 w-4 text-slate-400" />
              Performance por Depto.
            </h3>
          <div className="h-[350px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : deptPerformanceData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
                <Network className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-xs font-normal">Sem dados por departamento</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <BarChart data={deptPerformanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={80}
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 400 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                  />
                  <Bar 
                    dataKey="score" 
                    fill="#64748b" 
                    radius={[0, 4, 4, 0]} 
                    barSize={12}
                    isAnimationActive={false}
                  >
                    {deptPerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.score > IDC_TARGET ? '#8DA399' : entry.score === IDC_TARGET ? '#D4B483' : '#C57B67'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          </div>

          {/* Upcoming Events Panel */}
          <div className="rounded-xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <h3 className="text-lg font-normal tracking-wide text-slate-800 uppercase mb-8 flex items-center gap-3">
              <Calendar className="h-4 w-4 text-slate-400" />
              Próximos Prazos
            </h3>
            <div className="space-y-3">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-normal text-slate-700 group-hover:text-slate-900 transition-colors truncate">{event.title}</h4>
                        <p className="text-[10px] font-light text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(event.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className={`px-2 py-0.5 rounded-md text-[8px] font-medium uppercase tracking-wider border ${
                        event.type === 'Deadline' ? 'bg-[#F9F4F2] text-[#C57B67] border-[#EFE2DE]' :
                        event.type === 'Meeting' ? 'bg-[#F1F5F3] text-[#8DA399] border-[#E2E8E5]' :
                        'bg-slate-50 text-slate-400 border-slate-100'
                      }`}>
                        {event.type}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-300">
                  <p className="text-xs font-normal">Nenhum evento próximo</p>
                </div>
              )}
              <Button 
                variant="outline" 
                className="w-full !h-9 !rounded-lg text-[10px] font-normal tracking-wide border-slate-200 mt-2"
                onClick={() => {}}
              >
                Ver Calendário Completo
              </Button>
            </div>
          </div>

          {/* Tenure Breakdown */}
          <div className="rounded-xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <h3 className="text-lg font-normal tracking-wide text-slate-800 uppercase mb-8 flex items-center gap-3">
              <Clock className="h-4 w-4 text-slate-400" />
              Performance por Tempo
            </h3>
            <div className="space-y-6">
              {idcoByTenure.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{item.group}</span>
                      <span className="text-[9px] font-light text-slate-400 mt-0.5">{item.count} consolidados</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-normal tracking-tight ${item.avgScore >= IDC_TARGET ? 'text-[#8DA399]' : item.avgScore >= 50 ? 'text-slate-600' : 'text-[#C57B67]'}`}>
                        {item.avgScore}
                      </span>
                      <span className="text-[9px] font-light text-slate-400">pts</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.avgScore}%` }}
                      transition={{ duration: 1, delay: i * 0.05 }}
                      className={`h-full rounded-full ${item.avgScore >= IDC_TARGET ? 'bg-[#8DA399]' : item.avgScore >= 50 ? 'bg-slate-400' : 'bg-[#C57B67]'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-8">Atividades Recentes</h4>
            <div className="space-y-5">
              {consolidations.slice(-4).reverse().map((c, i) => (
                <div key={c.id} className="flex items-start gap-4 relative">
                  {i < 3 && <div className="absolute left-4 top-8 bottom-0 w-[1px] bg-slate-100" />}
                  <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 z-10">
                    <CheckCircle2 className="h-4 w-4 stroke-[1.5]" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-xs font-normal text-slate-700 truncate">{c.collaboratorName}</p>
                    <p className="text-[10px] font-light text-slate-400 mt-0.5">Consolidado em {c.month}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

