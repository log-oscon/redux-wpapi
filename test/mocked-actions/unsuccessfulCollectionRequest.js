import { REDUX_WP_API_FAILURE } from '../../src/constants/actions';

export default {
  type: REDUX_WP_API_FAILURE,
  payload: {
    uid: '/namespace/any?slug=dumb2',
    page: 1,
  },
  error: new Error('Network Failure'),
  meta: {
    name: 'test',
    aggregator: 'any',
    requestAt: Date.now(),
    responseAt: Date.now(),
    operation: 'get',
  },
};
