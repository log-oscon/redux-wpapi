import { REDUX_WP_API_SUCCESS } from '../../../src/constants/actions';
import collectionResponse from '../data/collectionResponse';

export default {
  type: REDUX_WP_API_SUCCESS,
  payload: {
    cacheID: '/namespace/search',
    page: 1,
    response: collectionResponse,
  },
  meta: {
    name: 'test',
    url: 'http://wordpress.dev/wp-json/namespace/search',
    requestAt: Date.now(),
    responseAt: Date.now(),
    operation: 'get',
  },
};
