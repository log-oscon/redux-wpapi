/* eslint-disable import/no-extraneous-dependencies, no-underscore-dangle  */
import { describe, it } from 'mocha';
import expect from 'expect';
import WPAPI from 'wpapi';
import Immutable from 'immutable';

import { REDUX_WP_API_SUCCESS, REDUX_WP_API_REQUEST } from '../src/constants/actions';
import ReduxWPAPI from '../src/index.js';
import { WAITING, READY } from '../src/constants/requestStatus';

const requestGET = {
  type: REDUX_WP_API_REQUEST,
  payload: {
    uid: '/namespace/any',
    page: 1,
  },
  meta: {
    name: 'test',
    aggregator: 'any',
    requestAt: Date.now(),
    operation: 'get',
  },
};

const requestMOD = {
  type: REDUX_WP_API_REQUEST,
  payload: { /* irrelant */ },
  meta: {
    name: 'test',
    requestAt: Date.now(),
    // type must be injected;
    aggregator: 'any',
    params: { /* irrelant to this point */ },
  },
};

const collectionResponse1 = [
  {
    id: 2,
    dumbAttr: 'dumb1',
    _links: {
      self: [{ href: 'http://dumb.url/wp-json/namespace/any/2' }],
      collection: [{ href: 'http://dumb.url/wp-json/namespace/any' }],
      parent: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/namespace/any/1',
      }],
      author: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/wp/v2/users/1',
      }],
    },
    _embedded: {
      author: [{
        id: 1,
        name: 'admin',
        link: 'http://km.nos.dev/author/admin/',
        slug: 'admin',
        _links: {
          self: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users/1' }],
          collection: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users' }],
        },
      }],
      parent: [{
        id: 1,
        dumbAttr: 'dumb2',
        _links: {
          self: [{ href: 'http://dumb.url/wp-json/namespace/any/1' }],
          collection: [{ href: 'http://dumb.url/wp-json/namespace/any' }],
          parent: [{
            embeddable: true,
            href: 'http://dumb.url/wp-json/namespace/any/1',
          }],
          author: [{
            embeddable: true,
            href: 'http://dumb.url/wp-json/wp/v2/users/2',
          }],
        },
      }],
    },
  },
  {
    id: 1,
    dumbAttr: 'dumb2',
    _links: {
      self: [{ href: 'http://dumb.url/wp-json/namespace/any/1' }],
      collection: [{ href: 'http://dumb.url/wp-json/namespace/any' }],
      parent: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/namespace/any/1',
      }],
      author: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/wp/v2/users/2',
      }],
    },
    _embedded: {
      author: [{
        id: 2,
        name: 'edygar',
        link: 'http://km.nos.dev/author/edygar/',
        slug: 'edygar',
        _links: {
          self: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users/2' }],
          collection: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users' }],
        },
      }],
    },
  },
];

collectionResponse1._paging = {
  total: 2,
  totalPages: 1,
};

const collectionResponse2 = [
  {
    id: 1,
    dumbAttr: 'dumb2 - modified',
    _links: {
      self: [{ href: 'http://dumb.url/wp-json/namespace/any/1' }],
      collection: [{ href: 'http://dumb.url/wp-json/namespace/any' }],
      parent: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/namespace/any/1',
      }],
      author: [{
        embeddable: true,
        href: 'http://dumb.url/wp-json/wp/v2/users/2',
      }],
    },
    _embedded: {
      author: [{
        id: 2,
        name: 'edygar',
        link: 'http://km.nos.dev/author/edygar/',
        slug: 'edygar',
        _links: {
          self: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users/2' }],
          collection: [{ href: 'http://km.nos.dev/wp-json/wp/v2/users' }],
        },
      }],
    },
  },
];

collectionResponse2._paging = {
  total: 1,
  totalPages: 2,
};


const successfulGET = {
  type: REDUX_WP_API_SUCCESS,
  payload: {
    uid: '/namespace/any',
    page: 1,
    response: collectionResponse1,
  },
  meta: {
    name: 'test',
    aggregator: 'any',
    requestAt: Date.now(),
    responseAt: Date.now(),
    operation: 'get',
  },
};

const successfulGET2 = {
  type: REDUX_WP_API_SUCCESS,
  payload: {
    uid: '/namespace/any?posts_per_page=1',
    page: 1,
    response: collectionResponse2,
  },
  meta: {
    name: 'test',
    aggregator: 'any',
    requestAt: Date.now(),
    responseAt: Date.now(),
    operation: 'get',
  },
};

