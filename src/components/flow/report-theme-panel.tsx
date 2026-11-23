'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import {
  inspectPptxTemplate,
  normalizeReportTheme,
  reportThemeFromInspection,
  type ReportTheme,
} from '@/lib/report-theme';

const FONT_OPTIONS = ['Inter', 'System Sans-Serif', 'Times New Roman', 'Georgia', 'Arial'];

export function ReportThemePanel({
  theme,
  onChange,
  onSaveTeamTheme,
}: {
  theme: ReportTheme;
  onChange: (theme: ReportTheme) => void;
  onSaveTeamTheme: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const palette = theme.chartPalette.slice(0, 6);
  while (palette.length < 6) {
    palette.push('#E7E6E1');
  }

  const patch = (partial: Partial<ReportTheme>) => {
    onChange(normalizeReportTheme({ ...theme, ...partial }));
  };

  return (
    <div className="report-theme-panel" aria-label="Report theme">
      <p className="report-theme-panel-note">
        Applies to every page and to PowerPoint, PDF and Word exports.
      </p>

      <label className="report-editor-field">
        <span>Theme</span>
        <div className="report-theme-select" aria-label="Theme name">
          <span>{theme.name}</span>
          <span className="report-theme-select-caret" aria-hidden="true">
            ▾
          </span>
        </div>
      </label>

      <div className="report-editor-field">
        <span>Fonts</span>
        <div className="report-theme-fonts">
          <label className="report-theme-font-card">
            <span>Headings</span>
            <ChoiceSelect
              className="report-editor-select"
              aria-label="Heading font"
              value={theme.headingFontFamily}
              onValueChange={value => patch({ headingFontFamily: value })}
              options={FONT_OPTIONS.map(font => ({ value: font, label: font }))}
            />
          </label>
          <label className="report-theme-font-card">
            <span>Body</span>
            <ChoiceSelect
              className="report-editor-select"
              aria-label="Body font"
              value={theme.fontFamily}
              onValueChange={value => patch({ fontFamily: value })}
              options={FONT_OPTIONS.map(font => ({ value: font, label: font }))}
            />
          </label>
        </div>
      </div>

      <div className="report-editor-field">
        <span>Colours and chart palette</span>
        <div className="report-theme-palette">
          {palette.map((colour, index) => (
            <label key={`${colour}-${index}`} className="report-theme-swatch">
              <span style={{ background: colour }} />
              <Input
                type="color"
                value={colour.startsWith('#') ? colour : '#E7E6E1'}
                aria-label={`Palette colour ${index + 1}`}
                onChange={event => {
                  const next = [...theme.chartPalette];
                  next[index] = event.target.value;
                  patch({
                    chartPalette: next,
                    primaryColour: index === 0 ? event.target.value : theme.primaryColour,
                    secondaryColour: index === 1 ? event.target.value : theme.secondaryColour,
                  });
                }}
              />
            </label>
          ))}
          <span className="report-theme-edit-label">Edit</span>
        </div>
      </div>

      <div className="report-editor-field">
        <span>Logo · top right on every page</span>
        <div className="report-theme-logo">
          <span
            className="report-theme-logo-preview"
            style={theme.logoUrl ? { backgroundImage: `url(${theme.logoUrl})` } : undefined}
            aria-hidden="true"
          />
          <span className="report-theme-logo-name">
            {theme.logoName || (theme.logoUrl ? 'Logo' : 'No logo yet')}
          </span>
          <Button
            type="button"
            className="report-theme-link"
            onClick={() => fileRef.current?.click()}
          >
            {theme.logoUrl ? 'Replace' : 'Add'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pptx,.potx"
            className="report-theme-file"
            aria-label="Upload logo or PowerPoint theme"
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              const lower = file.name.toLowerCase();
              if (lower.endsWith('.pptx') || lower.endsWith('.potx')) {
                void file.arrayBuffer().then(async buffer => {
                  const inspected = await inspectPptxTemplate(buffer);
                  onChange(
                    normalizeReportTheme({
                      ...reportThemeFromInspection(inspected, theme),
                      name: inspected.themeName
                        ? `Team theme · ${inspected.themeName}`
                        : theme.name,
                    })
                  );
                });
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const url = typeof reader.result === 'string' ? reader.result : null;
                if (!url) return;
                patch({ logoUrl: url, logoName: file.name });
              };
              reader.readAsDataURL(file);
            }}
          />
        </div>
      </div>

      <div className="report-theme-actions">
        <Button type="button" className="flow-btn primary" onClick={onSaveTeamTheme}>
          Save as team theme
        </Button>
        <Button
          type="button"
          className="flow-btn"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pptx,.potx';
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              void file.arrayBuffer().then(async buffer => {
                const inspected = await inspectPptxTemplate(buffer);
                onChange(
                  normalizeReportTheme({
                    ...reportThemeFromInspection(inspected, theme),
                    name: inspected.themeName ? `Team theme · ${inspected.themeName}` : theme.name,
                  })
                );
              });
            };
            input.click();
          }}
        >
          From a .pptx
        </Button>
      </div>
      <p className="report-theme-panel-foot">
        Team themes show for everyone in the workspace. The agent uses the active theme when it
        builds pages.
      </p>
    </div>
  );
}
