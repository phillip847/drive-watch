import { createContext, useContext, useMemo, useReducer } from 'react';
import { reducer } from './reducer.js';
import { createInitialState } from './initialState.js';
import { useLiveFeed } from './useLiveFeed.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  // Runs here rather than in a page so the feed keeps going when the officer navigates.
  useLiveFeed(state, dispatch);

  const actions = useMemo(() => {
    const now = () => Date.now();
    return {
      dispatch,
      addAudit: (action, user) => dispatch({ type: 'AUDIT', action, user, time: now() }),
      signIn: (userId) => dispatch({ type: 'SIGN_IN', userId, time: now() }),
      signOut: () => dispatch({ type: 'SIGN_OUT', time: now() }),
      setOnline: (online) => dispatch({ type: 'SET_ONLINE', online, time: now() }),
      setDisc: (disc) => dispatch({ type: 'SET_DISC', disc }),
      setUserStatus: (userId, status) => dispatch({ type: 'SET_USER_STATUS', userId, status, time: now() }),
      issueNotice: (notice) => dispatch({ type: 'ISSUE_NOTICE', notice, time: now() }),
      loadRoadUpdate: (update) => dispatch({ type: 'LOAD_ROAD_UPDATE', update }),
      dismissRoadUpdate: () => dispatch({ type: 'DISMISS_ROAD_UPDATE' }),
      applyRoadUpdate: () => dispatch({ type: 'APPLY_ROAD_UPDATE', time: now() }),
      setLimit: (seg, road, limit) => dispatch({ type: 'SET_LIMIT', seg, road, limit, time: now() }),
      addUser: (user) => dispatch({ type: 'ADD_USER', user, time: now() }),
      resetPin: (userId, pin) => dispatch({ type: 'RESET_PIN', userId, pin, time: now() }),
    };
  }, []);

  const value = useMemo(() => {
    const currentUser = state.users.find((u) => u.id === state.currentUserId) ?? null;
    return { state, currentUser, ...actions };
  }, [state, actions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
