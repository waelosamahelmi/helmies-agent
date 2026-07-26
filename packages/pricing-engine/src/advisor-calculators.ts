// Helmies Studio — Admin Advisor Calculator Tools
// Sections 111-114: Deterministic financial calculators for the Admin Advisor.
// The LLM may EXPLAIN calculations but MUST NOT invent them.
// All financial numbers come from these deterministic tools.

// ============================================================
// Advisor calculator interface
// ============================================================

export interface AdvisorScenario {
  id: string;
  adminId: string;
  question: string;
  inputAssumptions: Record<string, unknown>;
  calculatorOutput: Record<string, unknown>;
  llmExplanation?: string;
  warnings: AdvisorWarning[];
  createdAt: Date;
}

export interface AdvisorWarning {
  level: "info" | "caution" | "high_risk";
  message: string;
  details: Record<string, unknown>;
}

// ============================================================
// Tool: Calculate Plan Margin
// ============================================================

export interface PlanMarginInput {
  planPrice: number; // Monthly price in plan currency
  planCredits: number; // Monthly credits included
  utilizationRates: number[]; // e.g., [0.2, 0.5, 0.8, 1.0]
  avgProviderCostPerCredit: number; // Average AI cost per credit
  paymentFeePercent: number; // e.g., 0.029 for 2.9%
  paymentFeeFixed: number; // e.g., 0.30 for $0.30
  infraReservePercent: number; // e.g., 0.10 for 10%
}

export interface PlanMarginResult {
  revenueAfterFees: number;
  scenarios: Array<{
    utilizationRate: number;
    creditsUsed: number;
    aiCost: number;
    contribution: number;
    contributionMargin: number; // 0-1
    isProfitable: boolean;
  }>;
  breakEvenUtilization: number;
}

export function calculatePlanMargin(input: PlanMarginInput): PlanMarginResult {
  const revenueAfterFees = input.planPrice - (input.planPrice * input.paymentFeePercent + input.paymentFeeFixed);

  const scenarios = input.utilizationRates.map((rate) => {
    const creditsUsed = input.planCredits * rate;
    const aiCost = creditsUsed * input.avgProviderCostPerCredit * (1 + input.infraReservePercent);
    const contribution = revenueAfterFees - aiCost;
    const contributionMargin = revenueAfterFees > 0 ? contribution / revenueAfterFees : 0;

    return {
      utilizationRate: rate,
      creditsUsed: Math.round(creditsUsed),
      aiCost: Math.round(aiCost * 100) / 100,
      contribution: Math.round(contribution * 100) / 100,
      contributionMargin: Math.round(contributionMargin * 1000) / 1000,
      isProfitable: contribution > 0,
    };
  });

  // Calculate break-even utilization
  const breakEvenCredits = revenueAfterFees / (input.avgProviderCostPerCredit * (1 + input.infraReservePercent));
  const breakEvenUtilization = input.planCredits > 0 ? breakEvenCredits / input.planCredits : 1;

  return {
    revenueAfterFees: Math.round(revenueAfterFees * 100) / 100,
    scenarios,
    breakEvenUtilization: Math.round(breakEvenUtilization * 1000) / 1000,
  };
}

// ============================================================
// Tool: Simulate Promo
// ============================================================

export interface SimulatePromoInput {
  planName: string;
  planPrice: number;
  planCredits: number;
  promoType: "percent_discount" | "fixed_discount" | "bonus_credits";
  promoValue: number; // percent (0-100), fixed amount, or bonus credits
  promoDurationMonths: number;
  avgProviderCostPerCredit: number;
  expectedRedemptions: number;
  paymentFeePercent: number;
  infraReservePercent: number;
  historicalUtilization: number; // 0-1
}

export interface SimulatePromoResult {
  normalMonthlyRevenue: number;
  promoMonthlyRevenue: number;
  normalMonthlyContribution: number;
  promoMonthlyContribution: number;
  promoMonthlyContributionMargin: number;
  totalRevenueLossOverDuration: number;
  worstCaseScenario: {
    utilizationRate: number;
    aiCost: number;
    contribution: number;
    isProfitable: boolean;
  };
  warnings: AdvisorWarning[];
}

