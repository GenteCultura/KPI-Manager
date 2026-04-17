import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, KPI, ConsolidatedIndicator, Area, Team, AuditLog, InventoryIndicator, BaseIndicator, Diretoria, Departamento, Gerencia, Servico, NotificationSettings, DataLog, CalendarEvent } from '../types';

interface AppState {
  users: User[];
  kpis: KPI[];
  consolidations: ConsolidatedIndicator[];
  areas: Area[];
  teams: Team[];
  diretorias: Diretoria[];
  departamentos: Departamento[];
  gerencias: Gerencia[];
  servicos: Servico[];
  auditLogs: AuditLog[];
  dataLogs: DataLog[];
  inventoryIndicators: InventoryIndicator[];
  baseIndicators: BaseIndicator[];
  notificationSettings: NotificationSettings | null;
  calendarEvents: CalendarEvent[];
  
  // Actions
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
  
  setKpis: (kpis: KPI[]) => void;
  addKpi: (kpi: KPI) => void;
  updateKpi: (kpi: KPI) => void;
  deleteKpi: (id: string) => void;
  
  setConsolidations: (consolidations: ConsolidatedIndicator[]) => void;
  addConsolidation: (consolidation: ConsolidatedIndicator) => void;
  deleteConsolidation: (id: string) => void;

  setAreas: (areas: Area[]) => void;
  setTeams: (teams: Team[]) => void;
  
  setDiretorias: (diretorias: Diretoria[]) => void;
  setDepartamentos: (departamentos: Departamento[]) => void;
  setGerencias: (gerencias: Gerencia[]) => void;
  setServicos: (servicos: Servico[]) => void;

  setAuditLogs: (logs: AuditLog[]) => void;
  addAuditLog: (log: AuditLog) => void;

  setDataLogs: (logs: DataLog[]) => void;
  addDataLog: (log: DataLog) => void;

  setInventoryIndicators: (indicators: InventoryIndicator[]) => void;
  addInventoryIndicator: (indicator: InventoryIndicator) => void;
  updateInventoryIndicator: (indicator: InventoryIndicator) => void;
  deleteInventoryIndicator: (id: string) => void;

  setBaseIndicators: (indicators: BaseIndicator[]) => void;
  addBaseIndicator: (indicator: BaseIndicator) => void;
  updateBaseIndicator: (indicator: BaseIndicator) => void;
  deleteBaseIndicator: (id: string) => void;

  setNotificationSettings: (settings: NotificationSettings) => void;

  setCalendarEvents: (events: CalendarEvent[]) => void;
  addCalendarEvent: (event: CalendarEvent) => void;
  updateCalendarEvent: (event: CalendarEvent) => void;
  deleteCalendarEvent: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      users: [],
      kpis: [],
      consolidations: [],
      areas: [],
      teams: [],
      diretorias: [],
      departamentos: [],
      gerencias: [],
      servicos: [],
      auditLogs: [],
      dataLogs: [],
      inventoryIndicators: [],
      baseIndicators: [],
      notificationSettings: null,
      
      setUsers: (users) => set({ users }),
      addUser: (user) => set((state) => ({ 
        users: state.users.some(u => u.id === user.id) ? state.users : [...state.users, user] 
      })),
      updateUser: (user) => set((state) => ({ 
        users: state.users.map((u) => (u.id === user.id ? user : u)) 
      })),
      deleteUser: (id) => set((state) => ({ 
        users: state.users.filter((u) => u.id !== id) 
      })),
      
      setKpis: (kpis) => set({ kpis }),
      addKpi: (kpi) => set((state) => ({ 
        kpis: state.kpis.some(k => k.id === kpi.id) ? state.kpis : [...state.kpis, kpi] 
      })),
      updateKpi: (kpi) => set((state) => ({ 
        kpis: state.kpis.map((k) => (k.id === kpi.id ? kpi : k)) 
      })),
      deleteKpi: (id) => set((state) => ({ 
        kpis: state.kpis.filter((k) => k.id !== id) 
      })),
      
      setConsolidations: (consolidations) => set({ consolidations }),
      addConsolidation: (consolidation) => set((state) => ({ 
        consolidations: state.consolidations.some(c => c.id === consolidation.id) ? state.consolidations : [...state.consolidations, consolidation] 
      })),
      deleteConsolidation: (id) => set((state) => ({ 
        consolidations: state.consolidations.filter((c) => c.id !== id) 
      })),

      setAreas: (areas) => set({ areas }),
      setTeams: (teams) => set({ teams }),
      
      setDiretorias: (diretorias) => set({ diretorias }),
      setDepartamentos: (departamentos) => set({ departamentos }),
      setGerencias: (gerencias) => set({ gerencias }),
      setServicos: (servicos) => set({ servicos }),

      setAuditLogs: (auditLogs) => set({ auditLogs }),
      addAuditLog: (log) => set((state) => ({ 
        auditLogs: state.auditLogs.some(l => l.id === log.id) ? state.auditLogs : [log, ...state.auditLogs] 
      })),

      setDataLogs: (dataLogs) => set({ dataLogs }),
      addDataLog: (log) => set((state) => ({ 
        dataLogs: state.dataLogs.some(l => l.id === log.id) ? state.dataLogs : [log, ...state.dataLogs] 
      })),

      setInventoryIndicators: (inventoryIndicators) => set({ inventoryIndicators }),
      addInventoryIndicator: (indicator) => set((state) => ({ 
        inventoryIndicators: state.inventoryIndicators.some(i => i.id === indicator.id) ? state.inventoryIndicators : [...state.inventoryIndicators, indicator] 
      })),
      updateInventoryIndicator: (indicator) => set((state) => ({ 
        inventoryIndicators: state.inventoryIndicators.map((i) => (i.id === indicator.id ? indicator : i)) 
      })),
      deleteInventoryIndicator: (id) => set((state) => ({ 
        inventoryIndicators: state.inventoryIndicators.filter((i) => i.id !== id) 
      })),

      setBaseIndicators: (baseIndicators) => set({ baseIndicators }),
      addBaseIndicator: (indicator) => set((state) => ({ 
        baseIndicators: state.baseIndicators.some(i => i.id === indicator.id) ? state.baseIndicators : [...state.baseIndicators, indicator] 
      })),
      updateBaseIndicator: (indicator) => set((state) => ({ 
        baseIndicators: state.baseIndicators.map((i) => (i.id === indicator.id ? indicator : i)) 
      })),
      deleteBaseIndicator: (id) => set((state) => ({ 
        baseIndicators: state.baseIndicators.filter((i) => i.id !== id) 
      })),

      setNotificationSettings: (notificationSettings) => set({ notificationSettings }),

      calendarEvents: [],
      setCalendarEvents: (calendarEvents) => set({ calendarEvents }),
      addCalendarEvent: (event) => set((state) => ({ 
        calendarEvents: state.calendarEvents.some(e => e.id === event.id) ? state.calendarEvents : [...state.calendarEvents, event] 
      })),
      updateCalendarEvent: (event) => set((state) => ({ 
        calendarEvents: state.calendarEvents.map((e) => (e.id === event.id ? event : e)) 
      })),
      deleteCalendarEvent: (id) => set((state) => ({ 
        calendarEvents: state.calendarEvents.filter((e) => e.id !== id) 
      })),
    }),
    {
      name: 'kpi-manager-storage',
    }
  )
);
