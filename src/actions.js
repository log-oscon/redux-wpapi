import { REDUX_WP_API_PROVIDE, REDUX_WP_API_CALL } from './constants/actions';

export * as types from './constants/actions';

export const wp = (name, requestBuilder, operation = 'get', params) => ({
  type: REDUX_WP_API_CALL,
  payload: { name, requestBuilder, operation, params },
});

export const wpInject = (accesser) => ({
  type: REDUX_WP_API_PROVIDE,
  payload: { accesser },
});