export function simulatePromo(input: SimulatePromoInput): SimulatePromoResult {
  const warnings: AdvisorWarning[] = [];

  // Normal scenario (no promo)
  const normalRevenueAfterFees = input.planPrice - (input.planPrice * input.paymentFeePercent + 0.30);
  const normalCreditsUsed = input.planCredits * input.historicalUtilization;
  const normalAiCost = normalCreditsUsed * input.avgProviderCostPerCredit * (1 + input.infraReservePercent);
  const normalContribution = normalRevenueAfterFees - normalAiCost;

  // Promo scenario
  let promoRevenue = input.planPrice;
  let bonusCredits = 0;

  switch (input.promoType) {
    case "percent_discount":
      promoRevenue = input.planPrice * (1 - input.promoValue / 100);
      break;
    case "fixed_discount":
      promoRevenue = Math.max(0, input.planPrice - input.promoValue);
      break;
    case "bonus_credits":
      bonusCredits = input.promoValue;
      break;
  }

  const promoRevenueAfterFees = promoRevenue - (promoRevenue * input.paymentFeePercent + 0.30);
  const totalCredits = input.planCredits + bonusCredits;
  const promoCreditsUsed = totalCredits * input.historicalUtilization;
  const promoAiCost = promoCreditsUsed * input.avgProviderCostPerCredit * (1 + input.infraReservePercent);
  const promoContribution = promoRevenueAfterFees - promoAiCost;
  const promoMargin = promoRevenueAfterFees > 0 ? promoContribution / promoRevenueAfterFees : 0;

  const totalLoss = (normalContribution - promoContribution) * input.expectedRedemptions * input.promoDurationMonths;

  // Worst case: 100% utilization under promo
  const worstCaseAiCost = totalCredits * input.avgProviderCostPerCredit * (1 + input.infraReservePercent);
  const worstCaseContribution = promoRevenueAfterFees - worstCaseAiCost;

  // Generate warnings
  if (promoMargin < 0.3) {
    warnings.push({
      level: "high_risk",
      message: `Promo contribution margin is only ${(promoMargin * 100).toFixed(1)}% — below 30% threshold`,
      details: { promoMargin, threshold: 0.3 },
    });
  } else if (promoMargin < 0.5) {
    warnings.push({
      level: "caution",
      message: `Promo contribution margin is ${(promoMargin * 100).toFixed(1)}%`,
      details: { promoMargin },
    });
  }

  if (worstCaseContribution < 0) {
    warnings.push({
      level: "high_risk",
      message: `At 100% utilization, this promo loses ${Math.abs(worstCaseContribution).toFixed(2)} per user/month`,
      details: { worstCaseContribution, utilizationRate: 1.0 },
    });
  }

  if (input.promoType === "percent_discount" && input.promoValue > 40) {
    warnings.push({
      level: "high_risk",
      message: `Discount of ${input.promoValue}% exceeds 40% maximum recommended`,
      details: { discountPercent: input.promoValue, maxRecommended: 40 },
    });
  }

  return {
    normalMonthlyRevenue: Math.round(normalRevenueAfterFees * 100) / 100,
    promoMonthlyRevenue: Math.round(promoRevenueAfterFees * 100) / 100,
    normalMonthlyContribution: Math.round(normalContribution * 100) / 100,
    promoMonthlyContribution: Math.round(promoContribution * 100) / 100,
    promoMonthlyContributionMargin: Math.round(promoMargin * 1000) / 1000,
    totalRevenueLossOverDuration: Math.round(totalLoss * 100) / 100,
    worstCaseScenario: {
      utilizationRate: 1.0,
      aiCost: Math.round(worstCaseAiCost * 100) / 100,
      contribution: Math.round(worstCaseContribution * 100) / 100,
      isProfitable: worstCaseContribution > 0,
    },
    warnings,
  };
}

// ============================================================
// Tool: Compare Model Profitability
// ============================================================

