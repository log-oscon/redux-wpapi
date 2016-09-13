/* eslint-disable no-underscore-dangle */
// WP REST API has many underscore dangle's, no point to fight against it
import defaultsDeep from 'lodash/defaultsDeep';
import nthArg from 'lodash/nthArg';
import mapKeys from 'lodash/mapKeys';
import forEach from 'lodash/forEach';
import find from 'lodash/find';
import Immutable from 'immutable';
import isArray from 'lodash/isArray';
import isUndefined from 'lodash/isUndefined';
import { selectQuery } from './selectors';
import WPAPIAdapter from './adapters/wpapi';

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

const initialReducerState = Immutable.fromJS({
  requestsByName: {},
  requestsByQuery: {},

  resources: [],
  resourcesIndexes: {},
});

export default class ReduxWPAPI {
  static displayName = '[REDUX-WP-API]';

  static defaultSettings = {
    transformResource: nthArg(0),
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
      aggregator: this.adapter.getAggregator(this.adapter.getUrl(request)),
      operation: this.adapter.getOperation(request),
      params: action.payload.params,
      requestAt: Date.now(),
    };

    const payload = {};
    if (meta.operation === 'get') {
      let cache;
      let lastCacheUpdate;
      let data;
      const state = store.getState().wp;
      const indexes = this.adapter.getIndexes(request);
      const localID = this.getResourceLocalID(state, meta.aggregator, indexes);

      payload.cacheID = this.adapter.generateCacheID(request);
      payload.page = parseInt(this.adapter.getRequestedPage(request) || 1, 10);

      if (localID) {
        cache = state.getIn(['resources', localID]);
        data = [localID];
      }

      if (cache) {
        lastCacheUpdate = cache.lastCacheUpdate;
      } else {
        cache = state.getIn(['requestsByQuery', payload.cacheID, payload.page]);
        data = state.get('data');
      }

      if (cache && (localID || (isUndefined(localID) && !cache.get('error')))) {
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

        let ttl;
        if (this.adapter.getTTL) {
          ttl = this.adapter.getTTL(request);
        }

        if (ttl !== 0 && !ttl) {
          ttl = this.settings.ttl;
        }

        if (Date.now() - lastCacheUpdate < ttl) {
          return Promise.resolve(
            store.getState().wp.getIn(['requestsByName', meta.name])
          );
        }
      }
    }

    next({
      type: REDUX_WP_API_REQUEST,
      payload,
      meta,
    });

    return this.adapter.sendRequest(request)
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
    .then(() => selectQuery(meta.name)(store.getState()));
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
        const { payload, meta: { name, aggregator, requestAt, responseAt } } = action;
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
        const aditionalData = { lastCacheUpdate: requestState.responseAt };

        body.forEach(resource => {
          newState = this.indexResource(newState, aggregator, resource, aditionalData);
          data.push(this.getResourceLocalID(newState, aggregator, resource));
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
          state.getIn(['resourcesIndexes', aggregator, indexer, resource[indexer]])
        )
    );

    return indexBy && state.getIn(['resourcesIndexes', aggregator, indexBy, resource[indexBy]]);
  }

  indexResource(state, aggregator, resource, meta) {
    let newState = state;
    let _embedded;
    const curies = (resource._links || {}).curies;
    const _links = this.resolveAliases(resource._links, curies) || {};
    delete _links.curies;

    let localID = this.getResourceLocalID(state, aggregator, resource);
    let oldState = {};
    if (!isUndefined(localID)) {
      oldState = newState.getIn(['resources', localID]);
    }

    if (resource._embedded) {
      _embedded = { ...(oldState || { })._embedded };
      const alisedEmbedded = this.resolveAliases(resource._embedded, curies);
      forEach(alisedEmbedded, (embeddable, relName) => {
        forEach(_links[relName], (link, index) => {
          const embeddedAggregator = this.adapter.getAggregator(link.href);
          if (!embeddedAggregator) return;

          let toEmbed = alisedEmbedded[relName][index];
          toEmbed = (isArray(toEmbed) ? toEmbed : [toEmbed]).reduce((collection, toBeEmbedded) => {
            if (toBeEmbedded.code === 'rest_no_route') return collection;

            newState = this.indexResource(newState, embeddedAggregator, toBeEmbedded, meta);
            collection.push(this.getResourceLocalID(newState, embeddedAggregator, toBeEmbedded));

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

    if (isUndefined(localID)) {
      localID = newState.get('resources').size;
    }

    let resourceTransformed = {
      ...oldState,
      ...resource,
      _links,
      _embedded,
      lastCacheUpdate: meta.lastCacheUpdate,
    };

    if (this.adapter.transformResource) {
      resourceTransformed = this.adapter.transformResource(resourceTransformed);
    }

    if (this.settings.transformResource) {
      resourceTransformed = this.settings.transformResource(resourceTransformed);
    }

    newState = newState.setIn(['resources', localID], resourceTransformed);
    const indexers = this.settings.customCacheIndexes[aggregator];

    forEach(isArray(indexers) ? ['id'].concat(indexers) : ['id', indexers], indexer => {
      if (!isUndefined(resource[indexer])) {
        newState = newState.setIn(
          ['resourcesIndexes', aggregator, indexer, resource[indexer]],
          localID
        );
      }
    });

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
