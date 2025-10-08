import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileSelector, ProjectFile } from '@/components/molecules/file-selector';

// Mock the Dialog component
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

// Mock the Button component
jest.mock('@/components/atoms/button', () => ({
  Button: ({ children, onClick, variant, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-testid="button">
      {children}
    </button>
  ),
}));

describe('FileSelector Component', () => {
  const mockFiles: ProjectFile[] = [
    { path: 'data.csv', type: 'text/csv', size: 1024 },
    {
      path: 'analysis.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 2048,
    },
    { path: 'report.pdf', type: 'application/pdf', size: 5120 },
    { path: 'large_dataset.csv', type: 'text/csv', size: 10485760 }, // 10MB
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

  describe('Rendering', () => {
    it('should render when open', () => {
      render(<FileSelector {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('Select File to Process')).toBeInTheDocument();
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<FileSelector {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should display all files in the list', () => {
      render(<FileSelector {...defaultProps} />);

      expect(screen.getByText('data.csv')).toBeInTheDocument();
      expect(screen.getByText('analysis.xlsx')).toBeInTheDocument();
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
      expect(screen.getByText('large_dataset.csv')).toBeInTheDocument();
    });

    it('should display file sizes correctly', () => {
      render(<FileSelector {...defaultProps} />);

      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
      expect(screen.getByText('2.0 KB')).toBeInTheDocument();
      expect(screen.getByText('5.0 KB')).toBeInTheDocument();
      expect(screen.getByText('10.0 MB')).toBeInTheDocument();
    });

    it('should display file types correctly', () => {
      render(<FileSelector {...defaultProps} />);

      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('Excel')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('should call onFileSelect with correct index when file is clicked', () => {
      render(<FileSelector {...defaultProps} />);

      const fileButton = screen.getByText('data.csv').closest('button');
      fireEvent.click(fileButton!);

      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(0);
    });

    it('should call onFileSelect with correct index for different files', () => {
      render(<FileSelector {...defaultProps} />);

      const excelButton = screen.getByText('analysis.xlsx').closest('button');
      fireEvent.click(excelButton!);

      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(1);
    });

    it('should close dialog after file selection', () => {
      render(<FileSelector {...defaultProps} />);

      const fileButton = screen.getByText('data.csv').closest('button');
      fireEvent.click(fileButton!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onClose when cancel button is clicked', () => {
      render(<FileSelector {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not call onFileSelect when cancel is clicked', () => {
      render(<FileSelector {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(defaultProps.onFileSelect).not.toHaveBeenCalled();
    });
  });

  describe('File Size Formatting', () => {
    it('should format bytes correctly', () => {
      const filesWithVariousSizes: ProjectFile[] = [
        { path: 'tiny.txt', type: 'text/plain', size: 0 },
        { path: 'small.txt', type: 'text/plain', size: 500 },
        { path: 'medium.txt', type: 'text/plain', size: 1024 },
        { path: 'large.txt', type: 'text/plain', size: 1024 * 1024 },
        { path: 'huge.txt', type: 'text/plain', size: 1024 * 1024 * 1024 },
      ];

      render(<FileSelector {...defaultProps} files={filesWithVariousSizes} />);

      expect(screen.getByText('0 Bytes')).toBeInTheDocument();
      expect(screen.getByText('500 Bytes')).toBeInTheDocument();
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      expect(screen.getByText('1.0 GB')).toBeInTheDocument();
    });
  });

  describe('File Type Detection', () => {
    it('should detect CSV files correctly', () => {
      const csvFiles: ProjectFile[] = [
        { path: 'data.csv', type: 'text/csv', size: 1024 },
        { path: 'export.csv', type: 'application/csv', size: 2048 },
      ];

      render(<FileSelector {...defaultProps} files={csvFiles} />);

      expect(screen.getAllByText('CSV')).toHaveLength(2);
    });

    it('should detect Excel files correctly', () => {
      const excelFiles: ProjectFile[] = [
        {
          path: 'data.xlsx',
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1024,
        },
        { path: 'data.xls', type: 'application/vnd.ms-excel', size: 2048 },
      ];

      render(<FileSelector {...defaultProps} files={excelFiles} />);

      expect(screen.getAllByText('Excel')).toHaveLength(2);
    });

    it('should detect JSON files correctly', () => {
      const jsonFiles: ProjectFile[] = [
        { path: 'data.json', type: 'application/json', size: 1024 },
      ];

      render(<FileSelector {...defaultProps} files={jsonFiles} />);

      expect(screen.getByText('JSON')).toBeInTheDocument();
    });

    it('should fallback to file extension for unknown types', () => {
      const unknownFiles: ProjectFile[] = [
        { path: 'data.txt', type: 'text/plain', size: 1024 },
        { path: 'data.xml', type: 'application/xml', size: 2048 },
      ];

      render(<FileSelector {...defaultProps} files={unknownFiles} />);

      expect(screen.getByText('TXT')).toBeInTheDocument();
      expect(screen.getByText('XML')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should handle empty file list gracefully', () => {
      render(<FileSelector {...defaultProps} files={[]} />);

      expect(screen.getByText('No files available')).toBeInTheDocument();
    });

    it('should disable file selection buttons when no files', () => {
      render(<FileSelector {...defaultProps} files={[]} />);

      const buttons = screen.getAllByTestId('button');
      const fileButtons = buttons.filter(button => button.textContent !== 'Cancel');

      fileButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<FileSelector {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Select File to Process' })).toBeInTheDocument();
    });

    it('should have descriptive button text', () => {
      render(<FileSelector {...defaultProps} />);

      const fileButton = screen.getByText('data.csv').closest('button');
      expect(fileButton).toHaveAttribute('data-variant', 'outline');
    });
  });

  describe('Edge Cases', () => {
    it('should handle files with very long names', () => {
      const longNameFiles: ProjectFile[] = [
        {
          path: 'very_long_filename_that_should_be_truncated_or_wrapped_properly.csv',
          type: 'text/csv',
          size: 1024,
        },
      ];

      render(<FileSelector {...defaultProps} files={longNameFiles} />);

      expect(
        screen.getByText('very_long_filename_that_should_be_truncated_or_wrapped_properly.csv')
      ).toBeInTheDocument();
    });

    it('should handle files with special characters in names', () => {
      const specialCharFiles: ProjectFile[] = [
        { path: 'file with spaces.csv', type: 'text/csv', size: 1024 },
        { path: 'file-with-dashes.csv', type: 'text/csv', size: 2048 },
        { path: 'file_with_underscores.csv', type: 'text/csv', size: 3072 },
      ];

      render(<FileSelector {...defaultProps} files={specialCharFiles} />);

      expect(screen.getByText('file with spaces.csv')).toBeInTheDocument();
      expect(screen.getByText('file-with-dashes.csv')).toBeInTheDocument();
      expect(screen.getByText('file_with_underscores.csv')).toBeInTheDocument();
    });

    it('should handle very large file sizes', () => {
      const largeFiles: ProjectFile[] = [
        { path: 'huge.csv', type: 'text/csv', size: 1024 * 1024 * 1024 * 5 }, // 5GB
      ];

      render(<FileSelector {...defaultProps} files={largeFiles} />);

      expect(screen.getByText('5.0 GB')).toBeInTheDocument();
    });
  });
});
