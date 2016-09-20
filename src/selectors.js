import isFunction from 'lodash/isFunction';
import { createSelector } from 'reselect';
import isString from 'lodash/isString';
import constant from 'lodash/constant';
import Immutable from 'immutable';

import { pending } from './constants/requestStatus';
import { mapDeep } from './helpers';
import { id as idSymbol } from './symbols';

export const denormalize = (resources, id, memoized = {}) => {
  /* eslint-disable no-param-reassign, no-underscore-dangle */
  if (memoized[id]) return memoized[id];

  const resource = resources.get(id);
  if (!resource) {
    return null;
  }

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

export const withDenormalize = thunk =>
  createSelector(
    localResources,
    thunk,
    (resources, target) => {
      if (!isFunction(target)) {
        return target;
      }

      const memo = {};
      return target(id => denormalize(resources, id, memo));
    }
  );

export const selectRequest = (requestData) => {
  let requestIDSelector;
  if (isString(requestData)) {
    requestIDSelector = state => state.wp.getIn(['requestsByName', requestData]);
  } else if (requestData.name) {
    requestIDSelector = state =>
      state.wp.getIn(['requestsByName', requestData.name]).merge(requestData);
  } else {
    if (!requestData.cacheID) {
      throw new Error(
        '\'cacheId\' or \'name\' must be provided for selectRequest'
      );
    }

    requestIDSelector = constant(new Immutable.Map({
      page: 1,
      ...requestData,
    }));
  }

  return createSelector(
    createSelector(
      requestIDSelector,
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
};

export const selectQuery = (name) => {
  // eslint-disable-next-line no-console
  console.warn('Deprecation warning: `selectQuery` was renamed to `selectRequest`');
  return selectRequest(name);
};

