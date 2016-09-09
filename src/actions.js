import { REDUX_WP_API_CALL } from './constants/actions';

export * as types from './constants/actions';

export const callAPI = (name, request, aditionalParams = {}) => ({
  type: REDUX_WP_API_CALL,
  payload: { name, request, aditionalParams },
});
