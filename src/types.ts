/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccessLevel = 'Admin' | 'Gestor' | 'Visualizador';
export type UserStatus = 'Ativo' | 'Inativo';

export type KPIUnit = 'Moeda' | 'Porcentagem' | 'Número Absoluto';
export type KPIPolarity = 'Cima' | 'Baixo' | 'Igual';
export type KPIFrequency = 'Mensal' | 'Semanal' | 'Diário' | 'Anual';
export type KPICategory = 'Vaidade' | 'Produtividade' | 'Qualidade' | 'Capacidade' | 'Estratégico';
export type KPIStatus = 'Abaixo da Meta' | 'Atingiu a Meta' | 'Superou a Meta' | 'No Prazo' | 'Atrasado' | 'Meta Batida' | 'Alerta' | 'Não atingiu a Meta';

export interface UserPermissions {
  canCreateIndicators: boolean;
  canEditResults: boolean;
  canViewOtherDepartments: boolean;
  allowedTeams: string[];
  allowedAreas: string[];
  onlyOwnIndicators: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  registrationNumber?: string;
  diretoriaId?: string;
  departmentId?: string;
  gerenciaId?: string;
  servicoId?: string;
  teamId?: string;
  department: string; // Keep for legacy/compatibility
  role: string;
  accessLevel: AccessLevel;
  status: UserStatus;
  permissions: UserPermissions;
  hireDate?: string;
  photoUrl?: string;
}

export interface Diretoria {
  id: string;
  name: string;
  managerId?: string;
}

export interface Departamento {
  id: string;
  name: string;
  diretoriaId: string;
  managerId?: string;
}

export interface Gerencia {
  id: string;
  name: string;
  departmentId: string;
  managerId?: string;
}

export interface Servico {
  id: string;
  name: string;
  gerenciaId: string;
  managerId?: string;
}

export interface Team {
  id: string;
  name: string;
  diretoriaId?: string;
  deptId?: string;
  gerenciaId?: string;
  servicoId?: string;
  areaId?: string; // Keep for legacy
  leaderId?: string;
}

// Keep Area for compatibility or map it to something else
export interface Area {
  id: string;
  name: string;
  department: string;
  managerId?: string;
}

export interface KPI {
  id: string; // Unique ID per collaborator instance
  templateId?: string; // Generalist ID (same for multiple collaborators)
  code: string;
  name: string;
  department: string;
  description: string;
  unit: KPIUnit;
  polarity: KPIPolarity;
  frequency: KPIFrequency;
  category?: KPICategory;
  diretoriaId?: string;
  departmentId?: string;
  gerenciaId?: string;
  servicoId?: string;
  teamId?: string;
  ownerId: string;
  target?: number;
  actual?: number;
  status: UserStatus;
  kpiStatus?: KPIStatus; // Farol status
}

export interface BaseIndicator {
  id: string;
  code: string;
  name: string;
  defaultWeight: number;
  startDate?: string;
  endDate?: string;
  polarity?: KPIPolarity;
}

export interface SelectedIndicator extends BaseIndicator {
  weight: number;
  actual: number;
  target: number;
  unit?: KPIUnit;
  isNotAvailable?: boolean;
  polarity?: KPIPolarity;
}

export type InventoryStatus = 'Em Planejamento' | 'Ativo' | 'Concluído' | 'Cancelado';

export interface InventoryIndicator {
  id: string;
  code: string;
  name: string;
  type: 'Individual' | 'Coletivo';
  diretoriaId?: string;
  departmentId?: string;
  gerenciaId?: string;
  servicoId?: string;
  teamId?: string;
  targetRole: string;
  responsibleId: string;
  responsibleName: string;
  responsibleRole: string;
  target: string;
  category?: KPICategory;
  frequency?: KPIFrequency;
  actual?: number;
  unit?: KPIUnit;
  weight: number;
  startDate: string;
  endDate: string;
  status: InventoryStatus;
  polarity: KPIPolarity;
}

export interface AuditLog {
  id: string;
  targetId: string; // ID of the user being audited
  targetName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changedBy: string; // Name of the person who made the change
  changedById: string; // ID of the person who made the change
  timestamp: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface ConsolidatedIndicator {
  id: string;
  collaboratorName: string;
  collaboratorId: string;
  name: string;
  totalTarget: string;
  indicators: SelectedIndicator[];
  diretoriaId?: string;
  departmentId?: string;
  teamId?: string;
  createdAt: string;
  month: string;
  vacationStart?: string | null;
  vacationEnd?: string | null;
  isOnVacation?: boolean;
}

export type DataLogType = 'IMPORT' | 'EXPORT';

export interface DataLog {
  id: string;
  type: DataLogType;
  entity: 'KPI' | 'USUARIO' | 'INVENTARIO' | 'CONSOLIDACAO' | 'ORGANIZACAO' | 'COLABORADORES' | 'INDICADORES' | 'RESULTADOS';
  action: string;
  fileName?: string;
  rowCount?: number;
  performedBy: string;
  performedById: string;
  timestamp: string;
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  details?: string;
}

export const BASE_INDICATORS_MOCK: BaseIndicator[] = [];
export const DEPARTMENTS = ['Vendas', 'TI', 'Operações', 'Financeiro', 'RH', 'Marketing'];
export const DEPARTMENT_CODES: Record<string, string> = {
  'Vendas': 'VEN',
  'TI': 'TEC',
  'Operações': 'OPE',
  'Financeiro': 'FIN',
  'RH': 'RH',
  'Marketing': 'MKT'
};

export interface MasterIndicator {
  id: string;
  code: string;
  name: string;
  department: string;
  responsible: string;
  period: string;
  target: string;
  actual: string;
  status: KPIStatus;
  category?: KPICategory;
  frequency?: KPIFrequency;
}

export interface NotificationSettings {
  id: string;
  emailEnabled: boolean;
  notifyMissingConsolidation: boolean;
  reminderDays: number;
  recipients: 'Admins' | 'Gestores' | 'Todos';
  customEmails: string[];
  lastRun?: string;
}

export const MASTER_INDICATORS_MOCK: MasterIndicator[] = [];
export const AVAILABLE_KPIS = [
  'Churn Rate',
  'CAC (Custo de Aquisição de Cliente)',
  'LTV (Lifetime Value)',
  'NPS (Net Promoter Score)',
  'ROI (Retorno sobre Investimento)',
  'Margem Bruta',
  'Ticket Médio',
  'Taxa de Conversão',
  'Volume de Vendas',
  'SLA de Atendimento'
];
