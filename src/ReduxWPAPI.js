/* eslint-disable no-underscore-dangle */
// WP REST API has many underscore dangle's, no point to fight against it
import defaultsDeep from 'lodash/defaultsDeep';
import nthArg from 'lodash/nthArg';
import mapKeys from 'lodash/mapKeys';
import forEach from 'lodash/forEach';
import find from 'lodash/find';
import noop from 'lodash/noop';
import Immutable from 'immutable';
import isArray from 'lodash/isArray';
import isUndefined from 'lodash/isUndefined';
import { selectRequest } from './selectors';
import WPAPIAdapter from './adapters/wpapi';
import {
  lastCacheUpdate as lastCacheUpdateSymbol,
  partial as partialSymbol,
} from './symbols';

import {
  REDUX_WP_API_CALL,
  REDUX_WP_API_REQUEST,
  REDUX_WP_API_SUCCESS,
  REDUX_WP_API_FAILURE,
  REDUX_WP_API_CACHE_HIT,
} from './constants/actions';

import {
  pending,
  resolved,
  rejected,
} from './constants/requestStatus';

export const initialReducerState = Immutable.fromJS({
  requestsByName: {},
  requestsByQuery: {},

  resources: [],
  resourcesIndexes: {},
});

export default class ReduxWPAPI {
  static displayName = '[REDUX-WP-API]';

  static defaultSettings = {
    transformResource: nthArg(0),

    /**
     * Get aggregator for URL
     *
     * Infers the aggregator identifier of a given URL to which all resulting resources are going to
     * be associated with. An aggregator is a set containing resources indexed by its ids and by the
     * its custom indexers.
     *
     * @param  {String}      url          URL from which the aggregator will be infered
     * @return {String|null} aggregatorID String to which the resource will be associated
     *                                    with or null, if resources musn't be indexed
     */
    getAggregator: nthArg(2),
    timeout: 30000,
    ttl: 60000,
  }

  constructor({ adapter, ...settings }) {
    this.settings = defaultsDeep({}, settings, ReduxWPAPI.defaultSettings);

    if (!adapter) {
      this.adapter = new WPAPIAdapter(this.settings);
    } else {
      this.adapter = adapter;
    }

    this.settings.customCacheIndexes = {
       // reinforces demandatory indexes besides id
      ...(this.adapter.customCacheIndexes || {}),
      ...this.settings.customCacheIndexes,
    };
  }

  middleware = store => next => action => {
    if (!action || action.type !== REDUX_WP_API_CALL) return next(action);

    const request = this.adapter.buildRequest(action.payload);
    const meta = {
      name: action.payload.name,
      url: this.adapter.getUrl(request),
      operation: this.adapter.getOperation(request),
      requestAt: Date.now(),
    };

    const payload = {};
    if (meta.operation === 'get') {
      let cache;
      let lastCacheUpdate;
      let data;
      let ttl;
      if (this.adapter.getTTL) {
        ttl = this.adapter.getTTL(request);
      }

      if (ttl !== 0 && !ttl) {
        ttl = this.settings.ttl;
      }

      const state = store.getState().wp;
      const indexes = this.adapter.getIndexes(request);
      const aggregator = this.settings.getAggregator(
        meta.url,
        indexes,
        this.adapter.getAggregator(meta.url)
      );
      const resourceLocalID = this.getResourceLocalID(state, aggregator, indexes);

      payload.cacheID = this.adapter.generateCacheID(request);
      payload.page = parseInt(this.adapter.getRequestedPage(request) || 1, 10);

      if (resourceLocalID !== false) {
        cache = state.getIn(['resources', resourceLocalID]);
        data = [resourceLocalID];
      }

      if (cache) {
        lastCacheUpdate = cache[lastCacheUpdateSymbol];
        if (cache[partialSymbol]) {
          ttl = 0;
        }
      } else {
        cache = state.getIn(['requestsByQuery', payload.cacheID, payload.page]);
        data = state.get('data');

        if (cache && cache.get('error')) {
          cache = false;
        }
      }

      if (cache) {
        lastCacheUpdate = lastCacheUpdate || cache.get('responseAt') || cache.get('requestAt');
        next({
          meta,
          type: REDUX_WP_API_CACHE_HIT,
          payload: {
            cacheID: payload.cacheID,
            page: payload.page,
            lastCacheUpdate,
            data,
          },
        });

        if (Date.now() - lastCacheUpdate < ttl) {
          return Promise.resolve(
            selectRequest({
              cacheID: payload.cacheID,
              page: payload.page,
            })(store.getState())
          );
        }
      }
    }

    next({
      type: REDUX_WP_API_REQUEST,
      payload,
      meta,
    });

    return (
      this.adapter.sendRequest(request)
      .then(
        response =>
          next({
            type: REDUX_WP_API_SUCCESS,
            payload: { ...payload, response },
            meta: { ...meta, responseAt: Date.now() },
          }),
        error =>
          next({
            type: REDUX_WP_API_FAILURE,
            payload,
            error,
            meta: { ...meta, responseAt: Date.now() },
          })
      )
      .then(() => {
        if (meta.operation === 'get') {
          return selectRequest({
            cacheID: payload.cacheID,
            page: payload.page,
          })(store.getState());
        }

        return selectRequest(meta.name)(store.getState());
      })
    );
  }

