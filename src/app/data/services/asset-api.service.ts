import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Asset, TransformPayload } from '../../domain/models/asset.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AssetApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listByWorkspace(workspaceId: string): Observable<Asset[]> {
    return this.http.get<Asset[]>(`${this.baseUrl}/assets`, {
      params: { workspaceId },
    });
  }

  upload(file: File, workspaceId: string): Observable<Asset> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', workspaceId);
    return this.http.post<Asset>(`${this.baseUrl}/assets/upload`, formData);
  }

  transform(id: string, payload: TransformPayload): Observable<Asset> {
    return this.http.post<Asset>(`${this.baseUrl}/assets/${id}/transform`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/assets/${id}`);
  }
}
