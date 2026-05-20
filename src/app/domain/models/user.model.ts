export type OrgRole = 'owner' | 'admin' | 'member';
export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface OrgSummary {
  readonly id: string;
  readonly name: string;
  readonly role: OrgRole;
}

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface UserSession {
  readonly user: User;
  readonly kid: string;
  readonly jwt: string;
  readonly refreshToken?: string;
  readonly organizationId?: string;
  readonly organizations?: OrgSummary[];
}
