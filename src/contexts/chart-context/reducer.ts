import { ActionProps, Actions, StateProps } from './types';

export default function reducer(state: StateProps, action: ActionProps): StateProps {
  switch (action.type) {
    case Actions.SET_TYPE: {
      return {
        ...state,
        type: action.payload,
      };
    }
    case Actions.SET_X_AXIS: {
      return {
        ...state,
        xAxis: action.payload,
      };
    }
    case Actions.SET_Y_AXIS: {
      return {
        ...state,
        yAxis: action.payload,
      };
    }
    case Actions.ADD_SERIES: {
      return {
        ...state,
        series: [...state.series, action.payload],
      };
    }
    case Actions.REMOVE_SERIES: {
      return {
        ...state,
        series: state.series.filter(s => s.id !== action.payload),
      };
    }
    case Actions.UPDATE_SERIES: {
      return {
        ...state,
        series: state.series.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } : s
        ),
      };
    }
    case Actions.SET_SUGGESTION: {
      return {
        ...state,
        activeSuggestion: action.payload,
      };
    }
    case Actions.SET_COLOR_AXIS: {
      return {
        ...state,
        colorAxis: action.payload,
      };
    }
    case Actions.SET_SIZE_AXIS: {
      return {
        ...state,
        sizeAxis: action.payload,
      };
    }
    default: {
      throw new Error('Unhandled action type');
    }
  }
}
