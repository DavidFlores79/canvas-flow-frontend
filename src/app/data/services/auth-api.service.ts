import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserSession } from '../../domain/models/user.model';
import { environment } from '../../../environments/environment';

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SwitchOrgPayload {
  organizationId: string;
}

export interface TokenResponse {
  jwt: string;
  refreshToken?: string;
  organizationId?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  signIn(payload: SignInPayload): Observable<UserSession> {
    return this.http.post<UserSession>(`${this.baseUrl}/auth/sign-in`, payload);
  }

  switchOrganization(payload: SwitchOrgPayload): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.baseUrl}/auth/switch-organization`, payload);
  }

  refreshToken(refreshToken: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.baseUrl}/auth/refresh`, { refreshToken });
  }
}
