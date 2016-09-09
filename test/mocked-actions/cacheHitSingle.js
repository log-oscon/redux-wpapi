import { REDUX_WP_API_CACHE_HIT } from '../../src/constants/actions';

export default {
  type: REDUX_WP_API_CACHE_HIT,
  payload: {
    cacheID: '/namespace/any?slug=dumb2',
    page: 1,
    lastCacheUpdate: Date.now(),
    data: [3],
  },
  meta: {
    name: 'test',
    aggregator: 'any',
    operation: 'get',
    requestAt: Date.now(),
  },
};
