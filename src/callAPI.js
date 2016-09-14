import { REDUX_WP_API_CALL } from './constants/actions';

export default (name, request, aditionalParams = {}) => ({
  type: REDUX_WP_API_CALL,
  payload: { name, request, aditionalParams },
});
