import { render, screen } from '@testing-library/react';
import { ProvenanceInspector } from './index';
import { truncateFingerprint, weightVectorSummary } from '@/lib/provenance-inspector';

describe('ProvenanceInspector helpers', () => {
  it('truncates long fingerprints', () => {
    expect(truncateFingerprint('abcdefghijklmnopqr')).toBe('abcdefghijklmnop…');
    expect(truncateFingerprint('short')).toBe('short');
    expect(truncateFingerprint(null)).toBeNull();
  });

  it('summarizes weight_vector', () => {
    expect(weightVectorSummary({ explicit_null: true })).toBe('explicit_null');
    expect(weightVectorSummary({ identity: 'abc', method: 'rake' })).toBe(
      'identity=abc, method=rake'
    );
  });
});

describe('ProvenanceInspector', () => {
  it('renders nothing without provenance', () => {
    const { container } = render(<ProvenanceInspector provenance={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows trace kind and convention fields when present', () => {
    render(
      <ProvenanceInspector
        provenance={{
          row_uid_bitset: 'BQ==',
          row_uid_bitset_miss_count: 0,
          content_fingerprint: 'deadbeefcafebabe0123456789',
          origin_dataset_id: 'ds-origin',
          weight_vector: { identity: 'w1', method: 'rake' },
          convention: {
            variance_mode: 'q_taylor_srs',
            test_type: 't',
            overlap_mode: 'exclude',
            bessel_means: true,
            bessel_proportions: false,
            extra_deff: 1,
          },
        }}
      />
    );
    expect(screen.getByTestId('provenance-inspector')).toBeInTheDocument();
    expect(screen.getByText('complete')).toBeInTheDocument();
    expect(screen.getByText('q_taylor_srs')).toBeInTheDocument();
    expect(screen.getByText('deadbeefcafebabe…')).toBeInTheDocument();
    expect(screen.getByText('ds-origin')).toBeInTheDocument();
    expect(screen.getByText(/identity=w1/)).toBeInTheDocument();
  });
});
