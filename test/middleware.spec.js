import { describe, it } from 'mocha';
import expect from 'expect';
import noop from 'lodash/noop';
import Immutable from 'immutable';

import ReduxWPAPI from '../src/index.js';
import createFakeAdapter from './mocks/createFakeAdapter';

import collectionRequest from './mocks/actions/collectionRequest';
import successfulCollectionRequest from './mocks/actions/successfulCollectionRequest';
import unsuccessfulCollectionRequest from './mocks/actions/unsuccessfulCollectionRequest';
import successfullQueryBySlug from './mocks/actions/successfullQueryBySlug';
import { createFakeStore } from './mocks/store';
import { initialReducerState } from '../src/ReduxWPAPI';
import { REDUX_WP_API_CALL, REDUX_WP_API_CACHE_HIT } from '../src/constants/actions';
import { resolved, rejected } from '../src/constants/requestStatus';
import { lastCacheUpdate as lastCacheUpdateSymbol } from '../src/constants/symbols';

const createCallAPIActionFrom = ({
  meta: { name },
  payload: { cacheID, page },
  response,
}) => ({
  type: REDUX_WP_API_CALL,
  payload: {
    name,
    request: { cacheID, page },
    aditionalParams: !Array.isArray(response) ? response : {},
  },
});

const successfullQueryBySlugState = initialReducerState.set(
  'resources',
  new Immutable.List([
    {
      ...successfullQueryBySlug.payload.response[0]._embedded.author[0],
      [lastCacheUpdateSymbol]: Date.now() },
    {
      ...successfullQueryBySlug.payload.response[0],
      [lastCacheUpdateSymbol]: Date.now(),
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
  })
)
.mergeIn(
  ['requestsByName', successfullQueryBySlug.meta.name],
  {
    cacheID: successfullQueryBySlug.payload.cacheID,
    page: successfullQueryBySlug.payload.page,
  }
)
.mergeIn(
  ['requestsByQuery', successfullQueryBySlug.payload.cacheID, successfullQueryBySlug.payload.page],
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

  it('should dispatch only CACHE_HIT action when request is cached within TTL', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfullQueryBySlug, {
        getTTL() { return Infinity; },
        getIndexes() { return { slug: 'dumb1-modified' }; },
      }),
      customCacheIndexes: {
        any: 'slug',
      },
    });

    const dispatched = [];
    const nextMiddlewareReturn = Symbol();
    const fakeNext = dispatch => dispatched.push(dispatch) && nextMiddlewareReturn;
    const action = createCallAPIActionFrom(successfullQueryBySlug);

    // CACHED STATE
    const fakeStore = createFakeStore({ wp: successfullQueryBySlugState });
    const result = middleware(fakeStore)(fakeNext)(action);
    expect(result).toBeA(Promise);

    return result.then(() => {
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].type).toBe(REDUX_WP_API_CACHE_HIT);
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

  it('should return a promise that resolves to selectQuery result', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter(successfulCollectionRequest),
    });

    const dispatched = [];
    const store = createFakeStore();
    const fakeNext = dispatch => {
      dispatched.push(dispatch);
      store.state = { wp: successfullQueryBySlugState };
    };
    const action = createCallAPIActionFrom(successfulCollectionRequest);
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

  it('should return a promise that reject to selectQuery result', () => {
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

