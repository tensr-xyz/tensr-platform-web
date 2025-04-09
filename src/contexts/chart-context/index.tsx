import { createContext, useContext, useReducer } from 'react';
import { ChartContextProps, ProviderProps, ChartType } from './types';
import reducer from './reducer';

const ChartContext = createContext<ChartContextProps | undefined>(undefined);

function ChartProvider({ children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    type: ChartType.LINE,
    xAxis: null,
    yAxis: null,
    series: [],
    activeSuggestion: null,
  });

  const value = { state, dispatch };
  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

function useChartState() {
  const context = useContext(ChartContext);
  if (context === undefined) {
    throw new Error('useChartState must be used within a ChartProvider');
  }
  return context;
}

export { ChartProvider, useChartState };