describe('Reducer', () => {
  const { reducer } = new ReduxWPAPI({
    api: new WPAPI({ endpoint: 'http://dumb.url/wp-json/' }),
    customCacheIndexes: {
      any: 'dumbAttr',
    },
  });

  it('should have the right Immutable instances for its initial state', () => {
    const initialState = reducer(undefined, {});
    expect(initialState).toBeA(Immutable.Map);
    expect(initialState.get('entities')).toBeA(Immutable.List);
    expect(initialState.get('entitiesIndexes')).toBeA(Immutable.Map);
    expect(initialState.get('requestsByQuery')).toBeA(Immutable.Map);
    expect(initialState.get('requestsByName')).toBeA(Immutable.Map);
  });

  it('shouldnt change state for irrelant actions', () => {
    const initialState = reducer(undefined, {});
    expect(reducer(initialState, { type: 'NO-OP ACTION' }))
    .toBe(initialState);
  });

  describe('`REDUX_WP_API_REQUEST` action', () => {
    describe('operation GET', () => {
      it('should keep request related data by query\'s uid', () => {
        const state = reducer(undefined, requestGET);
        const queryState = state.getIn(['requestsByQuery', requestGET.payload.uid]);
        expect(queryState).toBeAn(Immutable.Map);
        expect(queryState.get('pagination')).toNotBeAn(Immutable.Map);
        expect(queryState.get(requestGET.payload.page)).toBeAn(Immutable.Map);
        expect(queryState.get(requestGET.payload.page).toJSON())
        .toEqual({
          status: WAITING,
          operation: requestGET.meta.operation,
          requestAt: requestGET.meta.requestAt,
        });

        expect(queryState.getIn([requestGET.payload.page, 'data']))
        .toBe(undefined, 'shouldnt touch data');
      });

      it('should keep by request name the enought data to reach query', () => {
        const state = reducer(undefined, requestGET);
        const nameState = state.getIn(['requestsByName', requestGET.meta.name]);

        expect(nameState.get('page')).toBe(requestGET.payload.page);
        expect(nameState.get('uid')).toBe(requestGET.payload.uid);
      });

      it('should keep previous data under query', () => {
        const firstState = reducer(undefined, requestGET);
        const secondState = reducer(firstState, successfulGET);
        const thirdState = reducer(secondState, {
          ...requestGET,
          meta: {
            ...requestGET.meta,
            // request renewed
            requestAt: Date.now(),
          },
        });

        expect(thirdState.getIn(['requestsByQuery', requestGET.payload.uid, 'data']))
        .toBe(secondState.getIn(['requestsByQuery', requestGET.payload.uid, 'data']));
      });
    });

    ['create', 'update', 'delete']
    .forEach(type =>
      describe(`operation ${type.toUpperCase()}`, () => {
        const request = { ...requestMOD, meta: { ...requestMOD.meta, type } };
        it('should keep request related data by request name', () => {
          const state = reducer(undefined, request);
          const nameState = state.getIn(['requestsByName', request.meta.name]);
          expect(nameState).toBeAn(Immutable.Map);
          expect(nameState.toJSON())
          .toEqual({
            status: WAITING,
            operation: request.meta.operation,
            requestAt: request.meta.requestAt,
            data: false,
          });
        });
      })
    );
  });

  describe('`REDUX_WP_API_SUCCESS` action', () => {
    it('should keep request related data by query\'s uid for GET operations', () => {
      const state = reducer(undefined, successfulGET);
      const queryState = state.getIn(['requestsByQuery', successfulGET.payload.uid]);

      expect(queryState).toBeAn(Immutable.Map);
      expect(queryState.get('pagination'))
      .toNotBeAn(Immutable.Map)
      .toEqual({
        total: 2,
        totalPages: 1,
      });
      expect(queryState.get(successfulGET.payload.page)).toBeAn(Immutable.Map);

      const data = queryState.getIn([successfulGET.payload.page, 'data']);
      expect(queryState.get(successfulGET.payload.page).toJSON())
      .toInclude({
        status: READY,
        error: false,
        responseAt: successfulGET.meta.responseAt,
      });

      expect(data).toBeAn(Array);
      expect(data.length).toBe(2);
    });

    it('should keep local ids instead objects in data, by query\'s uid', () => {
      const state = reducer(undefined, successfulGET);
      const queryState = state.getIn(['requestsByQuery', successfulGET.payload.uid]);
      const data = queryState.getIn([successfulGET.payload.page, 'data']);

      expect(data).toBeAn(Array);
      expect(data.length).toBe(2);
      expect(state.getIn(['entities', data[0]]).link)
      .toBe(successfulGET.payload.response[0].link);

      expect(state.getIn(['entities', data[1]]).link)
      .toBe(successfulGET.payload.response[1].link);
    });

    it('should persist locally each found entity exactly once', () => {
      const state = reducer(undefined, successfulGET);
      const entities = state.get('entities');
      expect(entities.size).toBe(4);
      expect(entities.toJSON().map(item => item.link))
      .toInclude(successfulGET.payload.response[0]._embedded.author[0].link)
      .toInclude(successfulGET.payload.response[1].link)
      .toInclude(successfulGET.payload.response[1]._embedded.author[0].link)
      .toInclude(successfulGET.payload.response[0].link);
    });

    it('should update previous entity\'s state', () => {
      const previous = reducer(undefined, successfulGET);
      const state = reducer(previous, successfulGET2);
      const queryState = state.getIn(['requestsByQuery', successfulGET2.payload.uid]);
      const [id] = queryState.getIn([1, 'data']);
      const entity = state.getIn(['entities', id]);
      expect(entity).toContain({
        link: successfulGET2.payload.response[0].link,
      });
    });
  });
});

