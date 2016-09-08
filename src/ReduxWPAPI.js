/* eslint-disable no-underscore-dangle */
// WP REST API has many underscore dangle's, no point to fight against it
import defaultsDeep from 'lodash/defaultsDeep';
import nthArg from 'lodash/nthArg';
import mapKeys from 'lodash/mapKeys';
import forEach from 'lodash/forEach';
import findKey from 'lodash/findKey';
import reduce from 'lodash/reduce';
import find from 'lodash/find';
import capitalize from 'lodash/capitalize';
import Immutable from 'immutable';
import isArray from 'lodash/isArray';
import isUndefined from 'lodash/isUndefined';
import namedGroupRegex from './namedGroupRegexp';
import { selectQuery } from './selectors';

import {
  REDUX_WP_API_CALL,
  REDUX_WP_API_REQUEST,
  REDUX_WP_API_SUCCESS,
  REDUX_WP_API_FAILURE,
  REDUX_WP_API_CACHE_HIT,
  REDUX_WP_API_PROVIDE,
} from './constants/actions';

import {
  pending,
  resolved,
  rejected,
} from './constants/requestStatus';

const initialReducerState = Immutable.fromJS({
  requestsByName: {},
  requestsByQuery: {},

  entities: [],
  entitiesIndexes: {},
});

export default class ReduxWPAPI {
  static displayName = '[REDUX-WP-API]';

  static defaultSettings = {
    beforeIndexing: nthArg(0),
    timeout: 30000,
    ttl: 60000
  }

  indexers = {}

  constructor(settings) {
    this.settings = defaultsDeep({}, settings, ReduxWPAPI.defaultSettings);

    if (!this.settings.api) {
      throw new Error(`${ReduxWPAPI.displayName}: 'api client must be provided`);
    }

    this.settings.customCacheIndexes = {
      ...ReduxWPAPI.defaultSettings, // reinforces demandatory indexes besides id
      ...this.settings.customCacheIndexes,
    };
  }

