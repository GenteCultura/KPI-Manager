import { ConsolidatedIndicator, SelectedIndicator, KPIPolarity, KPIStatus } from '../types';

/**
 * Calcula o status do indicador (Farol).
 */
export const calculateKPIStatus = (actual: number, target: number, polarity: KPIPolarity): KPIStatus => {
  if (polarity === 'Cima') {
    if (actual > target) return 'Superou a Meta';
    if (actual === target) return 'Atingiu a Meta';
    return 'Abaixo da Meta';
  } else if (polarity === 'Baixo') {
    if (actual < target) return 'Superou a Meta';
    if (actual === target) return 'Atingiu a Meta';
    return 'Abaixo da Meta';
  } else { // 'Igual'
    if (actual === target) return 'Atingiu a Meta';
    return 'Abaixo da Meta';
  }
};

/**
 * Calcula o Índice de Atingimento Ponderado.
 * Lógica: Para cada indicador base, se (Realizado >= Meta), soma o Peso no total. Senão, soma 0.
 * 
 * @param consolidation O indicador consolidado contendo os indicadores base.
 * @returns A nota final (0 a 100).
 */
export const calculateWeightedAchievement = (consolidation: ConsolidatedIndicator | { indicators: SelectedIndicator[]; isOnVacation?: boolean }): number | null => {
  if ((consolidation as any).isOnVacation) return null;
  
  const indicators = (consolidation as any).indicators;
  if (!indicators || indicators.length === 0) return 0;

  const availableIndicators = indicators.filter((ind: any) => !ind.isNotAvailable);
  
  if (availableIndicators.length === 0) return 100;

  const totalWeight = availableIndicators.reduce((sum: number, ind: any) => sum + ind.weight, 0);
  
  if (totalWeight === 0) return 0;

  const achievedWeight = availableIndicators.reduce((total: number, indicator: any) => {
    let isAchieved = false;
    const polarity = indicator.polarity || 'Cima';

    if (polarity === 'Cima') {
      isAchieved = indicator.actual >= indicator.target;
    } else if (polarity === 'Baixo') {
      isAchieved = indicator.actual <= indicator.target;
    } else { // 'Igual'
      isAchieved = indicator.actual === indicator.target;
    }

    return total + (isAchieved ? indicator.weight : 0);
  }, 0);

  return Math.round((achievedWeight / totalWeight) * 100);
};

/**
 * Calcula o atingimento individual de um indicador (0 a 100%).
 */
export const calculateIndividualAchievement = (indicator: { actual: number; target: number }): number => {
  if (indicator.target === 0) return 0;
  const achievement = (indicator.actual / indicator.target) * 100;
  return Math.min(Math.max(achievement, 0), 100); // Clamp between 0 and 100
};
