/**
 * Worker Earnings Calculator
 * 
 * Formula: (Customer Total - Equipment Costs) × 0.6 + Tip = Worker Earnings
 * 
 * Equipment Cost Deductions:
 * - Full Motion Mount: $57
 * - Flat Mount: $30
 * - Cable Concealment (regular): $16
 * - Fire Safe: $50
 */

interface ServiceLineItem {
  service_name: string;
  base_price: number;
  quantity: number;
}

export interface WorkerEarningsBreakdown {
  totalCharged: number;          // Sum of all services (no tip)
  equipmentCosts: number;         // Total equipment deductions
  commissionableAmount: number;   // After equipment deduction
  workerCommission: number;       // 60% of commissionable
  tipAmount: number;              // Tip received
  totalEarnings: number;          // Commission + tip
  costBreakdown: {
    fullMotionMountCount: number;
    fullMotionMountCost: number;
    flatMountCount: number;
    flatMountCost: number;
    hideWiresCount: number;
    hideWiresCost: number;
    fireSafeCount: number;
    fireSafeCost: number;
  };
}

// Equipment cost constants
const EQUIPMENT_COSTS = {
  FULL_MOTION_MOUNT: 57,
  FLAT_MOUNT: 30,
  HIDE_WIRES: 16,
  FIRE_SAFE: 50,
};

// Commission rate (60%)
const COMMISSION_RATE = 0.6;

/**
 * Detect if a service is a Full Motion Mount
 * Matches: "Full Motion Mount (Living Room)", "Purchase Full Motion Mount", etc.
 */
function isFullMotionMount(serviceName: string): boolean {
  const name = serviceName.toLowerCase();
  return name.includes('full motion') || 
         (name.includes('pullout') && name.includes('mount'));
}

/**
 * Detect if a service is a Flat Mount
 * Matches: "Flat Tilt Mount (Bedroom)", "Buy Flat Mount", etc.
 * Excludes Full Motion mounts
 */
function isFlatMount(serviceName: string): boolean {
  const name = serviceName.toLowerCase();
  return !isFullMotionMount(serviceName) && 
         (name.includes('flat') && name.includes('mount')) ||
         (name.includes('tilt') && name.includes('mount'));
}

/**
 * Detect if a service is Fire Safe
 * Matches: "In-Wall Fire Safe Cable Concealment", "Fire Safe", etc.
 */
function isFireSafe(serviceName: string): boolean {
  const name = serviceName.toLowerCase();
  return name.includes('fire safe');
}

/**
 * Detect if a service is regular Cable Concealment/Hide Wires
 * Matches: "Cable Concealment", "In-Wall Cable Concealment", etc.
 * Excludes Fire Safe (which has its own cost)
 */
function isHideWires(serviceName: string): boolean {
  const name = serviceName.toLowerCase();
  return !isFireSafe(serviceName) && 
         (name.includes('cable concealment') || 
          name.includes('in-wall') ||
          name.includes('hide'));
}

/**
 * Calculate worker earnings for a booking
 */
export function calculateWorkerEarnings(
  services: ServiceLineItem[],
  tipAmount: number = 0
): WorkerEarningsBreakdown {
  // Calculate total charged (sum of all services)
  const totalCharged = services.reduce(
    (sum, service) => sum + (service.base_price * service.quantity),
    0
  );

  // Count equipment items and calculate costs
  let fullMotionMountCount = 0;
  let flatMountCount = 0;
  let hideWiresCount = 0;
  let fireSafeCount = 0;

  services.forEach(service => {
    if (isFullMotionMount(service.service_name)) {
      fullMotionMountCount += service.quantity;
    } else if (isFlatMount(service.service_name)) {
      flatMountCount += service.quantity;
    } else if (isFireSafe(service.service_name)) {
      fireSafeCount += service.quantity;
    } else if (isHideWires(service.service_name)) {
      hideWiresCount += service.quantity;
    }
  });

  const fullMotionMountCost = fullMotionMountCount * EQUIPMENT_COSTS.FULL_MOTION_MOUNT;
  const flatMountCost = flatMountCount * EQUIPMENT_COSTS.FLAT_MOUNT;
  const hideWiresCost = hideWiresCount * EQUIPMENT_COSTS.HIDE_WIRES;
  const fireSafeCost = fireSafeCount * EQUIPMENT_COSTS.FIRE_SAFE;

  const equipmentCosts = fullMotionMountCost + flatMountCost + hideWiresCost + fireSafeCost;

  // Calculate commissionable amount and worker's share
  const commissionableAmount = totalCharged - equipmentCosts;
  const workerCommission = commissionableAmount * COMMISSION_RATE;
  const totalEarnings = workerCommission + tipAmount;

  return {
    totalCharged,
    equipmentCosts,
    commissionableAmount,
    workerCommission,
    tipAmount,
    totalEarnings,
    costBreakdown: {
      fullMotionMountCount,
      fullMotionMountCost,
      flatMountCount,
      flatMountCost,
      hideWiresCount,
      hideWiresCost,
      fireSafeCount,
      fireSafeCost,
    },
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
