import { describe, it } from 'mocha';
import expect from 'expect';
import WPAPIAdapter from '../src/adapters/wpapi';

describe('WPAPI Adapter', () => {
  it('should complain if no api is given', () => {
    expect(() => {
      // eslint-disable-next-line
      new WPAPIAdapter();
    }).toThrow();
  });
});

