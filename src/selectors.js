import { createSelector } from 'reselect';
import { pending } from './constants/requestStatus';
import { mapDeep } from './helpers';

export const denormalize = (entities, id, memoized = {}) => {
  /* eslint-disable no-param-reassign, no-underscore-dangle */
  if (memoized[id]) return memoized[id];

  const entity = entities.get(id);
  memoized[id] = {
    ...entity,
    ...mapDeep(entity._embedded || {},
      embeddedId => denormalize(entities, embeddedId, memoized)
    ),
  };

  return memoized[id];
};

export const localEntities = state => state.wp.getIn(['entities']);

export const selectQuery = name => createSelector(
  createSelector(
    state => state.wp.getIn(['requestsByName', name]),
    state => state.wp.getIn(['requestsByQuery']),
    (currentRequest, cache) => {
      if (!currentRequest) return false;

      const uid = currentRequest.get('uid');
      const page = currentRequest.get('page');

      if (uid) {
        return currentRequest
        .merge(cache.getIn([uid, page]))
        .merge(cache.getIn([uid, 'pagination']));
      }

      return currentRequest;
    }
  ),
  localEntities,
  (request, entities) => {
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
      'data',
      request.get('operation') === 'get' ?
        data.map(id => denormalize(entities, id, memo)) :
        data
    ).toJSON();
  }
);
