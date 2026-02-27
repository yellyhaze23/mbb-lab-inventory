export const ITEM_CATEGORIES = {
  CHEMICAL: 'chemical',
  CONSUMABLE: 'consumable',
};

export const TRACKING_TYPES = {
  SIMPLE_MEASURE: 'SIMPLE_MEASURE',
  UNIT_ONLY: 'UNIT_ONLY',
  PACK_WITH_CONTENT: 'PACK_WITH_CONTENT',
};

export const CHEMICAL_UNITS = ['mg', 'g', 'kg', 'uL', 'µL', 'mL', 'L'];
export const CONSUMABLE_UNITS = ['pcs', 'pieces', 'tubes', 'vials', 'strips', 'sachets', 'preps', 'plates'];

export const CHEMICAL_CONTAINER_TYPES = ['bottle', 'jar', 'vial', 'tube', 'bag', 'can', 'box', 'drum', 'gallon'];
export const CONSUMABLE_CONTAINER_TYPES = ['pack', 'box', 'pcs', 'set', 'bundle', 'carton', 'kit', 'racks'];

export const CATEGORY_CONTENT_UNITS = {
  [ITEM_CATEGORIES.CHEMICAL]: CHEMICAL_UNITS,
  [ITEM_CATEGORIES.CONSUMABLE]: CONSUMABLE_UNITS,
};

export const CATEGORY_CONTAINER_TYPES = {
  [ITEM_CATEGORIES.CHEMICAL]: CHEMICAL_CONTAINER_TYPES,
  [ITEM_CATEGORIES.CONSUMABLE]: CONSUMABLE_CONTAINER_TYPES,
};

export const getDefaultContentUnitForCategory = (category) => {
  if (category === ITEM_CATEGORIES.CHEMICAL) return 'g';
  return CATEGORY_CONTENT_UNITS[category]?.[0] || 'pcs';
};

export const getDefaultContainerTypeForCategory = (category) => (
  CATEGORY_CONTAINER_TYPES[category]?.[0] || 'pack'
);

export const isValidContentUnitForCategory = (category, unit) => {
  const normalized = String(unit || '').trim();
  if (!normalized) return false;
  return (CATEGORY_CONTENT_UNITS[category] || []).includes(normalized);
};