export interface ModelProfitabilityInput {
  models: Array<{
    id: string;
    name: string;
    capability: string;
    providerCost: number; // Wholesale cost per unit
    creditPrice: number; // Credits charged to user
    monthlyVolume: number; // Estimated monthly jobs
  }>;
  creditValueCents: number; // How many cents = 1 credit
}

export interface ModelProfitabilityResult {
  models: Array<{
    id: string;
    name: string;
    revenuePerJob: number;
    costPerJob: number;
    marginPerJob: number;
    marginPercent: number;
    monthlyRevenue: number;
    monthlyCost: number;
    monthlyProfit: number;
    isProfitLeader: boolean;
    isLossLeader: boolean;
  }>;
  totalMonthlyProfit: number;
  bestModel: string;
  worstModel: string;
}

export function compareModelProfitability(input: ModelProfitabilityInput): ModelProfitabilityResult {
  const results = input.models.map((model) => {
    const revenuePerJob = (model.creditPrice * input.creditValueCents) / 100; // Convert to dollars
    const costPerJob = model.providerCost;
    const marginPerJob = revenuePerJob - costPerJob;
    const marginPercent = revenuePerJob > 0 ? marginPerJob / revenuePerJob : 0;
    const monthlyRevenue = revenuePerJob * model.monthlyVolume;
    const monthlyCost = costPerJob * model.monthlyVolume;
    const monthlyProfit = monthlyRevenue - monthlyCost;

    return {
      id: model.id,
      name: model.name,
      revenuePerJob: Math.round(revenuePerJob * 10000) / 10000,
      costPerJob: Math.round(costPerJob * 10000) / 10000,
      marginPerJob: Math.round(marginPerJob * 10000) / 10000,
      marginPercent: Math.round(marginPercent * 1000) / 1000,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      monthlyCost: Math.round(monthlyCost * 100) / 100,
      monthlyProfit: Math.round(monthlyProfit * 100) / 100,
      isProfitLeader: false,
      isLossLeader: false,
    };
  });

  // Find profit/loss leaders
  const sorted = [...results].sort((a, b) => b.marginPercent - a.marginPercent);
  if (sorted.length > 0) {
    const best = results.find((m) => m.id === sorted[0].id);
    if (best) best.isProfitLeader = true;

    const worst = results.find((m) => m.id === sorted[sorted.length - 1].id);
    if (worst) worst.isLossLeader = worst.monthlyProfit < 0;
  }

  const totalProfit = results.reduce((sum, m) => sum + m.monthlyProfit, 0);

  return {
    models: results,
    totalMonthlyProfit: Math.round(totalProfit * 100) / 100,
    bestModel: sorted[0]?.name || "N/A",
    worstModel: sorted[sorted.length - 1]?.name || "N/A",
  };
}

// ============================================================
// Tool: Calculate Break-Even
// ============================================================

export interface BreakEvenInput {
  fixedCosts: number; // Monthly fixed costs (infra, salaries, etc.)
  avgRevenuePerUser: number;
  avgVariableCostPerUser: number;
  currentUserCount: number;
  monthlyUserGrowth: number; // % growth per month
}

export interface BreakEvenResult {
  contributionPerUser: number;
  breakEvenUsers: number;
  currentUsers: number;
  usersNeeded: number;
  monthsToBreakEven: number;
  isBreakEven: boolean;
}

export function calculateBreakEven(input: BreakEvenInput): BreakEvenResult {
  const contributionPerUser = input.avgRevenuePerUser - input.avgVariableCostPerUser;
  const breakEvenUsers = contributionPerUser > 0
    ? Math.ceil(input.fixedCosts / contributionPerUser)
    : Infinity;

  const usersNeeded = Math.max(0, breakEvenUsers - input.currentUserCount);

  let monthsToBreakEven = 0;
  if (usersNeeded > 0 && input.monthlyUserGrowth > 0) {
    let users = input.currentUserCount;
    while (users < breakEvenUsers && monthsToBreakEven < 60) {
      users = users * (1 + input.monthlyUserGrowth / 100);
      monthsToBreakEven++;
    }
  }

  return {
    contributionPerUser: Math.round(contributionPerUser * 100) / 100,
    breakEvenUsers,
    currentUsers: input.currentUserCount,
    usersNeeded,
    monthsToBreakEven,
    isBreakEven: input.currentUserCount >= breakEvenUsers,
  };
}

