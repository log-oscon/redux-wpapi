import { REDUX_WP_API_SUCCESS } from '../../src/constants/actions';
import collectionResponse from '../data/collection-response';

export default {
  type: REDUX_WP_API_SUCCESS,
  payload: {
    uid: '/namespace/any',
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
