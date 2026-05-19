import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Asset, AiGeneratePayload } from '../../domain/models/asset.model';
import { environment } from '../../../environments/environment';

export interface AiGenerateResult {
  assets: Asset[];
}

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  generate(payload: AiGeneratePayload): Observable<AiGenerateResult> {
    return this.http.post<AiGenerateResult>(`${this.baseUrl}/ai/generate`, payload);
  }
}
