export type ItemCategory = 'chemical' | 'consumable';
export type ContainerStatus = 'sealed' | 'opened' | 'empty';

export interface InventoryItem {
  id: string;
  category: ItemCategory;
  tracking_type: 'SIMPLE_MEASURE' | 'UNIT_ONLY' | 'PACK_WITH_CONTENT';
  total_units: number | null;
  unit_type: string | null;
  content_per_unit: number | null;
  content_unit: string | null;
  total_content: number | null;
  total_content_unit: string | null;
  sealed_count?: number | null;
  opened_count?: number | null;
  empty_count?: number | null;
}

export interface ItemContainer {
  id: string;
  item_id: string;
  container_index: number;
  status: ContainerStatus;
  initial_content: number;
  remaining_content: number;
  content_unit: string;
  created_at: string;
}

