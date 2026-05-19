import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideRouter([])],
    });
    store = TestBed.inject(AuthStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should start unauthenticated when no token in storage', () => {
    expect(store.isAuthenticated()).toBeFalse();
    expect(store.currentUser()).toBeNull();
  });

  it('should start with empty organizations', () => {
    expect(store.organizations()).toEqual([]);
  });

  it('hasMultipleOrgs should be false when organizations is empty', () => {
    expect(store.hasMultipleOrgs()).toBeFalse();
  });

  it('should clear storage and reset state on signOut', () => {
    localStorage.setItem('cf_access_token', 'fake-token');
    store.signOut();
    expect(localStorage.getItem('cf_access_token')).toBeNull();
    expect(store.currentUser()).toBeNull();
  });

  it('getAccessToken should return null when not logged in', () => {
    expect(store.getAccessToken()).toBeNull();
  });
});
