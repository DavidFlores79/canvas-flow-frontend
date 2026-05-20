import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Layer } from '../../domain/models/layer.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LayerApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  list(projectId: string): Observable<Layer[]> {
    return this.http.get<Layer[]>(`${this.baseUrl}/projects/${projectId}/layers`);
  }

  create(projectId: string, layer: Layer): Observable<Layer> {
    return this.http.post<Layer>(`${this.baseUrl}/projects/${projectId}/layers`, layer);
  }

  update(projectId: string, layerId: string, layer: Partial<Layer>): Observable<Layer> {
    return this.http.patch<Layer>(`${this.baseUrl}/projects/${projectId}/layers/${layerId}`, layer);
  }

  remove(projectId: string, layerId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/projects/${projectId}/layers/${layerId}`);
  }
}
