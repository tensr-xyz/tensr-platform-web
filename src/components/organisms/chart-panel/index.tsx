import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Card } from '@/components/atoms/card';
import {
  Plus,
  X,
  Lightbulb,
  TrendingUp as ChartLine,
  BarChart3 as ChartBar,
  ScatterChart as ChartScatter,
  AreaChart as ChartArea,
} from 'lucide-react';
import { useChartState } from '@/contexts/chart-context';
import { ChartType } from '@/contexts/chart-context/types';
import {
  addSeries,
  removeSeries,
  setChartType,
  setSuggestion,
  setXAxis,
  setYAxis,
} from '@/contexts/chart-context/actions';

interface Column {
  id: string;
  type: string;
}

interface ChartPanelProps {
  columns?: Column[];
}

const ChartPanel = ({ columns = [] }: ChartPanelProps) => {
  const { state, dispatch } = useChartState();

  const chartTypes = [
    { id: ChartType.LINE, icon: ChartLine, label: 'Line' },
    { id: ChartType.BAR, icon: ChartBar, label: 'Bar' },
    { id: ChartType.SCATTER, icon: ChartScatter, label: 'Scatter' },
    { id: ChartType.AREA, icon: ChartArea, label: 'Area' },
  ];

  const suggestions = [
    {
      id: 'time-series',
      title: 'Time Series',
      description: 'Visualize data over time',
      recommended: true,
    },
    {
      id: 'distribution',
      title: 'Distribution',
      description: 'Analyze value distribution',
      recommended: false,
    },
  ];

  const numericColumns = columns.filter(col =>
    col?.type ? ['number', 'integer', 'float'].includes(col.type.toLowerCase()) : false
  );

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Suggestions</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {suggestions.map(suggestion => (
                  <Card
                    key={suggestion.id}
                    className="p-4 cursor-pointer"
                    onClick={() => dispatch(setSuggestion(suggestion.id))}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          {suggestion.title}
                          {suggestion.recommended && (
                            <Badge variant="secondary" className="text-xs">
                              Recommended
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {suggestion.description}
                        </p>
                      </div>
                      <Lightbulb className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-1">
            <AccordionTrigger>Chart Type</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2">
                {chartTypes.map(({ id, icon: Icon, label }) => (
                  <Button
                    key={id}
                    variant={state.type === id ? 'secondary' : 'outline'}
                    className="w-full justify-start gap-2"
                    onClick={() => dispatch(setChartType(id))}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-1">
            <AccordionTrigger>Axes</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">X Axis</label>
                  <Select
                    value={state.xAxis || ''}
                    onValueChange={value => dispatch(setXAxis(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select X axis" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Y Axis</label>
                  <Select
                    value={state.yAxis || ''}
                    onValueChange={value => dispatch(setYAxis(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Y axis" />
                    </SelectTrigger>
                    <SelectContent>
                      {numericColumns.map(col => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-1">
            <AccordionTrigger>Series</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {state.series.map(series => (
                  <div key={series.id} className="flex items-center justify-between">
                    <span>{series.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dispatch(removeSeries(series.id))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() =>
                    dispatch(
                      addSeries({
                        id: crypto.randomUUID(),
                        name: 'New Series',
                        dataKey: '',
                        color: 'blue',
                      })
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Series
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
    </div>
  );
};

export default ChartPanel;
