import { REDUX_WP_API_REQUEST } from '../../../src/constants/actions';

export default {
  type: REDUX_WP_API_REQUEST,
  payload: {
    cacheID: '/namespace/any',
    page: 1,
  },
  meta: {
    name: 'test',
    url: 'http://wordpress.dev/wp-json/namespace/any',
    requestAt: Date.now(),
    operation: 'get',
  },
};
