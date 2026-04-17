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
 * Calcula o percentual de atingimento de um indicador considerando a polaridade.
 */
export const getAchievementPercentage = (actual: number, target: number, polarity: KPIPolarity): number => {
  if (target === 0) return actual > 0 ? 100 : 0;
  
  if (polarity === 'Cima') {
    return (actual / target) * 100;
  } else if (polarity === 'Baixo') {
    // Se a meta é 10 e o realizado é 5, o atingimento é 200%? 
    // Geralmente para 'Baixo', se realizado <= meta, atingimento é 100%+.
    // Uma fórmula comum: (Meta / Realizado) * 100 ou (2 - (Realizado / Meta)) * 100
    if (actual === 0) return 100;
    return (target / actual) * 100;
  } else { // 'Igual'
    return actual === target ? 100 : 0;
  }
};

/**
 * Calcula o Índice de Atingimento Ponderado.
 * Suporta tipos de pontuação: Binário, Linear e por Faixas (Ranges).
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

  const achievedWeight = availableIndicators.reduce((total: number, indicator: SelectedIndicator) => {
    const polarity = indicator.polarity || 'Cima';
    const scoringType = indicator.scoringType || 'Binary';
    const achievement = getAchievementPercentage(indicator.actual, indicator.target, polarity);
    
    let points = 0;

    // 1. Trava Zero: If achievement is below the threshold, score is zero
    if (indicator.travaZero !== undefined && achievement < indicator.travaZero) {
      points = 0;
    } 
    // 2. Regra de Ouro: If achievement is 100% or more, score is the full weight
    else if (achievement >= 100) {
      points = indicator.weight;
    } 
    // 3. Regra de Inventário: If achievement is below 100%, apply specific rules or scoring type
    else {
      if (indicator.rules && indicator.rules.length > 0) {
        let rulePoints = 0;
        // Sort rules by target descending to find the best match
        const sortedRules = [...indicator.rules].sort((a, b) => {
          const targetA = parseFloat(a.target.replace(/[^0-9.]/g, '')) || 0;
          const targetB = parseFloat(b.target.replace(/[^0-9.]/g, '')) || 0;
          return targetB - targetA;
        });

        const matchingRule = sortedRules.find(rule => {
          const targetNum = parseFloat(rule.target.replace(/[^0-9.]/g, '')) || 0;
          switch (rule.comparison) {
            case 'Greater': return achievement > targetNum;
            case 'GreaterEqual': return achievement >= targetNum;
            case 'Less': return achievement < targetNum;
            case 'LessEqual': return achievement <= targetNum;
            case 'Equal': return achievement === targetNum;
            default: return false;
          }
        });

        if (matchingRule) {
          rulePoints = matchingRule.weight;
        }
        points = rulePoints;
      } else if (scoringType === 'Linear') {
        points = indicator.weight * (achievement / 100);
      } else if (scoringType === 'Range' && indicator.scoringRanges && indicator.scoringRanges.length > 0) {
        const range = indicator.scoringRanges.find(r => achievement >= r.min && achievement < r.max);
        if (range) {
          points = range.points;
        } else {
          const maxRange = [...indicator.scoringRanges].sort((a, b) => b.max - a.max)[0];
          if (achievement >= maxRange.max) {
            points = maxRange.points;
          }
        }
      } else { // 'Binary' or default
        points = 0;
      }
    }

    return total + points;
  }, 0);

  return Number(achievedWeight.toFixed(2));
};

/**
 * Calcula o atingimento individual de um indicador (0 a 100%).
 */
export const calculateIndividualAchievement = (indicator: { actual: number; target: number }): number => {
  if (indicator.target === 0) return 0;
  const achievement = (indicator.actual / indicator.target) * 100;
  return Math.min(Math.max(achievement, 0), 100); // Clamp between 0 and 100
};