  reducer = (state = initialReducerState, action) => {
    switch (action.type) {
      case REDUX_WP_API_CACHE_HIT: {
        const { data, page, cacheID } = action.payload;
        let newState = state.mergeIn(
          ['requestsByName', action.meta.name],
          { page, cacheID }
        );

        if (!newState.getIn(['requestsByQuery', cacheID, page])) {
          newState = (
            newState
            .mergeIn(['requestsByQuery', cacheID, page], {
              status: resolved,
              operation: action.meta.operation,
              error: false,
              requestAt: action.payload.lastCacheUpdate,
              responseAt: action.payload.lastCacheUpdate,
            })
            .setIn(['requestsByQuery', cacheID, 1, 'data'], data)
          );
        }


        return newState;
      }

      case REDUX_WP_API_REQUEST: {
        const { name, operation, requestAt } = action.meta;

        const requestState = {
          status: pending,
          requestAt,
          operation,
        };

        if (operation === 'get') {
          const { page, cacheID } = action.payload;
          let pagination = state.getIn(['requestsByQuery', cacheID, 'pagination']);
          pagination = pagination || {};

          return (
            state
            .mergeIn(['requestsByName', name], { page, cacheID })
            .setIn(['requestsByQuery', cacheID, 'pagination'], pagination)
            .mergeIn(['requestsByQuery', cacheID, page], requestState)
          );
        }

        return (
          state
          .mergeIn(['requestsByName', name], requestState)
          .setIn(['requestsByName', name, 'data'], false)
        );
      }
      case REDUX_WP_API_SUCCESS: {
        let newState = state;
        const { payload, meta: { name, url, requestAt, responseAt } } = action;
        const { cacheID, page, response } = payload;
        let body = response;

        const requestState = {
          responseAt,
          status: resolved,
          error: false,
        };

        if (!isArray(body)) {
          body = [body];
        }

        const data = [];
        const additionalData = {
          [lastCacheUpdateSymbol]: requestState.responseAt,
          [partialSymbol]: false,
        };

        body.forEach(resource => {
          newState = this.indexResource(newState, url, resource, additionalData, id => {
            data.push(id);
          });
        });

        if (action.meta.operation === 'get') {
          const pagination = this.adapter.getPagination(response);
          newState = newState.mergeIn(['requestsByQuery', cacheID, page], requestState);
          newState = newState.setIn(['requestsByQuery', cacheID, page, 'data'], data);
          newState = newState.setIn(['requestsByQuery', cacheID, 'pagination'], pagination);
        } else if (newState.getIn(['requestsByName', name, 'requestAt']) === requestAt) {
          newState = (
            newState
            .setIn(['requestsByName', action.meta.name, 'data'], data)
            .mergeIn(['requestsByName', name], requestState)
          );
        }

        return newState;
      }
      case REDUX_WP_API_FAILURE: {
        const { error } = action;
        const { page, cacheID } = action.payload;
        const requestState = {
          status: rejected,
          error: {
            message: error.message,
            status: error.status,
          },
        };

        if (action.meta.operation === 'get') {
          return state.mergeIn(['requestsByQuery', cacheID, page], requestState);
        }

        return state.mergeIn(['requestsByName', action.meta.name], requestState);
      }
      default: return state;
    }
  }

