import { REDUX_WP_API_SUCCESS } from '../../src/constants/actions';
import queryBySlugResponse from '../data/queryBySlugResponse';

export default {
  type: REDUX_WP_API_SUCCESS,
  payload: {
    uid: '/namespace/any?slug=dumb2',
    page: 1,
    response: queryBySlugResponse,
  },
  meta: {
    name: 'test',
    aggregator: 'any',
    requestAt: Date.now(),
    responseAt: Date.now(),
    operation: 'get',
  },
};
