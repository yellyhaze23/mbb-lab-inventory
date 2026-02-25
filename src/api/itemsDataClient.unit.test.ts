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
          insert: async (payload) => {
            inserts.push({ table, payload });
            return { error: null };
          },
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

    const containerInsert = inserts.find((i) => i.table === 'item_containers')?.payload;
    expect(containerInsert).toHaveLength(2);
    expect(containerInsert[0]).toMatchObject({ status: 'sealed', remaining_content: 50, content_unit: 'g' });
    expect(containerInsert[1]).toMatchObject({ status: 'sealed', remaining_content: 50, content_unit: 'g' });
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
