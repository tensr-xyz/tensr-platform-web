import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileSelector, ProjectFile } from '@/components/molecules/file-selector';

jest.mock('@/components/molecules/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

jest.mock('@/components/atoms/button', () => ({
  Button: ({
    children,
    onClick,
    variant,
    disabled,
  }: React.ComponentProps<'button'> & { variant?: string }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-testid="button"
    >
      {children}
    </button>
  ),
}));

describe('FileSelector', () => {
  const mockFiles: ProjectFile[] = [
    { path: 'data.csv', type: 'text/csv', size: 1024 },
    {
      path: 'analysis.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 2048,
    },
    { path: 'large_dataset.csv', type: 'text/csv', size: 10 * 1024 * 1024 },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onFileSelect: jest.fn(),
    projectName: 'Test Project',
    files: mockFiles,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open with title and project name', () => {
    render(<FileSelector {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Select File to Import' })).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<FileSelector {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('lists all files with formatted sizes', () => {
    render(<FileSelector {...defaultProps} />);
    expect(screen.getByText('data.csv')).toBeInTheDocument();
    expect(screen.getByText('analysis.xlsx')).toBeInTheDocument();
    expect(screen.getByText('large_dataset.csv')).toBeInTheDocument();
    expect(screen.getByText(/1 KB/)).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
    expect(screen.getByText(/10 MB/)).toBeInTheDocument();
  });

  it('calls onFileSelect with row index when a file row is clicked', () => {
    render(<FileSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('data.csv'));
    expect(defaultProps.onFileSelect).toHaveBeenCalledWith(0);
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<FileSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
