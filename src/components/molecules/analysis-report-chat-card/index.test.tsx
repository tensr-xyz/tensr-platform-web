import { render, screen } from '@testing-library/react';
import { AnalysisReportChatCard } from './index';

describe('AnalysisReportChatCard excel download', () => {
  it('shows a download button when the result includes the workbook', () => {
    render(
      <AnalysisReportChatCard
        title="Custom Tables"
        summary="Excel file banner.xlsx is ready to download."
        excelDownload={{
          filename: 'banner.xlsx',
          mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          excelBase64: 'QQ==',
        }}
        onOpen={() => undefined}
      />
    );
    expect(screen.getByTestId('analysis-report-excel-download')).toHaveTextContent(
      'Download banner.xlsx'
    );
  });
});
