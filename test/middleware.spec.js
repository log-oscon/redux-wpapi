import { describe, it } from 'mocha';
import expect from 'expect';
import ReduxWPAPI from '../src/index.js';
import createFakeAdapter from './mocks/createFakeAdapter';

describe('Middleware', () => {
  it('should return a function', () => {
    const { middleware } = new ReduxWPAPI({
      adapter: createFakeAdapter({}),
    });

    expect(middleware({})).toBeA('function');
  });
});

