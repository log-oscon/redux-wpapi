import { describe, it } from 'mocha';
import expect from 'expect';
import noop from 'lodash/noop';
import Immutable from 'immutable';

import ReduxWPAPI from '../src/index.js';
import createFakeAdapter from './mocks/createFakeAdapter';

import collectionRequest from './mocks/actions/collectionRequest';
import successfulCollectionRequest from './mocks/actions/successfulCollectionRequest';
import successfulAuthorRequest from './mocks/actions/successfulAuthorRequest';
import unsuccessfulCollectionRequest from './mocks/actions/unsuccessfulCollectionRequest';
import successfulQueryBySlug from './mocks/actions/successfulQueryBySlug';
import { createFakeStore } from './mocks/store';
import { initialReducerState } from '../src/ReduxWPAPI';
import { resolved, pending, rejected } from '../src/constants/requestStatus';
import * as Symbols from '../src/symbols';

import {
  REDUX_WP_API_CALL,
  REDUX_WP_API_CACHE_HIT,
  REDUX_WP_API_REQUEST,
  REDUX_WP_API_SUCCESS,
} from '../src/constants/actions';

const createCallAPIActionFrom = ({
  meta: { name },
  payload: { cacheID, page },
  response,
}) => ({
  type: REDUX_WP_API_CALL,
  payload: {
    name,
    request: { cacheID, page },
    additionalParams: !Array.isArray(response) ? response : {},
  },
});


const pendingState = initialReducerState.set('resources', new Immutable.List([]))
.set('resourcesIndexes', Immutable.fromJS({ any: { slug: {}, id: {} }, users: { id: {} } }))
.mergeIn(
  ['requestsByName', successfulQueryBySlug.meta.name],
  {
    cacheID: successfulQueryBySlug.payload.cacheID,
    page: successfulQueryBySlug.payload.page,
  }
)
.mergeIn(
  ['requestsByQuery', successfulQueryBySlug.payload.cacheID, successfulQueryBySlug.payload.page],
  {
    status: pending,
    error: false,
    data: false,
    requestAt: new Date(),
  }
);

const successfulQueryBySlugState = initialReducerState.set(
  'resources',
  new Immutable.List([
    {
      ...successfulQueryBySlug.payload.response[0]._embedded.author[0],
      [Symbols.lastCacheUpdate]: Date.now(),
      [Symbols.partial]: true,
    },
    {
      ...successfulQueryBySlug.payload.response[0],
      [Symbols.partial]: false,
      [Symbols.lastCacheUpdate]: Date.now(),
      _embedded: { author: 0 },
    },
  ])
)
.set(
  'resourcesIndexes',
  Immutable.fromJS({
    any: {
      slug: { 'dumb1-modified': 1 },
      id: { 1: 1 },
    },
    users: {
      id: { 2: 0 },
    },
  })
)
.mergeIn(
  ['requestsByName', successfulQueryBySlug.meta.name],
  {
    cacheID: successfulQueryBySlug.payload.cacheID,
    page: successfulQueryBySlug.payload.page,
  }
)
.mergeIn(
  ['requestsByQuery', successfulQueryBySlug.payload.cacheID, successfulQueryBySlug.payload.page],
  {
    status: resolved,
    error: false,
    data: [0],
  }
);