  getResourceLocalID(state, aggregator, resource) {
    const indexers = this.settings.customCacheIndexes[aggregator];
    const indexBy = find(
      isArray(indexers) ? ['id'].concat(indexers) : ['id', indexers],
      indexer =>
        !isUndefined(resource[indexer]) &&
        !isUndefined(
          state.getIn(['resourcesIndexes', aggregator, indexer, resource[indexer].toString()])
        )
    );

    if (isUndefined(indexBy)) {
      return false;
    }

    return state.getIn(['resourcesIndexes', aggregator, indexBy, resource[indexBy].toString()]);
  }

  indexResource(state, url, resource, meta, onIndex = noop) {
    let newState = state;
    let _embedded;
    const aggregator = this.settings.getAggregator(
      url,
      resource,
      this.adapter.getAggregator(url, resource)
    );
    const curies = (resource._links || {}).curies;
    const _links = this.resolveAliases(resource._links, curies) || {};
    delete _links.curies;

    let resourceLocalID = this.getResourceLocalID(state, aggregator, resource);
    const emptyState = {};
    let oldState = emptyState;
    if (resourceLocalID !== false) {
      oldState = newState.getIn(['resources', resourceLocalID]);
    }

    if (resource._embedded) {
      _embedded = { ...(oldState || { })._embedded };
      const alisedEmbedded = this.resolveAliases(resource._embedded, curies);
      const embeddedMeta = { ...meta, [partialSymbol]: true };
      forEach(alisedEmbedded, (embeddable, relName) => {
        forEach(_links[relName], (link, index) => {
          let toEmbed = alisedEmbedded[relName][index];
          toEmbed = (isArray(toEmbed) ? toEmbed : [toEmbed]).reduce((collection, toBeEmbedded) => {
            if (toBeEmbedded.code === 'rest_no_route') return collection;

            newState = this.indexResource(
              newState,
              link.href,
              toBeEmbedded,
              embeddedMeta,
              id => collection.push(id)
            );

            return collection;
          }, []);

          if (!isArray(alisedEmbedded[relName][index])) {
            if (!toEmbed.length) {
              return;
            }

            toEmbed = toEmbed[0];
          }

          _embedded[this.adapter.embedLinkAs({ name: relName, ...link })] = toEmbed;
        });
      });
    }

    if (resourceLocalID === false) {
      resourceLocalID = newState.get('resources').size;
    }

    let isPartial = meta[partialSymbol] || false;
    if (oldState !== emptyState && oldState[partialSymbol] && !meta[partialSymbol]) {
      isPartial = false;
    }

    let resourceTransformed = {
      ...oldState,
      ...resource,
      ...meta,
      _links,
      _embedded,
      [partialSymbol]: isPartial,
    };

    if (this.adapter.transformResource) {
      resourceTransformed = this.adapter.transformResource(resourceTransformed);
    }

    if (this.settings.transformResource) {
      resourceTransformed = this.settings.transformResource(resourceTransformed);
    }

    newState = newState.setIn(['resources', resourceLocalID], resourceTransformed);
    const indexers = this.settings.customCacheIndexes[aggregator];

    forEach(isArray(indexers) ? ['id'].concat(indexers) : ['id', indexers], indexer => {
      if (!isUndefined(resource[indexer])) {
        newState = newState.setIn(
          ['resourcesIndexes', aggregator, indexer, resource[indexer].toString()],
          resourceLocalID
        );
      }
    });

    onIndex(resourceLocalID);
    return newState;
  }

  resolveAliases(map, curies) {
    return (curies || []).reduce((remapped, cury) => {
      const alias = new RegExp(`^${cury.name}:`);
      return mapKeys(remapped, (value, key) =>
        cury.href.replace(/\{rel\}/g, key.replace(alias, ''))
      );
    }, map) || map;
  }
}
