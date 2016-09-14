import { initialReducerState } from '../../src/ReduxWPAPI';

const initialStore = { wp: initialReducerState };
export const createFakeStore = (fakeData = initialStore) => ({ getState: () => fakeData });

// export const dispatchWithStoreOf = (storeData, action) =>
//   new Promise((resolve, reject) => {
//     x
//   });
