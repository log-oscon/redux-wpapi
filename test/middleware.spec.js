import { describe, it } from 'mocha';
import expect from 'expect';
import ReduxWPAPI from '../src/index.js';
import createFakeAdapter from './mocks/createFakeAdapter';
import noop from 'lodash/noop';
import Immutable from 'immutable';

import collectionRequest from './mocks/actions/collectionRequest';
import successfulCollectionRequest from './mocks/actions/successfulCollectionRequest';
import unsuccessfulCollectionRequest from './mocks/actions/unsuccessfulCollectionRequest';
import successfullQueryBySlug from './mocks/actions/successfullQueryBySlug';
import { createFakeStore } from './mocks/store';
import { initialReducerState } from '../src/ReduxWPAPI';

import { REDUX_WP_API_CALL, REDUX_WP_API_CACHE_HIT } from '../src/constants/actions';

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

    const any = successfullQueryBySlug.payload.response[0];
    const author = any._embedded.author[0];

    // CACHED STATE
    const fakeStore = createFakeStore({
      wp: initialReducerState.set(
        'resources',
        new Immutable.List([
          { ...author, lastCacheUpdate: Date.now() },
          {
            ...any,
            lastCacheUpdate: Date.now(),
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
      ),
    });

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
});

