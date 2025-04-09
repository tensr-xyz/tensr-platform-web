import { ActionProps, Actions, StateProps } from './types';

export default function reducer(state: StateProps, action: ActionProps): StateProps {
  switch (action.type) {
    case Actions.SET_USER:
      return {
        ...state,
        user: action.payload,
      };
    case Actions.SET_TOKENS:
      return {
        ...state,
        tokens: action.payload,
      };
    case Actions.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    case Actions.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };
    case Actions.LOGOUT:
      return {
        user: null,
        tokens: null,
        isLoading: false,
        error: null,
      };
    default:
      throw new Error('Unhandled action type');
  }
}
