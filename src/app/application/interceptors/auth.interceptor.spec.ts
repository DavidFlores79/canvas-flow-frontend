import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import {
  HttpClient,
  HTTP_INTERCEPTORS,
  HttpErrorResponse,
} from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthInterceptor } from './auth.interceptor';
import { AuthStore } from '../stores/auth.store';

describe('AuthInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authStoreSpy: jasmine.SpyObj<AuthStore>;

  beforeEach(() => {
    authStoreSpy = jasmine.createSpyObj<AuthStore>('AuthStore', [
      'getAccessToken',
      'signOut',
      'refreshSession',
    ]);
    authStoreSpy.getAccessToken.and.returnValue(null);
    authStoreSpy.signOut.and.stub();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthStore, useValue: authStoreSpy },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('passes non-401 responses through unchanged', () => {
    authStoreSpy.getAccessToken.and.returnValue('valid-token');

    let result: unknown;
    httpClient.get('/api/data').subscribe({ next: (r) => (result = r) });

    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.get('Authorization')).toBe('Bearer valid-token');
    req.flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('attaches Bearer token when access token is present', () => {
    authStoreSpy.getAccessToken.and.returnValue('my-token');

    httpClient.get('/api/something').subscribe();

    const req = httpMock.expectOne('/api/something');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('on 401 for a regular request: refreshes session then retries once with new token', fakeAsync(() => {
    localStorage.setItem('cf_refresh_token', 'refresh-tok');
    authStoreSpy.getAccessToken.and.returnValues('old-token', 'new-token');
    authStoreSpy.refreshSession.and.returnValue(Promise.resolve(true));

    let result: unknown;
    httpClient.get('/api/protected').subscribe({ next: (r) => (result = r) });

    const first = httpMock.expectOne('/api/protected');
    expect(first.request.headers.get('Authorization')).toBe('Bearer old-token');
    first.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    flushMicrotasks();

    const retry = httpMock.expectOne('/api/protected');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush({ data: 'ok' });

    expect(result).toEqual({ data: 'ok' });
    expect(authStoreSpy.refreshSession).toHaveBeenCalledTimes(1);
  }));

  it('on 401 targeting /auth/refresh: signs out without retrying', () => {
    localStorage.setItem('cf_refresh_token', 'refresh-tok');
    authStoreSpy.getAccessToken.and.returnValue('token');

    let caughtError: HttpErrorResponse | undefined;
    httpClient.post('/auth/refresh', {}).subscribe({
      error: (err: HttpErrorResponse) => (caughtError = err),
    });

    const req = httpMock.expectOne('/auth/refresh');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(caughtError?.status).toBe(401);
    expect(authStoreSpy.signOut).toHaveBeenCalled();
    expect(authStoreSpy.refreshSession).not.toHaveBeenCalled();
  });

  it('on 401 with no refresh token in storage: signs out without retrying', () => {
    localStorage.removeItem('cf_refresh_token');
    authStoreSpy.getAccessToken.and.returnValue('token');

    let errored = false;
    httpClient.get('/api/secure').subscribe({ error: () => (errored = true) });

    const req = httpMock.expectOne('/api/secure');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(authStoreSpy.signOut).toHaveBeenCalled();
    expect(authStoreSpy.refreshSession).not.toHaveBeenCalled();
  });

  it('if retry also gets 401: signs out and does not retry again', fakeAsync(() => {
    localStorage.setItem('cf_refresh_token', 'refresh-tok');
    authStoreSpy.getAccessToken.and.returnValues('old-token', 'new-token');
    authStoreSpy.refreshSession.and.returnValue(Promise.resolve(true));

    let errored = false;
    httpClient.get('/api/protected').subscribe({ error: () => (errored = true) });

    const first = httpMock.expectOne('/api/protected');
    first.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    flushMicrotasks();

    const retry = httpMock.expectOne('/api/protected');
    retry.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(authStoreSpy.signOut).toHaveBeenCalled();
  }));
});
