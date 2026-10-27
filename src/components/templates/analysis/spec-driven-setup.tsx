'use client';

import { Checkbox } from '@/components/atoms/checkbox';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import {
  AdvancedOptionsDisclosure,
  ColumnSelect,
  FormSectionLabel,
  MultiColumnPicker,
} from '@/components/molecules/analysis-dialog';
import type { ColumnSlotType } from '@/lib/analysis-column-types';
import type { DatasetPreview, SchemaColumn } from '@/lib/analysis-report-types';
import {
  advancedChanged,
  defaultsLine,
  fieldChanged,
  isWeightParam,
  namesForParam,
  paramLabel,
  type AnalysisSpec,
  type SpecParam,
} from '@/lib/analysis-spec-setup';

type Props = {
  spec: AnalysisSpec;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  schema: SchemaColumn[];
  preview?: DatasetPreview | null;
  /** Descriptives waits to show the empty-variable error until Run or a change. */
  revealSelectionError?: boolean;
};

function asText(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function asColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function slotOf(param: SpecParam): ColumnSlotType | undefined {
  const types = (param.columnTypes ?? []).filter(type => type && type !== 'any');
  const slot = types[0];
  if (slot === 'numeric' || slot === 'categorical' || slot === 'date/time' || slot === 'string') {
    return slot;
  }
  return undefined;
}

function ChangedDot({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="inline-block size-1.5 rounded-full bg-primary" aria-label="Changed" />;
}

function FieldLabel({
  param,
  changed,
  htmlFor,
}: {
  param: SpecParam;
  changed: boolean;
  htmlFor: string;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      {paramLabel(param)}
      <ChangedDot show={changed} />
    </Label>
  );
}

function ParamField({
  param,
  value,
  onChange,
  schema,
  preview,
  revealSelectionError,
}: {
  param: SpecParam;
  value: unknown;
  onChange: (value: unknown) => void;
  schema: SchemaColumn[];
  preview?: DatasetPreview | null;
  revealSelectionError?: boolean;
}) {
  const changed = fieldChanged(param, value);
  const label = paramLabel(param);
  const fieldId = `spec-${param.name}`;

  if (param.type === 'column') {
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel param={param} changed={changed} htmlFor={fieldId} />
        <ColumnSelect
          id={fieldId}
          label=""
          value={asText(value)}
          onChange={onChange}
          schema={schema}
          names={namesForParam(schema, param, preview)}
          expectedType={slotOf(param)}
          allowEmpty={param.role !== 'required' || isWeightParam(param)}
          emptyLabel="None"
        />
      </div>
    );
  }

  const columnList =
    param.type === 'columns' &&
    ((param.columnTypes ?? []).some(type => type === 'numeric' || type === 'categorical') ||
      /column|predictor|independent|exog|covariate|indicator|feature|set_/.test(param.name));
  if (columnList) {
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel param={param} changed={changed} htmlFor={fieldId} />
        <MultiColumnPicker
          id={fieldId}
          selected={asColumns(value)}
          onChange={onChange}
          schema={schema.filter(column =>
            namesForParam(schema, param, preview).includes(column.name)
          )}
          filterSlot={slotOf(param)}
          minSelected={param.role === 'required' ? 1 : undefined}
          selectionNoun={/variable/i.test(paramLabel(param)) ? 'variable' : 'column'}
          revealSelectionError={revealSelectionError}
          showEmptyIncludesAll={param.role !== 'required'}
        />
      </div>
    );
  }

  if (param.type === 'columns') {
    const items = Array.isArray(value) ? value.map(item => String(item)) : [];
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel param={param} changed={changed} htmlFor={fieldId} />
        <Input
          id={fieldId}
          value={items.join(', ')}
          onChange={event =>
            onChange(
              event.target.value
                .split(',')
                .map(part => part.trim())
                .filter(Boolean)
            )
          }
          className="h-8 text-sm"
          placeholder={param.displayDefault || 'None'}
        />
      </div>
    );
  }

  if (param.type === 'boolean') {
    const id = `spec-${param.name}`;
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={value === true}
          onCheckedChange={checked => onChange(checked === true)}
        />
        <Label htmlFor={id} className="inline-flex items-center gap-1.5 text-sm font-normal">
          {label}
          <ChangedDot show={changed} />
        </Label>
      </div>
    );
  }

  if (param.type === 'enum') {
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel param={param} changed={changed} htmlFor={fieldId} />
        <Select value={asText(value)} onValueChange={onChange}>
          <SelectTrigger id={fieldId} className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[250]">
            {(param.enum ?? []).map(option => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (param.type === 'integer' || param.type === 'number') {
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel param={param} changed={changed} htmlFor={fieldId} />
        <Input
          id={fieldId}
          type="number"
          inputSize="sm"
          className="h-8 w-28"
          step={param.type === 'integer' ? 1 : 'any'}
          value={value == null || value === '' ? '' : String(value)}
          onChange={event => {
            const next = event.target.value;
            if (next === '') {
              onChange(param.default ?? '');
              return;
            }
            const parsed = param.type === 'integer' ? Number.parseInt(next, 10) : Number(next);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
        />
      </div>
    );
  }

  const jsonList =
    param.type === 'json' &&
    (Array.isArray(param.default) || Array.isArray(value)) &&
    (Array.isArray(value) ? value.every(item => typeof item === 'number') : true);
  if (jsonList) {
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel param={param} changed={changed} htmlFor={fieldId} />
        <Input
          id={fieldId}
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={event => {
            const parts = event.target.value
              .split(',')
              .map(part => part.trim())
              .filter(Boolean)
              .map(part => Number(part));
            onChange(parts.every(part => Number.isFinite(part)) ? parts : value);
          }}
          className="h-8 font-mono text-xs"
          placeholder="1, 0, 0"
        />
      </div>
    );
  }

  if (param.type === 'json') {
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel param={param} changed={changed} htmlFor={fieldId} />
        <textarea
          id={fieldId}
          className="min-h-16 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
          value={value == null || value === '' ? '' : JSON.stringify(value)}
          onChange={event => {
            const text = event.target.value.trim();
            if (!text) {
              onChange(null);
              return;
            }
            try {
              onChange(JSON.parse(text));
            } catch {
              onChange(value);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel param={param} changed={changed} htmlFor={fieldId} />
      <Input
        id={fieldId}
        value={asText(value)}
        onChange={event => onChange(event.target.value)}
        className="h-8 text-sm"
        placeholder="None"
      />
    </div>
  );
}

export function SpecDrivenSetup({
  spec,
  values,
  onChange,
  schema,
  preview,
  revealSelectionError,
}: Props) {
  const required = spec.params.filter(param => param.role === 'required' && !param.report);
  const defaults = spec.params.filter(param => param.role === 'default' && !param.report);
  const advanced = spec.params.filter(param => param.role === 'advanced' && !param.report);

  return (
    <div className="space-y-4">
      {required.length ? (
        <div className="space-y-3">
          <FormSectionLabel>Required</FormSectionLabel>
          {required.map(param => (
            <ParamField
              key={param.name}
              param={param}
              value={values[param.name]}
              onChange={value => onChange(param.name, value)}
              schema={schema}
              preview={preview}
              revealSelectionError={
                spec.key === 'descriptives' ? revealSelectionError : undefined
              }
            />
          ))}
        </div>
      ) : null}
      {defaults.length || advanced.length ? (
        <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">Defaults. </span>
          {defaultsLine(spec, values)}
        </p>
      ) : null}
      {defaults.length || advanced.length ? (
        <AdvancedOptionsDisclosure changed={advancedChanged(spec, values)}>
          {defaults.map(param => (
            <ParamField
              key={param.name}
              param={param}
              value={values[param.name]}
              onChange={value => onChange(param.name, value)}
              schema={schema}
              preview={preview}
            />
          ))}
          {advanced.map(param => (
            <ParamField
              key={param.name}
              param={param}
              value={values[param.name]}
              onChange={value => onChange(param.name, value)}
              schema={schema}
              preview={preview}
            />
          ))}
        </AdvancedOptionsDisclosure>
      ) : null}
    </div>
  );
}
