import { fireEvent, render, screen } from '@testing-library/react';

import { AnalysisCommandPalette } from './index';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    plugins: {
      installed: () =>
        Promise.resolve({
          items: [
            {
              plugin: {
                pluginId: 'histogram-helper',
                name: 'Histogram helper',
                description: 'Draws bars',
                status: 'APPROVED',
                version: '1.0.0',
                keywords: ['histogram'],
                tags: [],
              },
            },
          ],
        }),
      execute: jest.fn(),
    },
  },
}));

describe('analysis command palette', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('shows Merge Datasets when the search is stack', async () => {
    render(<AnalysisCommandPalette open onOpenChange={() => undefined} />);

    fireEvent.change(screen.getByPlaceholderText('Search analyses and plugins…'), {
      target: { value: 'stack' },
    });

    expect(await screen.findByRole('option', { name: 'Merge Datasets' })).toBeVisible();
    expect(screen.queryByText('No plugins match your search.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search analyses and plugins…'), {
      target: { value: 'append' },
    });

    expect(screen.getByRole('option', { name: 'Merge Datasets' })).toBeVisible();
  });

  it('filters the list to Pivot table when the search is pivot', async () => {
    render(<AnalysisCommandPalette open onOpenChange={() => undefined} />);

    fireEvent.change(screen.getByPlaceholderText('Search analyses and plugins…'), {
      target: { value: 'pivot' },
    });

    expect(await screen.findByRole('option', { name: /Pivot table/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Descriptives' })).not.toBeInTheDocument();
    expect(screen.queryByText('Compare Means')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Merge Datasets' })).not.toBeInTheDocument();
  });
});
