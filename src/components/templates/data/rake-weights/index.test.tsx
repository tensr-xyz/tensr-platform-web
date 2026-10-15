import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RakeWeightsDialog } from './index';

jest.mock('@/utils/auth', () => ({
  getAccessToken: () => null,
}));

describe('Rake Weights targets file', () => {
  it('hides the file input and shows the chosen name in our own text', async () => {
    render(
      <RakeWeightsDialog>
        <button type="button">Open rake</button>
      </RakeWeightsDialog>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open rake' }));

    const input = document.querySelector('#rake-targets-file') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.className).toContain('hidden');
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument();
    expect(screen.getByText('No file chosen')).toBeInTheDocument();

    const file = new File(['variable,category,target\nGender,Female,0.5\n'], 'targets.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      value: async () => 'variable,category,target\nGender,Female,0.5\n',
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('targets.csv')).toBeInTheDocument();
  });
});
