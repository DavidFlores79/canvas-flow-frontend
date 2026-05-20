import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Organization } from '../../domain/models/organization.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrganizationApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getById(id: string): Observable<Organization> {
    return this.http.get<Organization>(`${this.baseUrl}/organizations/${id}`);
  }

  getMembers(id: string): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${this.baseUrl}/organizations/${id}/members`);
  }
}
