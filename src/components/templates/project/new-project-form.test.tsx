import { fireEvent, render, screen } from '@testing-library/react';
import NewProjectForm from './new-project-form';

const push = jest.fn();
const uploadFile = jest.fn();
let onComplete: ((id: string, name: string) => void) | undefined;

jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('posthog-js', () => ({ capture: jest.fn(), captureException: jest.fn() }));
jest.mock('@/hooks/api/use-dataset-upload', () => ({
  useDatasetUpload: (_scope: string, cb: (id: string, name: string) => void) => {
    onComplete = cb;
    return { uploadFile, isLoading: false, error: null };
  },
}));

describe('NewProjectForm', () => {
  beforeEach(() => {
    push.mockReset();
    uploadFile.mockReset();
  });

  it('has no blank-dataset option: the submit stays disabled until a file is chosen', () => {
    render(<NewProjectForm />);
    expect(screen.queryByText(/source type/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload and open/i })).toBeDisabled();
  });

  it('uploads the chosen file and opens it as a dataset', () => {
    render(<NewProjectForm />);
    const file = new File(['a,b\n1,2\n'], 'wave1.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/data file/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload and open/i }));
    expect(uploadFile).toHaveBeenCalledWith(file);

    onComplete?.('ds-1', 'wave1.csv');
    expect(push).toHaveBeenCalledWith('/workspace/dataset/ds-1?name=wave1.csv');
  });
});
