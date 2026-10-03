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

  it('adds an APA figure caption without changing the default chart', () => {
    const chart: AnalysisReportChart = {
      kind: 'bar',
      title: 'Scores by group',
      x_label: 'Group',
      y_label: 'Score',
      categories: ['A'],
      series: [{ name: 'Score', values: [10] }],
    };
    render(<ReportChart chart={chart} density="comfortable" preset="apa" />);
    expect(screen.getByText('Figure 1')).toBeTruthy();
    expect(screen.getAllByText('Scores by group').length).toBeGreaterThan(0);
    expect(screen.getByText(/Note\./)).toBeTruthy();
  });
});

describe('ReportChart palette kinds', () => {
  const category = {
    title: 'PTS by Pos',
    x_label: 'Pos',
    y_label: 'PTS',
    categories: ['G', 'F'],
    series: [{ name: 'PTS', values: [15, 30] }],
  };

  it('draws a bar as bars', () => {
    const { container } = render(
      <ReportChart chart={{ ...category, kind: 'bar' }} density="comfortable" />
    );
    expect(container.querySelector('[data-chart-kind="bar"] rect')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="bar"] polyline')).toBeNull();
  });

  it('draws a line as a line', () => {
    const { container } = render(
      <ReportChart chart={{ ...category, kind: 'line' }} density="comfortable" />
    );
    expect(container.querySelector('[data-chart-kind="line"] polyline')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="line"] polygon')).toBeNull();
  });

  it('draws an area as a filled area', () => {
    const { container } = render(
      <ReportChart chart={{ ...category, kind: 'area' }} density="comfortable" />
    );
    expect(container.querySelector('[data-chart-kind="area"] polygon')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="area"] polyline')).toBeTruthy();
  });

  it('draws a pie', () => {
    const { container } = render(
      <ReportChart
        chart={{
          kind: 'pie',
          title: 'PTS by Pos',
          categories: ['G', 'F'],
          values: [30, 30],
        }}
        density="comfortable"
      />
    );
    expect(container.querySelector('[data-chart-kind="pie"]')).toBeTruthy();
    expect(container.querySelector('path')).toBeTruthy();
  });

  it('sizes weighted scatter points by weight and leaves unweighted points equal', () => {
    const weighted = render(
      <ReportChart
        chart={{
          kind: 'scatter',
          title: 'Weighted PTS vs AST',
          x_label: 'AST',
          y_label: 'PTS',
          point_size: 'weight',
          points: [
            { x: 1, y: 7, weight: 1 },
            { x: 2, y: 8, weight: 4 },
          ],
        }}
      />
    );
    const svg = weighted.container.querySelector('[data-chart-kind="scatter"]');
    expect(svg?.getAttribute('data-point-size')).toBe('weight');
    const radii = Array.from(weighted.container.querySelectorAll('circle')).map(c =>
      Number(c.getAttribute('r'))
    );
    expect(radii[1]! / radii[0]!).toBeCloseTo(2, 5);
    weighted.unmount();

    const plain = render(
      <ReportChart
        chart={{
          kind: 'scatter',
          title: 'PTS vs AST',
          x_label: 'AST',
          y_label: 'PTS',
          points: [
            { x: 1, y: 7 },
            { x: 2, y: 8 },
          ],
        }}
      />
    );
    expect(plain.container.querySelector('[data-point-size]')).toBeNull();
    const plainRadii = Array.from(plain.container.querySelectorAll('circle')).map(c =>
      c.getAttribute('r')
    );
    expect(new Set(plainRadii).size).toBe(1);
  });

  it('draws a scatter, a histogram, and a boxplot', () => {
    const scatter = render(
      <ReportChart
        chart={{
          kind: 'scatter',
          title: 'PTS vs Age',
          x_label: 'Age',
          y_label: 'PTS',
          points: [
            { x: 22, y: 10 },
            { x: 28, y: 30 },
          ],
        }}
      />
    );
    expect(scatter.container.querySelector('[data-chart-kind="scatter"]')).toBeTruthy();
    scatter.unmount();

    const histogram = render(
      <ReportChart
        chart={{
          kind: 'histogram',
          title: 'PTS',
          x_label: 'PTS',
          bins: [
            { start: 0, end: 10, count: 1 },
            { start: 10, end: 20, count: 2 },
          ],
        }}
      />
    );
    expect(histogram.container.querySelector('[data-chart-kind="histogram"]')).toBeTruthy();
    histogram.unmount();

    const box = render(
      <ReportChart
        chart={{
          kind: 'boxplot',
          title: 'PTS by Pos',
          y_label: 'PTS',
          groups: [{ label: 'G', min: 10, q1: 12, median: 15, q3: 18, max: 20 }],
        }}
      />
    );
    expect(box.container.querySelector('[data-chart-kind="boxplot"]')).toBeTruthy();
  });

  it('draws an empty scatter instead of nothing', () => {
    const { container } = render(
      <ReportChart
        chart={{
          kind: 'scatter',
          title: 'No rows',
          x_label: 'Age',
          y_label: 'PTS',
          points: [],
        }}
      />
    );
    expect(container.querySelector('[data-chart-kind="scatter"]')).toBeTruthy();
  });
});
