import { REDUX_WP_API_SUCCESS } from '../../../src/constants/actions';
import collectionResponse from '../data/collectionResponse';

export default {
  type: REDUX_WP_API_SUCCESS,
  payload: {
    cacheID: '/namespace/any',
    page: 1,
    response: collectionResponse,
  },
  meta: {
    name: 'test',
    aggregator: 'any',
    requestAt: Date.now(),
    responseAt: Date.now(),
    operation: 'get',
  },
};
