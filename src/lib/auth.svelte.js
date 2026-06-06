import { AtpAgent } from '@atproto/api';

import { BLUESKY_SERVICE, SESSION_KEY } from './constants.js';

class AuthState {
  agent = $state(null);
  session = $state(null);
  isLoading = $state(true);
  error = $state(null);

  async init() {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const newAgent = new AtpAgent({ service: BLUESKY_SERVICE });
        await newAgent.resumeSession(JSON.parse(savedSession));
        this.agent = newAgent;
        this.session = newAgent.session;
      } catch (e) {
        console.error('Failed to resume session:', e);
        localStorage.removeItem(SESSION_KEY);
        this.session = null;
        this.agent = null;
      }
    }
    this.isLoading = false;
  }

  async login(identifier, password) {
    this.isLoading = true;
    this.error = null;
    try {
      const newAgent = new AtpAgent({ service: BLUESKY_SERVICE });
      const response = await newAgent.login({ identifier, password });

      if (response.success) {
        this.agent = newAgent;
        this.session = newAgent.session;
        localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
        return { success: true };
      }
      this.error = 'Login failed';
      return { success: false, error: this.error };
    } catch (e) {
      console.error('Login error:', e);
      this.error = e.message || 'Login failed';
      return { success: false, error: this.error };
    } finally {
      this.isLoading = false;
    }
  }

  logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('blueskyLastViewedPostTimestamp');
    localStorage.removeItem('blueskyLastViewedPostUri');
    this.session = null;
    this.agent = null;
    // Optional: reload page to clear all state
    window.location.reload();
  }
}

export const auth = new AuthState();
