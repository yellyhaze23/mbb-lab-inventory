import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { createItemForCategory } from '@/api/itemsDataClient';

const makeInsertChain = (result, recorder) => ({
  insert: (payload) => {
    recorder?.(payload);
    return {
      select: () => ({
        single: async () => ({ data: result, error: null }),
      }),
    };
  },
});

describe('createItemForCategory', () => {
  const inserts = [];

  beforeEach(() => {
    inserts.length = 0;
    fromMock.mockReset();
    fromMock.mockImplementation((table) => {
      if (table === 'items') {
        return makeInsertChain({ id: 'item-1', tracking_type: 'PACK_WITH_CONTENT', total_units: 2 }, (payload) => inserts.push({ table, payload }));
      }
      if (table === 'item_containers') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
          update: () => ({
            in: async () => ({ error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('creates chemical pack-with-content with correct total and container rows', async () => {
    await createItemForCategory('chemical', {
      name: 'NaCl',
      tracking_type: 'PACK_WITH_CONTENT',
      total_units: 2,
      unit_type: 'bottle',
      content_per_unit: 50,
      content_unit: 'g',
      room_area: 'MBB Lab',
      storage_type: 'Shelf',
      minimum_stock: 1,
    });

    const itemInsert = inserts.find((i) => i.table === 'items')?.payload;
    expect(itemInsert.total_content).toBe(100);
    expect(itemInsert.content_unit).toBe('g');
    expect(inserts.some((i) => i.table === 'item_containers')).toBe(false);
  });

  it('maps already_opened for pack-with-content to opened_date on create', async () => {
    await createItemForCategory('chemical', {
      name: 'Acetone',
      tracking_type: 'PACK_WITH_CONTENT',
      total_units: 2,
      unit_type: 'bottle',
      content_per_unit: 50,
      content_unit: 'mL',
      room_area: 'MBB Lab',
      storage_type: 'Shelf',
      minimum_stock: 1,
      already_opened: true,
    });

    const itemInsert = inserts.find((i) => i.table === 'items')?.payload;
    expect(itemInsert.opened_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects chemical payload with consumable content unit', async () => {
    await expect(createItemForCategory('chemical', {
      name: 'Ethanol',
      tracking_type: 'PACK_WITH_CONTENT',
      total_units: 2,
      unit_type: 'bottle',
      content_per_unit: 50,
      content_unit: 'pcs',
      room_area: 'MBB Lab',
      storage_type: 'Shelf',
      minimum_stock: 1,
    })).rejects.toThrow(/invalid content unit/i);
  });

  it('rejects consumable payload with chemical content unit', async () => {
    await expect(createItemForCategory('consumable', {
      name: 'PCR tips',
      tracking_type: 'PACK_WITH_CONTENT',
      total_units: 2,
      unit_type: 'box',
      content_per_unit: 50,
      content_unit: 'g',
      room_area: 'MBB Lab',
      storage_type: 'Shelf',
      minimum_stock: 1,
    })).rejects.toThrow(/invalid content unit/i);
  });
});
