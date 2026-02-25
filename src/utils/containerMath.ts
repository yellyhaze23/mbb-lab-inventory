export type ContainerStatus = 'sealed' | 'opened' | 'empty';

export interface ContainerState {
  container_index: number;
  status: ContainerStatus;
  initial_content: number;
  remaining_content: number;
}

export function applyContentDeduction(containers: ContainerState[], amount: number): ContainerState[] {
  if (amount <= 0) return containers;
  let remainingToDeduct = amount;
  const next = containers
    .map((c) => ({ ...c }))
    .sort((a, b) => a.container_index - b.container_index);

  for (const container of next.filter((c) => c.status === 'opened')) {
    if (remainingToDeduct <= 0) break;
    const take = Math.min(remainingToDeduct, container.remaining_content);
    container.remaining_content -= take;
    remainingToDeduct -= take;
    if (container.remaining_content <= 0) {
      container.remaining_content = 0;
      container.status = 'empty';
    }
  }

  for (const container of next.filter((c) => c.status === 'sealed')) {
    if (remainingToDeduct <= 0) break;
    container.status = 'opened';
    const take = Math.min(remainingToDeduct, container.remaining_content);
    container.remaining_content -= take;
    remainingToDeduct -= take;
    if (container.remaining_content <= 0) {
      container.remaining_content = 0;
      container.status = 'empty';
    }
  }

  return next;
}

