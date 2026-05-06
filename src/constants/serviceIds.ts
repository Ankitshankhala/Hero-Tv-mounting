// Stable service identifiers used by the booking + worker flows.
// IDs are immutable; admin can rename services freely without breaking lookups.
export const SERVICE_IDS = {
  mountTv:     'a50013bc-ee03-4452-b3ec-1683094d787a',
  over65:      '81194c48-77a8-496e-9d87-f048fe501df0',
  frameMount:  '1b47852d-4cbf-439a-89dc-41bac8bcc20e',
  soundbar:    '41ec18d4-516b-4af6-9b05-e38b534923dd',
  specialWall: 'b86fda8c-a667-4dee-b180-3c83d6329c3f',
} as const;

export type ServiceKey = keyof typeof SERVICE_IDS;

export const findServiceById = <T extends { id: string }>(
  services: T[],
  key: ServiceKey
): T | undefined => services.find(s => s.id === SERVICE_IDS[key]);
