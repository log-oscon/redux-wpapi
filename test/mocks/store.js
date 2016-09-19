import { initialReducerState } from '../../src/ReduxWPAPI';

export const initialStore = { wp: initialReducerState };
export const createFakeStore = (fakeData = initialStore) => ({
  state: fakeData,
  getState() { return this.state; },
});
