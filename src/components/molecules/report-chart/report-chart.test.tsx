import { render, screen } from '@testing-library/react';
import { ReportChart } from './index';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';

// jsdom ResizeObserver stub
beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error test stub
  global.ResizeObserver = RO;
});

describe('ReportChart axes', () => {
  it('renders numeric tick labels on scatter', () => {
    const chart: AnalysisReportChart = {
      kind: 'scatter',
      title: 'Test scatter',
      x_label: 'X',
      y_label: 'Y',
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 50 },
      ],
    };
    const { container } = render(<ReportChart chart={chart} density="comfortable" />);
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent || '');
    expect(texts.some(t => t === '0' || t === '50' || t === '100')).toBe(true);
    expect(screen.getByText('Test scatter')).toBeTruthy();
  });

  it('formats datetime categories on line charts', () => {
    const chart: AnalysisReportChart = {
      kind: 'line',
      title: 'Monthly',
      x_label: 'Month',
      y_label: 'N',
      x_scale: 'datetime',
      categories: ['2024-01-01', '2024-06-01', '2024-12-01'],
      series: [{ name: 'N', values: [1, 2, 3] }],
    };
    const { container } = render(<ReportChart chart={chart} density="comfortable" />);
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent || '');
    expect(texts.some(t => /Jan/.test(t) && /2024/.test(t))).toBe(true);
  });

  it('rotates long bar category labels instead of 8-char hard cap only', () => {
    const chart: AnalysisReportChart = {
      kind: 'bar_grouped',
      title: 'Venues',
      x_label: 'Entrance',
      y_label: 'Score',
      categories: ['Queen Elizabeth Olympic Park East Gate'],
      series: [{ name: 'Score', values: [10] }],
    };
    const { container } = render(<ReportChart chart={chart} density="comfortable" />);
    const label = Array.from(container.querySelectorAll('text')).find(t =>
      (t.textContent || '').includes('Queen')
    );
    expect(label).toBeTruthy();
    expect((label!.textContent || '').length).toBeGreaterThan(8);
  });
});
