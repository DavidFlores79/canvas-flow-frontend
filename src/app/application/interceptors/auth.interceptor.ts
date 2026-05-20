import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthStore } from '../stores/auth.store';
import { from } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly authStore: AuthStore) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const authedReq = this.attachToken(req);

    return next.handle(authedReq).pipe(
      catchError((err: unknown) => {
        if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
          return throwError(() => err);
        }

        if (req.url.includes('/auth/refresh')) {
          this.authStore.signOut();
          return throwError(() => err);
        }

        const hasRefreshToken = !!localStorage.getItem('cf_refresh_token');
        if (!hasRefreshToken) {
          this.authStore.signOut();
          return throwError(() => err);
        }

        return from(this.authStore.refreshSession()).pipe(
          switchMap((success) => {
            if (!success) {
              return throwError(() => err);
            }
            const retried = this.attachToken(req);
            return next.handle(retried).pipe(
              catchError((retryErr: unknown) => {
                if (retryErr instanceof HttpErrorResponse && retryErr.status === 401) {
                  this.authStore.signOut();
                }
                return throwError(() => retryErr);
              }),
            );
          }),
        );
      }),
    );
  }

  private attachToken(req: HttpRequest<unknown>): HttpRequest<unknown> {
    const token = this.authStore.getAccessToken();
    if (!token) return req;
    return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
}
