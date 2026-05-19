import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Project } from '../../domain/models/project.model';
import { environment } from '../../../environments/environment';

export interface CreateProjectPayload {
  name: string;
  workspaceId: string;
  width?: number;
  height?: number;
}

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listByWorkspace(workspaceId: string): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/projects`, {
      params: { workspaceId },
    });
  }

  getById(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/projects/${id}`);
  }

  create(payload: CreateProjectPayload): Observable<Project> {
    return this.http.post<Project>(`${this.baseUrl}/projects`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/projects/${id}`);
  }
}
