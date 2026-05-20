import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthApiService } from '../../data/services/auth-api.service';

describe('AuthStore', () => {
  let store: AuthStore;
  let authApiSpy: jasmine.SpyObj<AuthApiService>;

  beforeEach(() => {
    authApiSpy = jasmine.createSpyObj<AuthApiService>('AuthApiService', [
      'signIn',
      'switchOrganization',
      'refreshToken',
    ]);

    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: AuthApiService, useValue: authApiSpy },
      ],
    });

    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    localStorage.clear();
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

  describe('refreshSession()', () => {
    it('stores new tokens and returns true on success', async () => {
      localStorage.setItem('cf_refresh_token', 'old-refresh');
      authApiSpy.refreshToken.and.returnValue(
        of({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      );

      const result = await store.refreshSession();

      expect(result).toBeTrue();
      expect(localStorage.getItem('cf_access_token')).toBe('new-access');
      expect(localStorage.getItem('cf_refresh_token')).toBe('new-refresh');
      expect(authApiSpy.refreshToken).toHaveBeenCalledWith('old-refresh');
    });

    it('calls signOut and returns false when API throws', async () => {
      localStorage.setItem('cf_refresh_token', 'bad-token');
      authApiSpy.refreshToken.and.returnValue(throwError(() => new Error('401')));
      spyOn(store, 'signOut').and.callThrough();

      const result = await store.refreshSession();

      expect(result).toBeFalse();
      expect(store.signOut).toHaveBeenCalled();
    });

    it('calls signOut and returns false when no refresh token is stored', async () => {
      localStorage.removeItem('cf_refresh_token');
      spyOn(store, 'signOut').and.callThrough();

      const result = await store.refreshSession();

      expect(result).toBeFalse();
      expect(store.signOut).toHaveBeenCalled();
      expect(authApiSpy.refreshToken).not.toHaveBeenCalled();
    });

    it('concurrent calls share the same promise and only call the API once', async () => {
      localStorage.setItem('cf_refresh_token', 'shared-token');
      authApiSpy.refreshToken.and.returnValue(
        of({ accessToken: 'access', refreshToken: 'refresh' }),
      );

      const [r1, r2, r3] = await Promise.all([
        store.refreshSession(),
        store.refreshSession(),
        store.refreshSession(),
      ]);

      expect(r1).toBeTrue();
      expect(r2).toBeTrue();
      expect(r3).toBeTrue();
      expect(authApiSpy.refreshToken).toHaveBeenCalledTimes(1);
    });
  });
});
