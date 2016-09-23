import isFunction from 'lodash/isFunction';
import { createSelector } from 'reselect';
import isString from 'lodash/isString';
import Immutable from 'immutable';

import { pending } from './constants/requestStatus';
import { mapDeep } from './helpers';
import { id as idSymbol } from './symbols';

const requestsByQuery = state => state.wp.getIn(['requestsByQuery']);
const localResources = state => state.wp.getIn(['resources']);

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


/**
 * Adds pagination when available
 */
function formatRequestRaw(request, cache) {
  if (!request) return { status: pending, data: false, error: false };

  let requestFormatted = request;
  const cacheID = request.get('cacheID');
  const page = request.get('page');

  if (cacheID) {
    requestFormatted = request
    .merge(cache.getIn([cacheID, page]))
    .merge(cache.getIn([cacheID, 'pagination']));
  }

  requestFormatted = requestFormatted.toJSON();

  if (!requestFormatted.data) {
    return { data: false, error: false, ...requestFormatted };
  }

  return requestFormatted;
}


/**
 * Creates a selector without denormalization to resolve to a Request
 *
 * Creates a selector to resolve to a Request based on requestData, which might be either its name
 * or a cacheID and page. It doesn't do any denormalization, so data contains local ids.
 *
 * @param   {String|Object} requestData If string, the name of the request, if Object, the cacheID
 *                                      and the page for that request.
 *
 * @returns {Function}                  Selector to pick from state the request.
 */
export const selectRequestRaw = (requestData) => {
  if (!requestData) {
    throw new Error(
      '\'requestData\' must either be the request name or a object with its cacheID and page'
    );
  }

  if (isString(requestData)) {
    return createSelector(
      state => state.wp.getIn(['requestsByName', requestData]),
      requestsByQuery,
      formatRequestRaw
    );
  }

  if (requestData.name) {
    return createSelector(
      state => state.wp.getIn(['requestsByName', requestData.name]).merge(requestData),
      requestsByQuery,
      formatRequestRaw
    );
  }

  if (!requestData.cacheID) {
    throw new Error(
      '\'cacheId\' or \'name\' must be provided for selectRequest'
    );
  }

  const request = new Immutable.Map({
    page: 1,
    data: false,
    ...requestData,
  });

  return (...args) => formatRequestRaw(request, requestsByQuery(...args));
};

/**
 * creates selector for a request
 *
 * Creates a selector by its name or by its cacheID and page.
 *
 * @param   {String|Object} queryID If string, the name of the request, if Object, the cacheID
 *                                  and the page for that request.
 * @returns {Function}              Selector which accepts the app state and returns the request
 */
export const selectRequest = (requestData) =>
  createSelector(
    selectRequestRaw(requestData),
    localResources,
    (requestRaw, resources) => {
      if (!requestRaw.data) {
        return requestRaw;
      }

      const memo = {};
      return {
        ...requestRaw,
        data: requestRaw.data.map(id => denormalize(resources, id, memo)),
      };
    }
  );


/**
 * @deprecated use selectRequest instead
 */
export const selectQuery = (name) => {
  // eslint-disable-next-line no-console
  console.warn('Deprecation warning: `selectQuery` was renamed to `selectRequest`');
  return selectRequest(name);
};

