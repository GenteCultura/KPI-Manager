import { KPIPolarity, KPIStatus } from '../types';

export const calculateKPIStatus = (actual: number, target: number, polarity: KPIPolarity): KPIStatus => {
  if (target === 0) return 'Atingiu a Meta';

  if (polarity === 'Cima') {
    if (actual > target) return 'Superou a Meta';
    if (actual === target) return 'Atingiu a Meta';
    return 'Abaixo da Meta';
  }

  if (polarity === 'Baixo') {
    if (actual < target) return 'Superou a Meta';
    if (actual === target) return 'Atingiu a Meta';
    return 'Abaixo da Meta';
  }

  // Polarity 'Igual'
  if (actual === target) return 'Atingiu a Meta';
  return 'Abaixo da Meta';
};

export const getStatusColor = (status: KPIStatus) => {
  switch (status) {
    case 'Superou a Meta':
      return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    case 'Atingiu a Meta':
      return 'text-blue-600 bg-blue-50 border-blue-100';
    case 'Abaixo da Meta':
      return 'text-rose-600 bg-rose-50 border-rose-100';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-100';
  }
};