  middleware = store => next => action => {
    if (!action) return next(action);

    switch (action.type) {
      case REDUX_WP_API_CALL: break;
      case REDUX_WP_API_PROVIDE: return action.payload.accesser(this.settings);
      default: return next(action);
    }

    const request = action.payload.requestBuilder(this.settings.api);
    const meta = {
      name: action.payload.name,
      aggregator: this.settings.getAggregator(this.settings.getUrl(request), this.settings),
      operation: action.payload.operation,
      params: action.payload.params,
      requestAt: Date.now(),
    };

    const payload = {};
    if (meta.operation === 'get') {
      let cache;
      let lastCacheUpdate;
      let data;
      const state = store.getState().wp;
      const indexes = this.settings.getIndexes(request, this.settings);
      const localID = this.getEntityLocalID(state, meta.aggregator, indexes);
      payload.uid = this.settings.getRequestUID(request, this.settings);
      payload.page = parseInt(this.settings.getRequestedPage(request, this.settings) || 1, 10);

      if (localID) {
        cache = state.getIn(['entities', localID]);
        data = [localID];
      }

      if (cache) {
        lastCacheUpdate = cache.lastCacheUpdate;
      } else {
        cache = state.getIn(['requestsByQuery', payload.uid, payload.page]);
        data = state.get('data');
      }

      if (cache && (localID || (isUndefined(localID) && !cache.get('error')))) {
        lastCacheUpdate = lastCacheUpdate || cache.get('responseAt') || cache.get('requestAt');
        next({
          meta,
          type: REDUX_WP_API_CACHE_HIT,
          payload: {
            uid: payload.uid,
            page: payload.page,
            lastCacheUpdate,
            data,
          },
        });

        const ttl = this.settings.ttl;
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

    return this.settings.fetch(request, meta.operation, meta.params).then(
      response =>
        next({
          type: REDUX_WP_API_SUCCESS,
          payload: { ...payload, response },
          meta: { ...meta, responseAt: Date.now() },
        })
    ).catch(
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
        const { data, page, uid } = action.payload;
        let newState = state.mergeIn(
          ['requestsByName', action.meta.name],
          { page, uid }
        );

        if (!newState.getIn(['requestsByQuery', uid, page])) {
          newState = (
            newState
            .mergeIn(['requestsByQuery', uid, page], {
              status: resolved,
              operation: action.meta.operation,
              error: false,
              requestAt: action.payload.lastCacheUpdate,
              responseAt: action.payload.lastCacheUpdate,
            })
            .setIn(['requestsByQuery', uid, 1, 'data'], data)
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
          const { page, uid } = action.payload;
          let pagination = state.getIn(['requestsByQuery', uid, 'pagination']);
          pagination = pagination || {};

          return (
            state
            .mergeIn(['requestsByName', name], { page, uid })
            .setIn(['requestsByQuery', uid, 'pagination'], pagination)
            .mergeIn(['requestsByQuery', uid, page], requestState)
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
        const { uid, page, response } = payload;
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

        body.forEach(entity => {
          newState = this.indexEntity(newState, aggregator, entity, aditionalData);
          data.push(this.getEntityLocalID(newState, aggregator, entity));
        });

        if (action.meta.operation === 'get') {
          const pagination = this.settings.getPagination(response, this.settings);
          newState = newState.mergeIn(['requestsByQuery', uid, page], requestState);
          newState = newState.setIn(['requestsByQuery', uid, page, 'data'], data);
          newState = newState.setIn(['requestsByQuery', uid, 'pagination'], pagination);
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
        const { page, uid } = action.payload;
        const requestState = {
          status: rejected,
          error: {
            message: error.message,
            status: error.status,
          },
        };

        if (action.meta.operation === 'get') {
          return state.mergeIn(['requestsByQuery', uid, page], requestState);
        }

        return state.mergeIn(['requestsByName', action.meta.name], requestState);
      }
      default: return state;
    }
  }

  getEntityLocalID(state, aggregator, entity) {
    const indexers = this.settings.customCacheIndexes[aggregator];
    const indexBy = find(
      isArray(indexers) ? ['id'].concat(indexers) : ['id', indexers],
      indexer =>
        !isUndefined(entity[indexer]) &&
        !isUndefined(
          state.getIn(['entitiesIndexes', aggregator, indexer, entity[indexer]])
        )
    );

    return indexBy && state.getIn(['entitiesIndexes', aggregator, indexBy, entity[indexBy]]);
  }

  indexEntity(state, aggregator, entity, meta) {
    let newState = state;
    let _embedded;
    const curies = (entity._links || {}).curies;
    const _links = this.resolveAliases(entity._links, curies) || {};
    delete _links.curies;

    let localID = this.getEntityLocalID(state, aggregator, entity);
    let oldState = {};
    if (!isUndefined(localID)) {
      oldState = newState.getIn(['entities', localID]);
    }

    if (entity._embedded) {
      _embedded = { ...(oldState || { })._embedded };
      const alisedEmbedded = this.resolveAliases(entity._embedded, curies);
      forEach(alisedEmbedded, (embeddable, relName) => {
        forEach(_links[relName], (link, index) => {
          const embeddedAggregator = this.settings.getAggregator(link.href, this.settings);
          if (!embeddedAggregator) return;

          let toEmbed = alisedEmbedded[relName][index];
          toEmbed = (isArray(toEmbed) ? toEmbed : [toEmbed]).reduce((collection, toBeEmbedded) => {
            if (toBeEmbedded.code === 'rest_no_route') return collection;

            newState = this.indexEntity(newState, embeddedAggregator, toBeEmbedded, meta);
            collection.push(this.getEntityLocalID(newState, embeddedAggregator, toBeEmbedded));

            return collection;
          }, []);

          if (!isArray(alisedEmbedded[relName][index])) {
            if (!toEmbed.length) {
              return;
            }

            toEmbed = toEmbed[0];
          }

          _embedded[this.settings.embedLinkAs({ name: relName, ...link })] = toEmbed;
        });
      });
    }

    if (isUndefined(localID)) {
      localID = newState.get('entities').size;
    }

    newState = newState.setIn(
      ['entities', localID],
      this.settings.beforeIndexing({
        ...oldState,
        ...entity,
        _links,
        _embedded,
        lastCacheUpdate: meta.lastCacheUpdate,
      }, this.settings)
    );

    const indexers = this.settings.customCacheIndexes[aggregator];
    forEach(isArray(indexers) ? ['id'].concat(indexers) : ['id', indexers], indexer => {
      if (!isUndefined(entity[indexer])) {
        newState = newState.setIn(
          ['entitiesIndexes', aggregator, indexer, entity[indexer]],
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