// ============================================================
// Tool: Calculate Credit Pack Margin
// ============================================================

export interface CreditPackMarginInput {
  packName: string;
  packPrice: number;
  creditsIncluded: number;
  avgProviderCostPerCredit: number;
  paymentFeePercent: number;
  infraReservePercent: number;
}

export interface CreditPackMarginResult {
  revenueAfterFees: number;
  estimatedAiCost: number;
  contribution: number;
  contributionMargin: number;
  effectivePricePerCredit: number;
  effectiveCostPerCredit: number;
  markup: number;
}

export function calculateCreditPackMargin(input: CreditPackMarginInput): CreditPackMarginResult {
  const revenueAfterFees = input.packPrice - (input.packPrice * input.paymentFeePercent + 0.30);
  const estimatedAiCost = input.creditsIncluded * input.avgProviderCostPerCredit * (1 + input.infraReservePercent);
  const contribution = revenueAfterFees - estimatedAiCost;
  const contributionMargin = revenueAfterFees > 0 ? contribution / revenueAfterFees : 0;
  const effectivePricePerCredit = input.packPrice / input.creditsIncluded;
  const effectiveCostPerCredit = input.avgProviderCostPerCredit;

  return {
    revenueAfterFees: Math.round(revenueAfterFees * 100) / 100,
    estimatedAiCost: Math.round(estimatedAiCost * 100) / 100,
    contribution: Math.round(contribution * 100) / 100,
    contributionMargin: Math.round(contributionMargin * 1000) / 1000,
    effectivePricePerCredit: Math.round(effectivePricePerCredit * 10000) / 10000,
    effectiveCostPerCredit: Math.round(effectiveCostPerCredit * 10000) / 10000,
    markup: input.creditsIncluded > 0
      ? Math.round((input.packPrice / (input.creditsIncluded * input.avgProviderCostPerCredit)) * 100) / 100
      : 0,
  };
}

// ============================================================
// Tool: Detect Cost Anomaly
// ============================================================

export interface CostAnomalyInput {
  modelId: string;
  historicalAvgCost: number; // Average provider cost over last 30 days
  currentCost: number; // Latest provider cost
  historicalStdDev: number; // Standard deviation of historical costs
  thresholdMultiplier: number; // e.g., 2.0 = 2 standard deviations
}

export interface CostAnomalyResult {
  isAnomaly: boolean;
  deviationPercent: number;
  direction: "increase" | "decrease" | "none";
  severity: "low" | "medium" | "high";
  recommendation: string;
}

export function detectCostAnomaly(input: CostAnomalyInput): CostAnomalyResult {
  const deviation = input.currentCost - input.historicalAvgCost;
  const deviationPercent = input.historicalAvgCost > 0
    ? (deviation / input.historicalAvgCost) * 100
    : 0;

  const stdDevThreshold = input.historicalStdDev * input.thresholdMultiplier;
  const isAnomaly = Math.abs(deviation) > stdDevThreshold;

  let severity: "low" | "medium" | "high" = "low";
  if (Math.abs(deviationPercent) > 50) {
    severity = "high";
  } else if (Math.abs(deviationPercent) > 25) {
    severity = "medium";
  }

  let direction: "increase" | "decrease" | "none" = "none";
  let recommendation = "No action needed.";

  if (deviation > 0) {
    direction = "increase";
    recommendation = severity === "high"
      ? "URGENT: Investigate provider cost increase. Consider pausing this model and switching traffic to alternatives."
      : "Monitor provider cost trend. Review pricing if increase persists.";
  } else if (deviation < 0) {
    direction = "decrease";
    recommendation = "Provider cost decreased. Verify quality is maintained. Opportunity to increase margin or lower prices.";
  }

  return {
    isAnomaly,
    deviationPercent: Math.round(deviationPercent * 100) / 100,
    direction,
    severity,
    recommendation,
  };
}
