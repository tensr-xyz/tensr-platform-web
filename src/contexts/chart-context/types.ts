import React from 'react';

export interface ProviderProps {
  children: React.ReactNode;
}

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  SCATTER = 'scatter',
  AREA = 'area',
}

export enum Actions {
  SET_TYPE = 'SET_TYPE',
  SET_X_AXIS = 'SET_X_AXIS',
  SET_Y_AXIS = 'SET_Y_AXIS',
  ADD_SERIES = 'ADD_SERIES',
  REMOVE_SERIES = 'REMOVE_SERIES',
  UPDATE_SERIES = 'UPDATE_SERIES',
  SET_SUGGESTION = 'SET_SUGGESTION',
}

export interface ActionProps {
  payload: any;
  type: Actions;
}

export interface ChartSeries {
  id: string;
  name: string;
  dataKey: string;
  color: string;
}

export interface StateProps {
  type: ChartType;
  xAxis: string | null;
  yAxis: string | null;
  series: ChartSeries[];
  activeSuggestion: string | null;
}

export interface ChartContextProps {
  state: StateProps;
  dispatch: (action: ActionProps) => void;
}
