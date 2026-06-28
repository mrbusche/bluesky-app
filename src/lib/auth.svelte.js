import { AtpAgent } from '@atproto/api';

import { BLUESKY_SERVICE, SESSION_KEY } from './constants.js';

class AuthState {
  agent = $state(null);
  session = $state(null);
  isLoading = $state(true);
  error = $state(null);

  createAgent() {
    return new AtpAgent({
      service: BLUESKY_SERVICE,
      persistSession: (event, session) => {
        if (session) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } else if (event === 'expired' || event === 'create-failed') {
          localStorage.removeItem(SESSION_KEY);
        }
        this.session = session ?? null;
        if (!session) {
          this.agent = null;
        }
      },
    });
  }

  async init() {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        const newAgent = this.createAgent();
        await newAgent.resumeSession(sessionData);
        if (newAgent.session) {
          this.agent = newAgent;
          this.session = newAgent.session;
        } else {
          localStorage.removeItem(SESSION_KEY);
          this.session = null;
          this.agent = null;
        }
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
      const newAgent = this.createAgent();
      const response = await newAgent.login({ identifier, password });

      if (response.success) {
        this.agent = newAgent;
        this.session = newAgent.session;
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
