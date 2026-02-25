import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MsdsViewerModal from '@/components/msds/MsdsViewerModal';

describe('MsdsViewerModal', () => {
  it('shows empty state and disables external-open button when no URL is provided', () => {
    render(
      <MsdsViewerModal
        open
        onClose={vi.fn()}
        title="Acetone"
        signedUrl={null}
      />
    );

    expect(screen.getByText('Unable to load MSDS preview.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in New Tab' })).toBeDisabled();
  });

  it('opens a new tab when signed URL exists and button is clicked', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MsdsViewerModal
        open
        onClose={vi.fn()}
        title="Acetone"
        signedUrl="https://example.com/msds.pdf"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open in New Tab' }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/msds.pdf',
      '_blank',
      'noopener,noreferrer'
    );

    openSpy.mockRestore();
  });
});
