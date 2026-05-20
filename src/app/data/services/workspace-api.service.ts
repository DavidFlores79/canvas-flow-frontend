import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Workspace } from '../../domain/models/workspace.model';
import { environment } from '../../../environments/environment';

export interface CreateWorkspacePayload {
  name: string;
  organizationId: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listByOrganization(organizationId: string): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(`${this.baseUrl}/workspaces`, {
      params: { organizationId },
    });
  }

  getById(id: string): Observable<Workspace> {
    return this.http.get<Workspace>(`${this.baseUrl}/workspaces/${id}`);
  }

  create(payload: CreateWorkspacePayload): Observable<Workspace> {
    return this.http.post<Workspace>(`${this.baseUrl}/workspaces`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/workspaces/${id}`);
  }
}
