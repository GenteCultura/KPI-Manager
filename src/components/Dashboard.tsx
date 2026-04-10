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
import { KPI, User, ConsolidatedIndicator, Area, Team, KPIStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { calculateWeightedAchievement } from '../utils/calculationEngine';
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
  const { areas: storeAreas, teams: storeTeams, diretorias, departamentos, gerencias } = useStore();
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
    return consolidations.filter(c => c.month === selectedMonth);
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
      const status = kpi.kpiStatus || 'Sem Dados';
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      } else {
        statusCounts['Sem Dados']++;
      }
    });

    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [filteredKpis]);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'];

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
        score: Math.round(data.total / data.count)
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
      const mConsolidations = consolidations.filter(c => c.month === m);
      const validScores = mConsolidations
        .map(c => calculateWeightedAchievement(c))
        .filter((s): s is number => s !== null);
      
      const totalScore = validScores.reduce((acc, s) => acc + s, 0);
      const avgScore = validScores.length > 0 ? Math.round(totalScore / validScores.length) : 0;
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
      const avgScore = groupConsolidations.length > 0 ? Math.round(totalScore / groupConsolidations.length) : 0;
      
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
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }, [filteredMonthConsolidations]);

  const stats = [
    { label: 'IDC Global', value: `${globalIdco}%`, change: `Meta: ${IDC_TARGET}%`, icon: LayoutDashboard, color: globalIdco > IDC_TARGET ? 'emerald' : globalIdco === IDC_TARGET ? 'amber' : 'rose', trend: globalIdco >= IDC_TARGET ? 'up' : 'down' },
    { label: 'Total de KPIs', value: totalKpis.toString(), change: `${kpiCompletionRate}% Preenchido`, icon: BarChart3, color: 'indigo', trend: 'up' },
    { label: 'Usuários Ativos', value: activeUsers.toString(), change: `${activeRate}% Ativos`, icon: Users, color: 'emerald', trend: 'up' },
    { label: 'Taxa de Consolidação', value: `${activeUsers > 0 ? Math.round((filteredMonthConsolidations.length / activeUsers) * 100) : 0}%`, change: `${filteredMonthConsolidations.length} Concluídas`, icon: Activity, color: 'sky', trend: 'up' },
  ];

  const colorMap: Record<string, { bg: string, text: string, border: string, iconBg: string }> = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', iconBg: 'bg-indigo-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', iconBg: 'bg-emerald-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', iconBg: 'bg-amber-600' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', iconBg: 'bg-rose-600' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100', iconBg: 'bg-sky-600' },
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-indigo-600 text-white shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50">
            <LayoutDashboard className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Dashboard Executivo</h1>
            <p className="text-slate-500 font-medium">Análise de performance corporativa e indicadores de gestão.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
            <Calendar className="h-5 w-5 text-indigo-500 ml-2" />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm font-black text-slate-700 outline-none bg-transparent border-none focus:ring-0 cursor-pointer"
            />
          </div>

          <Button 
            variant="outline" 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`!h-12 gap-2 !rounded-2xl px-6 font-bold border-slate-200 shadow-sm transition-all ${isFilterOpen ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <Filter className="h-5 w-5" />
            Filtros Avançados
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 rounded-[2.5rem] border border-indigo-100 bg-white shadow-xl shadow-indigo-100/20">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Diretoria</label>
                <select 
                   className="w-full h-12 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none cursor-pointer transition-all"
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
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Departamento</label>
                <select 
                  className="w-full h-12 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none cursor-pointer transition-all"
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
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Gerência</label>
                <select 
                  className="w-full h-12 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none cursor-pointer transition-all"
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
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Time / Equipe</label>
                <select 
                  className="w-full h-12 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none cursor-pointer transition-all"
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
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const colors = colorMap[stat.color] || colorMap.indigo;
          return (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40 group hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-500"
            >
              <div className="flex items-center justify-between mb-6">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${colors.iconBg} text-white shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform duration-500`}>
                  <stat.icon className="h-7 w-7" />
                </div>
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stat.change}
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</h3>
              <p className="text-4xl font-black text-slate-900 mt-2 tracking-tight">{stat.value}</p>
              
              {/* Decorative background element */}
              <div className={`absolute -right-4 -bottom-4 h-24 w-24 rounded-full ${colors.bg} opacity-20 group-hover:scale-150 transition-transform duration-700`} />
            </motion.div>
          );
        })}
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Performance Trend Chart */}
        <div className="lg:col-span-2 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900">Evolução de Performance</h3>
              <p className="text-sm text-slate-500 font-medium">Média global de IDCO nos últimos 6 meses.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div className="h-[400px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <AreaChart data={monthlyTrendData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}
                  />
                  <RechartsArea 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#4f46e5" 
                    strokeWidth={4} 
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
        <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900">Status dos KPIs</h3>
              <p className="text-sm text-slate-500 font-medium">Distribuição atual de metas.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <PieChartIcon className="h-6 w-6" />
            </div>
          </div>
          <div className="h-[400px] w-full">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={1}>
                <PieChart>
                  <Pie
                    data={kpiStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {kpiStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total KPIs</p>
              <p className="text-xl font-black text-slate-900">{totalKpis}</p>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Batidos</p>
              <p className="text-xl font-black text-indigo-600">{metTargets}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Collaborator Status Table */}
        <div className="lg:col-span-2 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Status por Colaborador</h3>
              <p className="text-sm text-slate-500 font-medium">Acompanhamento de consolidações para {selectedMonth}</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Buscar colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50/50 pl-12 pr-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {collaboratorsStatus.map((collab) => (
              <motion.div 
                key={collab.id} 
                layout
                className="flex items-center justify-between p-5 rounded-3xl border border-slate-50 bg-white hover:border-indigo-100 hover:bg-indigo-50/20 hover:shadow-lg hover:shadow-indigo-100/20 transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-center gap-5">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-black transition-all duration-300 ${collab.hasConsolidation ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                    {collab.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{collab.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {departamentos.find(d => d.id === collab.departmentId)?.name || 'N/A'}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="text-xs font-bold text-indigo-500">{collab.role}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-8 shrink-0">
                  {collab.hasConsolidation ? (
                    <div className="flex flex-col items-end">
                      {collab.score === null ? (
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs font-black uppercase tracking-widest">Férias / N/A</span>
                        </div>
                      ) : (
                        <>
                          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border ${collab.score > IDC_TARGET ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : collab.score === IDC_TARGET ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {collab.score >= IDC_TARGET ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            <span className="text-xs font-black uppercase tracking-widest">
                              {collab.score > IDC_TARGET ? 'Superou a Meta' : collab.score === IDC_TARGET ? 'Atingiu a Meta' : 'Não atingiu a Meta'}
                            </span>
                          </div>
                          <span className="text-xs font-black text-slate-900 mt-2">Score: {collab.score}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs font-black uppercase tracking-widest">Pendente</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {collaboratorsStatus.length === 0 && (
              <div className="py-24 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-slate-50 text-slate-200 mx-auto mb-6 shadow-inner">
                  <Users className="h-10 w-10" />
                </div>
                <p className="text-slate-400 font-bold text-lg">Nenhum colaborador encontrado.</p>
              </div>
            )}
          </div>
        </div>

        {/* Side Panels */}
        <div className="space-y-8">
          {/* Department Performance Bar Chart */}
          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40">
            <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3">
              <Network className="h-5 w-5 text-indigo-600" />
              Performance por Depto.
            </h3>
          <div className="h-[400px] w-full">
            {isLoading ? (
              <ChartSkeleton />
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
                    width={100}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="score" 
                    fill="#4f46e5" 
                    radius={[0, 8, 8, 0]} 
                    barSize={20}
                    isAnimationActive={false}
                  >
                    {deptPerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.score > IDC_TARGET ? '#10b981' : entry.score === IDC_TARGET ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          </div>

          {/* Tenure Breakdown */}
          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40">
            <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3">
              <Clock className="h-5 w-5 text-indigo-600" />
              IDCO por Tempo de Casa
            </h3>
            <div className="space-y-8">
              {idcoByTenure.map((item, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{item.group}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1">{item.count} consolidados</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black tracking-tight ${item.avgScore >= IDC_TARGET ? 'text-emerald-600' : item.avgScore >= 50 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {item.avgScore}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">pts</span>
                    </div>
                  </div>
                  <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.avgScore}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className={`h-full rounded-full shadow-sm ${item.avgScore >= IDC_TARGET ? 'bg-emerald-500' : item.avgScore >= 50 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Atividades Recentes</h4>
            <div className="space-y-6">
              {consolidations.slice(-4).reverse().map((c, i) => (
                <div key={c.id} className="flex items-start gap-4 relative">
                  {i < 3 && <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-100" />}
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm z-10">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-black text-slate-900 truncate">{c.collaboratorName}</p>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">Consolidado em {c.month}</p>
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

