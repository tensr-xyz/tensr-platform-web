'use client';

import { Button } from '@/components/ui/button';
import { listPageLayoutsForPicker, type PageLayoutMaster } from '@/lib/report-theme';
import type { SavedPageTemplate } from '@/lib/report-document';

function LayoutThumb({ layoutId }: { layoutId: string }) {
  if (layoutId === 'blank') {
    return <span className="report-layout-thumb report-layout-thumb-blank" aria-hidden="true" />;
  }
  if (layoutId === 'title_page') {
    return (
      <span className="report-layout-thumb" aria-hidden="true">
        <span className="report-layout-bar report-layout-bar-lg" />
        <span className="report-layout-bar report-layout-bar-sm" />
      </span>
    );
  }
  if (layoutId === 'title_and_content' || layoutId === 'title_only') {
    return (
      <span className="report-layout-thumb report-layout-thumb-col" aria-hidden="true">
        <span className="report-layout-bar" />
        <span className="report-layout-block" />
      </span>
    );
  }
  if (layoutId === 'content_and_text') {
    return (
      <span className="report-layout-thumb report-layout-thumb-col" aria-hidden="true">
        <span className="report-layout-bar" />
        <span className="report-layout-split">
          <span className="report-layout-block" />
          <span className="report-layout-lines">
            <span />
            <span />
            <span className="report-layout-bar-sm" />
          </span>
        </span>
      </span>
    );
  }
  if (layoutId === 'two_content') {
    return (
      <span className="report-layout-thumb report-layout-thumb-col" aria-hidden="true">
        <span className="report-layout-bar" />
        <span className="report-layout-split">
          <span className="report-layout-block" />
          <span className="report-layout-block" />
        </span>
      </span>
    );
  }
  return (
    <span className="report-layout-thumb report-layout-thumb-col" aria-hidden="true">
      <span className="report-layout-bar" />
      <span className="report-layout-block" />
    </span>
  );
}

export function ReportLayoutPicker({
  title = 'Add a page',
  afterLabel,
  selectedLayoutId,
  templates = [],
  onPickLayout,
  onPickTemplate,
}: {
  title?: string;
  afterLabel?: string;
  selectedLayoutId?: string | null;
  templates?: SavedPageTemplate[];
  onPickLayout: (layout: PageLayoutMaster) => void;
  onPickTemplate?: (template: SavedPageTemplate) => void;
}) {
  const layouts = listPageLayoutsForPicker();
  return (
    <div className="report-layout-picker" role="dialog" aria-label={title}>
      <div className="report-layout-picker-head">
        <span className="report-layout-picker-title">{title}</span>
        {afterLabel ? <span className="report-layout-picker-meta">{afterLabel}</span> : null}
      </div>
      <div className="report-layout-picker-grid">
        {layouts.map(layout => (
          <Button
            key={layout.id}
            type="button"
            className="report-layout-option"
            data-active={layout.id === selectedLayoutId}
            onClick={() => onPickLayout(layout)}
          >
            <LayoutThumb layoutId={layout.id} />
            <span className="report-layout-option-label">{layout.label}</span>
          </Button>
        ))}
      </div>
      {templates.length ? (
        <div className="report-layout-picker-templates">
          <p className="report-layout-picker-templates-label">Your team&apos;s templates</p>
          <div className="report-layout-picker-chips">
            {templates.map(template => (
              <Button
                key={template.id}
                type="button"
                className="report-layout-chip"
                onClick={() => onPickTemplate?.(template)}
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
