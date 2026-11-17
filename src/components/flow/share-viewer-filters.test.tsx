import { fireEvent, render, screen } from '@testing-library/react';
import { ShareViewerFilters } from './share-viewer-filters';
import type { PublicViewerControl } from '@/lib/share-viewer-controls';

const controls: PublicViewerControl[] = [
  {
    id: 'region',
    type: 'dropdown',
    column: 'region',
    label: 'Region',
    allLabel: '(All)',
    multi: false,
    options: [
      { value: 'N', label: 'North' },
      { value: 'S', label: 'South' },
    ],
  },
  {
    id: 'gender',
    type: 'dropdown',
    column: 'gender',
    label: 'Gender',
    allLabel: '(All)',
    multi: false,
    options: [
      { value: '1', label: 'Women' },
      { value: '2', label: 'Men' },
    ],
  },
];

describe('ShareViewerFilters', () => {
  it('renders Paper 9f filter chips and Save view', () => {
    const onChange = jest.fn();
    const onSaveView = jest.fn();
    render(
      <ShareViewerFilters
        controls={controls}
        values={{ gender: '1' }}
        onChange={onChange}
        onSaveView={onSaveView}
      />
    );
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Region filter' })).toHaveTextContent('Region: All');
    expect(screen.getByRole('button', { name: 'Gender filter' })).toHaveTextContent(
      'Gender: Women'
    );
    expect(screen.getByRole('button', { name: 'Save view' })).toBeInTheDocument();
  });

  it('lets the viewer name and save a view', () => {
    const onSaveView = jest.fn();
    render(
      <ShareViewerFilters
        controls={controls}
        values={{ region: 'N' }}
        onChange={jest.fn()}
        onSaveView={onSaveView}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    fireEvent.change(screen.getByLabelText('View name'), {
      target: { value: 'North only' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSaveView).toHaveBeenCalledWith('North only', { region: 'N' });
  });

  it('hides when there are no viewer controls', () => {
    const { container } = render(
      <ShareViewerFilters controls={[]} values={{}} onChange={jest.fn()} onSaveView={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
