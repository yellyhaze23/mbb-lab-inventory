import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MsdsUploadDialog from '@/components/inventory/MsdsUploadDialog';

vi.mock('@/api/msdsService', () => ({
  validateMsdsFile: (file) =>
    file
      ? { valid: true, message: null }
      : { valid: false, message: 'Please select a PDF file.' },
}));

describe('MsdsUploadDialog', () => {
  it('submits selected file and closes modal on success', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <MsdsUploadDialog
        open
        onOpenChange={onOpenChange}
        chemicalName="Acetone"
        onSubmit={onSubmit}
      />
    );

    const file = new File(['%PDF-1.4'], 'sheet.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('MSDS PDF *'), file);
    await user.click(screen.getByRole('button', { name: /Upload MSDS/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
