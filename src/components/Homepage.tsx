import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  BarChart3, 
  Layers, 
  Network, 
  Activity, 
  Clock, 
  Calendar as CalendarIcon,
  Database,
  Calculator,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  FileText,
  Boxes
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { calculateKPIStatus } from '../utils/calculationEngine';
import { SupportChat } from './SupportChat';

interface HomepageProps {
  onNavigate: (view: any) => void;
}

export const Homepage = ({ onNavigate }: HomepageProps) => {
  const { 
    users, 
    kpis, 
    diretorias, 
    departamentos, 
    gerencias, 
    teams, 
    consolidations, 
    inventoryIndicators,
    auditLogs
  } = useStore();

  const activeUsers = users.filter(u => u.status === 'Ativo').length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthConsolidations = consolidations.filter(c => c.month === currentMonth).length;
  const consolidationRate = activeUsers > 0 ? Math.round((monthConsolidations / activeUsers) * 100) : 0;

  const kpiStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      'Superou a Meta': 0,
      'Atingiu a Meta': 0,
      'Abaixo da Meta': 0,
      'Sem Dados': 0
    };

    kpis.forEach(kpi => {
      let status = kpi.kpiStatus;
      if (!status && kpi.actual !== undefined && kpi.target !== undefined) {
        status = calculateKPIStatus(kpi.actual, kpi.target, kpi.polarity || 'Cima');
      }
      const finalStatus = status || 'Sem Dados';
      if (statusCounts[finalStatus] !== undefined) statusCounts[finalStatus]++;
    });

    const mapping = [
      { name: 'Superou', key: 'Superou a Meta', color: '#10b981' },
      { name: 'Atingiu', key: 'Atingiu a Meta', color: '#f59e0b' },
      { name: 'Abaixo', key: 'Abaixo da Meta', color: '#ef4444' },
      { name: 'Sem Dados', key: 'Sem Dados', color: '#94a3b8' },
    ];

    return mapping.map(m => ({
      name: m.name,
      value: statusCounts[m.key],
      color: m.color
    })).filter(s => s.value > 0);
  }, [kpis]);

  const overviewStats = [
    { label: 'Colaboradores', value: users.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', link: 'users' },
    { label: 'KPIs Ativos', value: kpis.length, icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50', link: 'master' },
    { label: 'Estrutura Org.', value: diretorias.length + departamentos.length, icon: Network, color: 'text-amber-600', bg: 'bg-amber-50', link: 'org' },
    { label: 'Consolidações', value: consolidations.length, icon: Calculator, color: 'text-rose-600', bg: 'bg-rose-50', link: 'consolidation' },
  ];

  return (
    <div className="w-full space-y-10 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 sm:p-10 rounded-[2.5rem] border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-2xl shadow-slate-900/20">
            <Activity className="h-10 w-10 stroke-[1.2]" />
          </div>
          <div>
            <h1 className="text-3xl font-light tracking-tight text-slate-800 uppercase">Centro de Operações <span className="font-black text-slate-900">KAPY</span></h1>
            <p className="text-slate-400 text-xs font-medium mt-2 uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
              Sincronização em tempo real ativa
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Saúde da Operação</p>
            <p className="text-2xl font-black text-slate-800 leading-none">{consolidationRate}% <span className="text-xs font-light text-slate-400">Concluído</span></p>
          </div>
          <div className="relative h-14 w-14">
            <svg className="h-full w-full" viewBox="0 0 36 36">
              <path
                className="text-slate-200"
                strokeDasharray="100, 100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                strokeDasharray={`${consolidationRate}, 100`}
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Stats */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {overviewStats.map((stat, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            onClick={() => onNavigate(stat.link)}
            className="flex flex-col p-8 rounded-[2rem] bg-white border border-slate-200/60 shadow-[0_2px_4px_rgba(0,0,0,0.01)] hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/40 transition-all text-left group relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 h-24 w-24 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-0" />
            <div className={`relative z-10 h-14 w-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-8 transition-transform group-hover:scale-110 duration-500`}>
              <stat.icon className="h-7 w-7" />
            </div>
            <p className="relative z-10 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
            <div className="relative z-10 flex items-baseline justify-between mt-2">
              <p className="text-4xl font-black text-slate-900 tracking-tight">{stat.value}</p>
              <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                <ArrowRight className="h-5 w-5 transform group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Operational Health Chart */}
        <div className="lg:col-span-2 rounded-[2.5rem] border border-slate-200/60 bg-white p-10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Status Global de Indicadores</h3>
              <p className="text-sm text-slate-400 font-light mt-1 uppercase tracking-widest">Dashboard de acompanhamento em tempo real</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            {kpiStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpiStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 900 }}
                    dy={15}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc', radius: 10 }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      fontSize: '11px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      backgroundColor: '#fff',
                      padding: '12px'
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={60}>
                    {kpiStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-100">
                <BarChart3 className="h-12 w-12 text-slate-200 mb-4" />
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aguardando dados de indicadores...</p>
              </div>
            )}
          </div>
        </div>

        {/* Organizational Summary */}
        <div className="rounded-[2.5rem] border border-slate-200/60 bg-white p-10 shadow-sm space-y-10">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Métricas de Inventário</h3>
          
          <div className="space-y-8">
            {[
              { label: 'Itens em Inventário', value: inventoryIndicators.length, sub: 'Modelos de indicadores cadastrados', icon: Boxes, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'Times Ativos', value: teams.length, sub: 'Estruturas operacionais ligadas', icon: Network, color: 'text-indigo-500', bg: 'bg-indigo-50' },
              { label: 'Ações de Auditoria', value: auditLogs.length, sub: 'Log de alterações (30 dias)', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            ].map((metric, i) => (
              <div key={i} className="flex items-start gap-6 p-6 rounded-[1.5rem] hover:bg-slate-50 transition-all duration-300 border border-transparent hover:border-slate-100 group">
                <div className={`h-14 w-14 rounded-2xl ${metric.bg} flex items-center justify-center ${metric.color} shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                  <metric.icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 leading-none">{metric.value}</p>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">{metric.label}</p>
                  {metric.sub && <p className="text-[10px] font-light text-slate-400 mt-1">{metric.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-100">
            <button 
              onClick={() => onNavigate('inventory')}
              className="group w-full h-14 rounded-2xl bg-slate-900 text-[11px] font-black uppercase tracking-[0.2em] text-white hover:bg-slate-800 shadow-xl shadow-slate-900/10 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              Ver Inventário Completo 
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Recent Activity Log Preview */}
        <div className="lg:col-span-1 rounded-[2.5rem] border border-slate-200/60 bg-white p-10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Fluxo de Auditoria</h3>
            <div className="p-2 rounded-lg bg-slate-50 text-slate-400">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-6">
            {auditLogs.slice(0, 5).map((log, i) => (
              <div key={i} className="flex items-start gap-4 text-left group">
                <div className="relative">
                  <div className={`h-3 w-3 rounded-full shrink-0 border-2 border-white ring-2 ${log.action === 'CREATE' ? 'ring-emerald-100 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : log.action === 'UPDATE' ? 'ring-amber-100 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'ring-rose-100 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                  {i < 4 && <div className="absolute left-1.5 top-3 bottom-[-24px] w-[1px] bg-slate-100" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-700 leading-tight uppercase tracking-tight group-hover:text-slate-900 transition-colors">
                    {log.changedBy} <span className="font-light text-slate-400">{log.action === 'CREATE' ? 'criou' : log.action === 'UPDATE' ? 'editou' : 'excluiu'}</span> {log.targetName}
                  </p>
                  <p className="text-[10px] text-slate-300 mt-1.5 font-medium">{new Date(log.timestamp).toLocaleDateString('pt-BR')} às {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="py-10 text-center space-y-3">
                <Database className="h-8 w-8 text-slate-100 mx-auto" />
                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Nenhum log disponível</p>
              </div>
            )}
          </div>
        </div>

        {/* System Links */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { id: 'dashboard', label: 'Dashboard Analítico', icon: BarChart3, desc: 'Gestão de metas' },
            { id: 'users', label: 'Gestão de Pessoas', icon: Users, desc: 'Acessos e cargos' },
            { id: 'org', label: 'Desenho Org.', icon: Network, desc: 'Deptos e times' },
            { id: 'consolidation', label: 'Calculadora KPIs', icon: Calculator, desc: 'IDCO dos times' },
            { id: 'calendar', label: 'Calendário Prazos', icon: CalendarIcon, desc: 'Agenda operacional' },
            { id: 'export', label: 'Centro de Relatórios', icon: FileText, desc: 'PDF / XLSX Hub' },
          ].map((link) => (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className="p-8 rounded-[2rem] bg-white border border-slate-100 hover:border-slate-800 hover:shadow-2xl hover:shadow-slate-200/50 transition-all text-left flex flex-col justify-between group active:scale-[0.98]"
            >
              <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500 mb-6">
                <link.icon className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] group-hover:tracking-[0.25em] transition-all">{link.label}</p>
                <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-widest opacity-60">{link.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <SupportChat />
    </div>
  );
};