describe('Middleware', () => {
  it('should implement middleware signature (store => next => action =>)', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulCollectionRequest),
    });
    const fakeEmptyStore = createFakeStore();
    const fakeNext = noop;

    expect(middleware(fakeEmptyStore)(fakeNext)).toBeA('function');
  });


  it('should propagate other actions and next dispatch/middleware return for NO-OP actions', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulCollectionRequest),
    });

    const dispatched = [];
    const nextMiddlewareReturn = Symbol();
    const fakeNext = dispatch => dispatched.push(dispatch) && nextMiddlewareReturn;
    const action = { type: 'NO-OP ACTION' };

    const result = middleware(createFakeStore())(fakeNext)(action);
    expect(result).toBe(nextMiddlewareReturn);

    expect(dispatched.length).toBe(1);
    expect(dispatched[0]).toBe(action);
  });

  it('should dispatch REQUEST and SUCCESSFUL action when request is not cached', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulCollectionRequest),
    });

    const dispatched = [];
    const fakeNext = dispatch => dispatched.push(dispatch);

    const action = createCallAPIActionFrom(successfulCollectionRequest);
    const result = middleware(createFakeStore())(fakeNext)(action);
    expect(result).toBeA(Promise);

    return result.then(() => {
      expect(dispatched.length).toBe(2);
      expect(dispatched[0]).toEqual({
        ...collectionRequest,
        meta: {
          ...collectionRequest.meta,
          requestAt: dispatched[0].meta.requestAt,
        },
      });
      expect(dispatched[1]).toEqual({
        ...successfulCollectionRequest,
        meta: {
          ...successfulCollectionRequest.meta,
          requestAt: dispatched[1].meta.requestAt,
          responseAt: dispatched[1].meta.responseAt,
        },
      });
    });
  });

  it('should reuse promises for two identical subsequential pending request', () => {
    let done;
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulQueryBySlug),
      sendRequest() {
        const promise = new Promise(resolve => {
          done = () => resolve(successfulQueryBySlug.payload.response);
        });
        return promise;
      },
    });

    const dispatched = [];
    const fakeNext = dispatch => dispatched.push(dispatch);

    const action = createCallAPIActionFrom(successfulQueryBySlug);
    const requestA = middleware(createFakeStore())(fakeNext)(action);
    const requestB = middleware(createFakeStore({ wp: pendingState }))(fakeNext)(action);

    expect(requestA).toBeA(Promise);
    expect(requestB).toBe(requestA);
    setTimeout(() => done());

    return requestB.then(() => {
      expect(dispatched.length).toBe(3);
    });
  });

  it('should dispatch only CACHE_HIT action when request is cached within TTL', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulQueryBySlug, {
        getTTL() { return Infinity; },
        getIndexes() { return { slug: 'dumb1-modified' }; },
      }),
      customCacheIndexes: {
        any: 'slug',
      },
    });

    const dispatched = [];
    const fakeNext = dispatch => dispatched.push(dispatch);
    const action = createCallAPIActionFrom(successfulQueryBySlug);

    // CACHED STATE
    const fakeStore = createFakeStore({ wp: successfulQueryBySlugState });
    const result = middleware(fakeStore)(fakeNext)(action);
    expect(result).toBeA(Promise);

    return result.then(() => {
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].type).toBe(REDUX_WP_API_CACHE_HIT);
    });
  });

  it('should dispatch CACHE_HIT action and REQUEST again when cache is invalidated by ttl', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulQueryBySlug, {
        getTTL() { return 0; },
        getIndexes() { return { slug: 'dumb1-modified' }; },
      }),
      customCacheIndexes: {
        any: 'slug',
      },
    });

    const dispatched = [];
    const fakeNext = dispatch => dispatched.push(dispatch);
    const action = createCallAPIActionFrom(successfulQueryBySlug);

    // CACHED STATE
    const fakeStore = createFakeStore({ wp: successfulQueryBySlugState });
    const result = middleware(fakeStore)(fakeNext)(action);
    expect(result).toBeA(Promise);

    return result.then(() => {
      expect(dispatched.length).toBe(3);
      expect(dispatched[0].type).toBe(REDUX_WP_API_CACHE_HIT);
      expect(dispatched[1].type).toBe(REDUX_WP_API_REQUEST);
      expect(dispatched[2].type).toBe(REDUX_WP_API_SUCCESS);
    });
  });

  it('should dispatch CACHE_HIT action and REQUEST again when cache is partial', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulAuthorRequest, {
        getTTL() { return Infinity; },
        getIndexes() { return { id: 2 }; },
      }),
    });

    const dispatched = [];
    const fakeNext = dispatch => dispatched.push(dispatch);
    const action = createCallAPIActionFrom(successfulAuthorRequest);

    // CACHED STATE
    const fakeStore = createFakeStore({ wp: successfulQueryBySlugState });
    const result = middleware(fakeStore)(fakeNext)(action);
    expect(result).toBeA(Promise);

    return result.then(() => {
      // expect(dispatched.length).toBe(3);
      expect(dispatched[0].type).toBe(REDUX_WP_API_CACHE_HIT);
      expect(dispatched[1].type).toBe(REDUX_WP_API_REQUEST);
      expect(dispatched[2].type).toBe(REDUX_WP_API_SUCCESS);
    });
  });


  it('should dispatch REQUEST and FAILURE action when request is not cached and fails', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(unsuccessfulCollectionRequest, {
        sendRequest: () => Promise.reject(unsuccessfulCollectionRequest.error),
      }),
    });

    const dispatched = [];
    const fakeNext = dispatch => dispatched.push(dispatch);
    const action = createCallAPIActionFrom(unsuccessfulCollectionRequest);

    const result = middleware(createFakeStore())(fakeNext)(action);
    expect(result).toBeA(Promise);

    return result.then(() => {
      expect(dispatched.length).toBe(2);
      expect(dispatched[0]).toEqual({
        ...collectionRequest,
        payload: {
          ...collectionRequest.payload,
          cacheID: unsuccessfulCollectionRequest.payload.cacheID,
        },
        meta: {
          ...collectionRequest.meta,
          requestAt: dispatched[0].meta.requestAt,
        },
      });
      expect(dispatched[1]).toEqual({
        ...unsuccessfulCollectionRequest,
        meta: {
          ...unsuccessfulCollectionRequest.meta,
          requestAt: dispatched[1].meta.requestAt,
          responseAt: dispatched[1].meta.responseAt,
        },
      });
    });
  });

  it('should return a promise that resolves to selectRequest result', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulQueryBySlug),
    });

    const dispatched = [];
    const store = createFakeStore();
    const fakeNext = dispatch => {
      dispatched.push(dispatch);
      store.state = { wp: successfulQueryBySlugState };
    };
    const action = createCallAPIActionFrom(successfulQueryBySlug);
    const result = middleware(store)(fakeNext)(action);
    expect(result).toBeA(Promise);

    return result.then(response => {
      expect(response)
      .toInclude({
        status: resolved,
        error: false,
      });
      expect(response.data).toBeA('array');
      expect(response.data.length).toBe(1);
      expect(response.data[0]).toBeAn('object');
    });
  });

  it('should return a promise that rejects to selectRequest result', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(unsuccessfulCollectionRequest, {
        sendRequest: () => Promise.reject(unsuccessfulCollectionRequest.error),
      }),
    });

    const dispatched = [];
    const store = createFakeStore();
    const { name } = unsuccessfulCollectionRequest.meta;
    const { page, cacheID } = unsuccessfulCollectionRequest.payload;
    const fakeNext = dispatch => {
      dispatched.push(dispatch);
      store.state = {
        wp: initialReducerState.mergeIn(
          ['requestsByQuery', cacheID, page],
          {
            status: rejected,
            data: false,
            error: unsuccessfulCollectionRequest.error,
          }
        )
        .mergeIn(
          ['requestsByName', name],
          { cacheID, page }
        ),
      };
    };
    const action = createCallAPIActionFrom(successfulCollectionRequest);
    const result = middleware(store)(fakeNext)(action);
    expect(result).toBeA(Promise);

    return result.then(response => {
      expect(response)
      .toInclude({
        status: rejected,
        data: false,
        error: unsuccessfulCollectionRequest.error,
      });
    });
  });
});
