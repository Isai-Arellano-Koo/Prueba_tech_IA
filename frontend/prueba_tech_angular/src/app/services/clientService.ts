import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private securityUrl = 'http://localhost:3001';  // security-service
  private clientsUrl = 'http://localhost:3002';   // clients-service

  constructor(private http: HttpClient) {}

  // obtiene token de 8 dígitos del microservicio de seguridad
  getToken(userName?: string): Observable<any> {
    return this.http.post(`${this.securityUrl}/token/generate`, { user_name: userName || null });
  }

  // envía el registro al microservicio de clientes junto con el token
  registerClient(payload: { name: string; email: string; phone?: string; token: string }) {
    return this.http.post(`${this.clientsUrl}/clients/register`, payload);
  }

  // validar token
  validateToken(token: string) {
    return this.http.post(`${this.securityUrl}/token/validate`, { token });
  }
}
