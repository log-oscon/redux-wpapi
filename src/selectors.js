import { createSelector } from 'reselect';
import { pending } from './constants/requestStatus';
import { mapDeep } from './helpers';
import { id as idSymbol } from './constants/symbols';

export const denormalize = (resources, id, memoized = {}) => {
  /* eslint-disable no-param-reassign, no-underscore-dangle */
  if (memoized[id]) return memoized[id];

  const resource = resources.get(id);
  memoized[id] = {
    [idSymbol]: id,
    ...resource,
    ...mapDeep(resource._embedded || {},
      embeddedId => denormalize(resources, embeddedId, memoized)
    ),
  };

  return memoized[id];
};

export const localResources = state => state.wp.getIn(['resources']);

export const selectQuery = name => createSelector(
  createSelector(
    state => state.wp.getIn(['requestsByName', name]),
    state => state.wp.getIn(['requestsByQuery']),
    (currentRequest, cache) => {
      if (!currentRequest) return false;

      const cacheID = currentRequest.get('cacheID');
      const page = currentRequest.get('page');

      if (cacheID) {
        return currentRequest
        .merge(cache.getIn([cacheID, page]))
        .merge(cache.getIn([cacheID, 'pagination']));
      }

      return currentRequest;
    }
  ),
  localResources,
  (request, resources) => {
    if (!request) {
      return {
        status: pending,
        error: false,
        data: false,
      };
    }

    if (!request.get('data')) {
      return {
        data: false,
        error: false,
        ...request.toJSON(),
      };
    }

    const memo = {};
    let data = request.get('data');
    if (data.toJSON) {
      data = data.toJSON();
    }

    return request.set(
      'data', data.map(id => denormalize(resources, id, memo))
    ).toJSON();
  }
);
