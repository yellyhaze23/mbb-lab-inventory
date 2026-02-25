import { describe, expect, it } from 'vitest';
import { applyContentDeduction } from '@/utils/containerMath';

const makeContainers = () => ([
  { container_index: 1, status: 'sealed' as const, initial_content: 50, remaining_content: 50 },
  { container_index: 2, status: 'sealed' as const, initial_content: 50, remaining_content: 50 },
]);

describe('applyContentDeduction', () => {
  it('deducts 1 from a sealed-only set by opening one container', () => {
    const next = applyContentDeduction(makeContainers(), 1);
    expect(next[0]).toMatchObject({ status: 'opened', remaining_content: 49 });
    expect(next[1]).toMatchObject({ status: 'sealed', remaining_content: 50 });
  });

  it('deducts 60 across containers in FIFO order', () => {
    const next = applyContentDeduction(makeContainers(), 60);
    expect(next[0]).toMatchObject({ status: 'empty', remaining_content: 0 });
    expect(next[1]).toMatchObject({ status: 'opened', remaining_content: 40 });
  });
});

