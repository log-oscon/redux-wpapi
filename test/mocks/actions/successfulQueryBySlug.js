import { REDUX_WP_API_SUCCESS } from '../../../src/constants/actions';
import queryBySlugResponse from '../data/queryBySlugResponse';

export default {
  type: REDUX_WP_API_SUCCESS,
  payload: {
    cacheID: '/namespace/any?slug=dumb1-modified',
    page: 1,
    response: queryBySlugResponse,
  },
  meta: {
    name: 'test',
    url: 'http://wordpress.dev/wp-json/namespace/any',
    requestAt: Date.now(),
    responseAt: Date.now(),
    operation: 'get',
  },
};
