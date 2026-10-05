import { act, fireEvent, render, screen } from '@testing-library/react';
import { EditableCell } from './index';

async function editTo(next: string) {
  fireEvent.doubleClick(screen.getByText('1'));
  const input = screen.getByDisplayValue('1');
  fireEvent.change(input, { target: { value: next } });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });
}

describe('EditableCell', () => {
  it('shows the stored value again when the edit is refused', async () => {
    const onEdit = jest.fn().mockResolvedValue(false);
    render(<EditableCell value="1" onEdit={onEdit} />);

    await editTo('1000');

    expect(onEdit).toHaveBeenCalledWith('1000');
    expect(screen.queryByText('1000')).toBeNull();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('keeps the new value when the edit is accepted', async () => {
    const onEdit = jest.fn().mockResolvedValue(true);
    render(<EditableCell value="1" onEdit={onEdit} />);

    await editTo('1000');

    expect(screen.getByText('1000')).toBeTruthy();
  });

  it('keeps the new value for callers that return nothing', async () => {
    const onEdit = jest.fn();
    render(<EditableCell value="1" onEdit={onEdit} />);

    await editTo('1000');

    expect(screen.getByText('1000')).toBeTruthy();
  });
});
