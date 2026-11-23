import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectAiSettingsPanel } from './project-ai-settings';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(),
}));

import { flowJson } from '@/lib/flow-api';

const mockedFlowJson = flowJson as jest.MockedFunction<typeof flowJson>;

function renderPanel(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ProjectAiSettingsPanel', () => {
  beforeEach(() => {
    mockedFlowJson.mockReset();
  });

  it('renders Paper 10g AI preference rows and toggles commentary', async () => {
    mockedFlowJson
      .mockResolvedValueOnce({
        project: {
          ai_enabled: true,
          ai_settings: {
            write_commentary: true,
            suggest_next: true,
            auto_edit_data: false,
            code_open_ends: true,
            commentary_tone: 'plain_short',
          },
        },
      })
      .mockResolvedValueOnce({
        project: {
          ai_enabled: true,
          ai_settings: {
            write_commentary: false,
            suggest_next: true,
            auto_edit_data: false,
            code_open_ends: true,
            commentary_tone: 'plain_short',
          },
        },
      });

    renderPanel(<ProjectAiSettingsPanel projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("How Tensr's AI works on this project")).toBeInTheDocument();
    });
    expect(screen.getByText('Write commentary on tables and slides')).toBeInTheDocument();
    expect(screen.getByText('Off · asks first')).toBeInTheDocument();
    expect(
      screen.getByText('Every AI change is listed in Version history and can be undone.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'On' })[1]!);
    await waitFor(() => {
      expect(mockedFlowJson).toHaveBeenCalledWith(
        '/api/projects/proj-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ ai_settings: { write_commentary: false } }),
        })
      );
    });
  });
});
