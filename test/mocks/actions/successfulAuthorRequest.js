import { REDUX_WP_API_SUCCESS } from '../../../src/constants/actions';
import authorResponse from '../data/authorResponse';

export default {
  type: REDUX_WP_API_SUCCESS,
  payload: {
    cacheID: '/wp/v2/users/',
    page: 1,
    response: authorResponse,
  },
  meta: {
    name: 'test',
    url: 'http://wordpress.dev/wp-json/wp/v2/users',
    requestAt: Date.now(),
    responseAt: Date.now(),
    operation: 'get',
  },
};
