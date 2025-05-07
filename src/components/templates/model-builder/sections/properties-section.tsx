import { Card } from '@/components/atoms/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Input } from '@/components/atoms/input';
import { FC } from 'react';

// Define the type for statistics
interface VariableStatistics {
  mean?: number;
  sd?: number;
  n?: number;
  [key: string]: number | undefined;
}

// Define the type for available variables
interface AvailableVariable {
  name: string;
  statistics: VariableStatistics;
}

// Define the type for a model node
interface ModelNode {
  id: string;
  label: string;
  type: 'observed' | 'latent';
  x: number;
  y: number;
  variableName?: string;
  dataType?: string;
  missingHandling?: string;
  statistics?: Record<string, number>;
}

// Define the props for the PropertiesSection component
interface PropertiesSectionProps {
  selectedNode?: ModelNode | null;
  onNodeUpdate?: (node: ModelNode) => void;
  availableVariables?: AvailableVariable[];
  // These are the additional props that may be passed but are not used by this component
  modelFitIndices?: any;
  nodes?: any[];
  errorTerms?: any[];
  onUpdateErrorTerm?: (errorTerm: any) => void;
}

export const PropertiesSection: FC<PropertiesSectionProps> = ({
  selectedNode,
  onNodeUpdate = () => {},
  availableVariables = [],
}) => {
  if (!selectedNode) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Select a node to view its properties</div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Basic Properties Card */}
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Basic Properties</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Label</label>
            <Input
              value={selectedNode.label || ''}
              onChange={e => onNodeUpdate({ ...selectedNode, label: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <div className="text-sm text-muted-foreground">{selectedNode.type}</div>
          </div>
        </div>
      </Card>

      {/* Variable Properties Card - Only show for observed nodes */}
      {selectedNode.type === 'observed' && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Variable Properties</h3>
          <div className="space-y-3">
            {/* Variable Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Variable</label>
              <Select
                value={selectedNode.variableName || ''}
                onValueChange={value => {
                  const selectedVariable = availableVariables.find(v => v.name === value);
                  onNodeUpdate({
                    ...selectedNode,
                    variableName: value,
                    label: value,
                    statistics: selectedVariable?.statistics as Record<string, number> | undefined,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select variable..." />
                </SelectTrigger>
                <SelectContent>
                  {availableVariables.map(v => (
                    <SelectItem key={v.name} value={v.name}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Type Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Type</label>
              <Select
                value={selectedNode.dataType || ''}
                onValueChange={value => onNodeUpdate({ ...selectedNode, dataType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuous">Continuous</SelectItem>
                  <SelectItem value="ordinal">Ordinal</SelectItem>
                  <SelectItem value="nominal">Nominal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Additional Settings */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Missing Values</label>
              <Select
                value={selectedNode.missingHandling || 'listwise'}
                onValueChange={value => onNodeUpdate({ ...selectedNode, missingHandling: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="listwise">Listwise</SelectItem>
                  <SelectItem value="pairwise">Pairwise</SelectItem>
                  <SelectItem value="fiml">FIML</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Statistics Card */}
      {selectedNode.statistics && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Statistics</h3>
          <div className="space-y-1 text-sm">
            {Object.entries(selectedNode.statistics).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground capitalize">{key}:</span>
                <span>{typeof value === 'number' ? value.toFixed(3) : value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
