import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/edgeClient', () => ({
  invokeEdgeFunction: vi.fn(),
}));

import { isAdminProfile, validateMsdsFile } from '@/api/msdsService';

describe('isAdminProfile', () => {
  it('returns true for admin role', () => {
    expect(isAdminProfile({ role: 'admin' })).toBe(true);
  });

  it('returns true for super_admin role', () => {
    expect(isAdminProfile({ role: 'super_admin' })).toBe(true);
  });

  it('returns false for other roles', () => {
    expect(isAdminProfile({ role: 'teacher' })).toBe(false);
  });
});

describe('validateMsdsFile', () => {
  it('rejects missing file', () => {
    expect(validateMsdsFile(null)).toEqual({
      valid: false,
      message: 'Please select a PDF file.',
    });
  });

  it('rejects non-PDF file', () => {
    const file = new File(['plain'], 'note.txt', { type: 'text/plain' });
    expect(validateMsdsFile(file)).toEqual({
      valid: false,
      message: 'Only PDF files are allowed.',
    });
  });

  it('accepts a PDF file', () => {
    const file = new File(['%PDF-1.4'], 'sheet.pdf', { type: 'application/pdf' });
    expect(validateMsdsFile(file)).toEqual({
      valid: true,
      message: null,
    });
  });
});
