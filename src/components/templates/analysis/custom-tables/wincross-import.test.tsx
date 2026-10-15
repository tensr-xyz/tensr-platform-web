import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WincrossImport } from './wincross-import';
import { parseWincrossJob } from '@/lib/custom-tables/api';

jest.mock('@/lib/custom-tables/api', () => ({
  parseWincrossJob: jest.fn(async () => ({ report: null, tables: [] })),
}));

describe('WinCross job picker', () => {
  it('hides the file input and shows the chosen name in our own text', async () => {
    render(<WincrossImport token="token" onLoadCanvas={jest.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.className).toContain('hidden');
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument();
    expect(screen.getByText('No file chosen')).toBeInTheDocument();

    const file = new File(['TABLE'], 'wave.job', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => 'TABLE' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('wave.job')).toBeInTheDocument();
    await waitFor(() => expect(parseWincrossJob).toHaveBeenCalledWith('TABLE', 'token'));
  });
});
