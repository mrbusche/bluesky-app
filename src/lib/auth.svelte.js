import { AtpAgent } from '@atproto/api';
import { BLUESKY_SERVICE, SESSION_KEY } from './constants.js';

function createAuth() {
  let agent = $state(null);
  let session = $state(null);
  let isLoading = $state(true);
  let error = $state(null);

  async function init() {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const newAgent = new AtpAgent({ service: BLUESKY_SERVICE });
        const sessionData = JSON.parse(savedSession);
        await newAgent.resumeSession(sessionData);
        agent = newAgent;
        session = newAgent.session;
        console.log('Session resumed successfully.');
      } catch (e) {
        console.error('Failed to resume session:', e);
        localStorage.removeItem(SESSION_KEY);
        session = null;
        agent = null;
      }
    }
    isLoading = false;
  }

  async function login(identifier, password) {
    isLoading = true;
    error = null;
    try {
      const newAgent = new AtpAgent({ service: BLUESKY_SERVICE });
      const response = await newAgent.login({ identifier, password });

      if (response.success) {
        agent = newAgent;
        session = newAgent.session;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { success: true };
      } else {
        error = 'Login failed';
        return { success: false, error };
      }
    } catch (e) {
      console.error('Login error:', e);
      error = e.message || 'Login failed';
      return { success: false, error };
    } finally {
      isLoading = false;
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('blueskyLastViewedPostTimestamp');
    localStorage.removeItem('blueskyLastViewedPostUri');
    session = null;
    agent = null;
    // Optional: reload page to clear all state
    window.location.reload();
  }

  return {
    get agent() {
      return agent;
    },
    get session() {
      return session;
    },
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    init,
    login,
    logout,
  };
}

export const auth = createAuth();
