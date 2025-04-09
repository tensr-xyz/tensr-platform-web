import { Actions, ChartType, ChartSeries } from './types';

export const setChartType = (payload: ChartType) => ({
  payload,
  type: Actions.SET_TYPE,
});

export const setXAxis = (payload: string) => ({
  payload,
  type: Actions.SET_X_AXIS,
});

export const setYAxis = (payload: string) => ({
  payload,
  type: Actions.SET_Y_AXIS,
});

export const addSeries = (payload: ChartSeries) => ({
  payload,
  type: Actions.ADD_SERIES,
});

export const removeSeries = (payload: string) => ({
  payload,
  type: Actions.REMOVE_SERIES,
});

export const updateSeries = (id: string, updates: Partial<ChartSeries>) => ({
  payload: { id, updates },
  type: Actions.UPDATE_SERIES,
});

export const setSuggestion = (payload: string | null) => ({
  payload,
  type: Actions.SET_SUGGESTION,
});
