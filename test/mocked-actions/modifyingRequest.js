import { REDUX_WP_API_REQUEST } from '../../src/constants/actions';

export default {
  type: REDUX_WP_API_REQUEST,
  payload: { /* irrelant */ },
  meta: {
    name: 'test',
    requestAt: Date.now(),
    // operation will be injected;
    aggregator: 'any',
    params: { /* irrelant to this point */ },
  },
};

