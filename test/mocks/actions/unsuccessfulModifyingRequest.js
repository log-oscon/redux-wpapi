import { REDUX_WP_API_FAILURE } from '../../../src/constants/actions';

export default {
  type: REDUX_WP_API_FAILURE,
  payload: { /* irrelant */ },
  error: new Error('Network Failure'),
  meta: {
    name: 'test',
    aggregator: 'any',
    // operation will be injected;
    requestAt: Date.now(),
    responseAt: Date.now(),
  },
};
